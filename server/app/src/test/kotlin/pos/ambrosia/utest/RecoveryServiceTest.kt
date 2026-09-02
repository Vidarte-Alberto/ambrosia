package pos.ambrosia.utest

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Before
import pos.ambrosia.models.RecoveryAction
import pos.ambrosia.models.RecoveryActionStatus
import pos.ambrosia.models.RecoveryExecutionResult
import pos.ambrosia.services.FakeRecoveryExecutor
import pos.ambrosia.services.RecoveryConflictException
import pos.ambrosia.services.RecoveryService
import pos.ambrosia.services.RecoveryUnsupportedException
import pos.ambrosia.services.UnsupportedRecoveryExecutor
import pos.ambrosia.utils.ExposedTestDb
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class RecoveryServiceTest {
    private lateinit var databaseFile: File
    private lateinit var actorUserId: String

    @Before
    fun setUp() {
        databaseFile = ExposedTestDb.connect()
        val roleId = ExposedTestDb.seedRole("recovery-admin", isAdmin = true)
        actorUserId = ExposedTestDb.seedUser("recovery-actor", roleId)
    }

    @After
    fun tearDown() {
        ExposedTestDb.cleanup(databaseFile)
    }

    @Test
    fun `successful execution persists complete audit data`() =
        runBlocking {
            val executor = FakeRecoveryExecutor(id = "test-platform")
            val service = RecoveryService(executor)
            val authorization = service.authorize(actorUserId, RecoveryAction.RESTART_LIGHTNING)
            val accepted = service.create(actorUserId, RecoveryAction.RESTART_LIGHTNING, authorization.token)

            val completed = service.execute(accepted.id)
            val persisted = service.get(accepted.id)

            assertEquals(RecoveryActionStatus.SUCCEEDED, completed.status)
            assertEquals("completed", completed.resultCode)
            assertEquals(actorUserId, completed.actorUserId)
            assertEquals("test-platform", completed.executor)
            assertNotNull(completed.requestedAt)
            assertNotNull(completed.startedAt)
            assertNotNull(completed.completedAt)
            assertEquals(completed, persisted)
            assertEquals(listOf(RecoveryAction.RESTART_LIGHTNING), executor.executedActions)
        }

    @Test
    fun `executor failure is persisted`() =
        runBlocking {
            val executor = FakeRecoveryExecutor()
            executor.returns(
                RecoveryAction.RESTART_AMBROSIA,
                RecoveryExecutionResult(false, "restart_failed", "Service did not start"),
            )
            val service = RecoveryService(executor)
            val authorization = service.authorize(actorUserId, RecoveryAction.RESTART_AMBROSIA)
            val accepted = service.create(actorUserId, RecoveryAction.RESTART_AMBROSIA, authorization.token)

            val completed = service.execute(accepted.id)

            assertEquals(RecoveryActionStatus.FAILED, completed.status)
            assertEquals("restart_failed", completed.resultCode)
            assertEquals("Service did not start", completed.resultMessage)
        }

    @Test
    fun `unsupported executor reports every action unavailable and executes nothing`() {
        val executor = UnsupportedRecoveryExecutor()
        val service = RecoveryService(executor)

        assertTrue(
            service
                .capabilities()
                .actions.values
                .none { it.available },
        )
        val authorization = service.authorize(actorUserId, RecoveryAction.REBOOT_DEVICE)
        assertFailsWith<RecoveryUnsupportedException> {
            service.create(actorUserId, RecoveryAction.REBOOT_DEVICE, authorization.token)
        }
    }

    @Test
    fun `a second action is rejected while the first one is running`() =
        runBlocking {
            val releaseFirstAction = CompletableDeferred<Unit>()
            val executor = FakeRecoveryExecutor(beforeExecute = { releaseFirstAction.await() })
            val service = RecoveryService(executor)
            val firstAuthorization = service.authorize(actorUserId, RecoveryAction.RESTART_LIGHTNING)
            val first = service.create(actorUserId, RecoveryAction.RESTART_LIGHTNING, firstAuthorization.token)
            val running = async { service.execute(first.id) }

            val secondAuthorization = service.authorize(actorUserId, RecoveryAction.RESTART_AMBROSIA)
            assertFailsWith<RecoveryConflictException> {
                service.create(actorUserId, RecoveryAction.RESTART_AMBROSIA, secondAuthorization.token)
            }

            releaseFirstAction.complete(Unit)
            running.await()
            Unit
        }

    @Test
    fun `persisted active action blocks another service instance`() =
        runBlocking {
            val firstService = RecoveryService(FakeRecoveryExecutor())
            val secondService = RecoveryService(FakeRecoveryExecutor())
            val firstAuthorization = firstService.authorize(actorUserId, RecoveryAction.RESTART_LIGHTNING)
            val first = firstService.create(actorUserId, RecoveryAction.RESTART_LIGHTNING, firstAuthorization.token)
            val secondAuthorization = secondService.authorize(actorUserId, RecoveryAction.RESTART_AMBROSIA)

            assertFailsWith<RecoveryConflictException> {
                secondService.create(actorUserId, RecoveryAction.RESTART_AMBROSIA, secondAuthorization.token)
            }

            firstService.execute(first.id)
            Unit
        }
}
