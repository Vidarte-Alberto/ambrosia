package pos.ambrosia.services

import kotlinx.coroutines.sync.Mutex
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.dao.id.EntityID
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import pos.ambrosia.db.tables.RecoveryActionEntity
import pos.ambrosia.db.tables.RecoveryActionsTable
import pos.ambrosia.db.tables.UsersTable
import pos.ambrosia.models.RecoveryAction
import pos.ambrosia.models.RecoveryActionResponse
import pos.ambrosia.models.RecoveryActionStatus
import pos.ambrosia.models.RecoveryCapabilitiesResponse
import java.time.Clock
import java.util.UUID

class RecoveryConflictException : RuntimeException("recovery_action_in_progress")

class RecoveryUnsupportedException(
    val reason: String,
) : RuntimeException(reason)

class RecoveryService(
    private val executor: RecoveryExecutor = UnsupportedRecoveryExecutor(),
    private val authorizationService: RecoveryAuthorizationService = RecoveryAuthorizationService(),
    private val clock: Clock = Clock.systemUTC(),
) {
    private val executionMutex = Mutex()

    @Volatile
    private var lockedActionId: String? = null

    fun capabilities(): RecoveryCapabilitiesResponse {
        val active = activeAction()
        return RecoveryCapabilitiesResponse(
            executor = executor.id,
            busy = active != null || executionMutex.isLocked,
            activeActionId = active?.id,
            actions = executor.capabilities(),
        )
    }

    fun authorize(
        actorUserId: String,
        action: RecoveryAction,
    ) = authorizationService.issue(actorUserId, action)

    fun create(
        actorUserId: String,
        action: RecoveryAction,
        authorizationToken: String,
    ): RecoveryActionResponse {
        authorizationService.consume(authorizationToken, actorUserId, action)
        val capability = executor.capabilities()[action]
        if (capability?.available != true) {
            throw RecoveryUnsupportedException(capability?.reason ?: "unsupported_action")
        }
        if (!executionMutex.tryLock()) throw RecoveryConflictException()

        return try {
            val created =
                transaction {
                    if (findActiveEntity() != null) throw RecoveryConflictException()
                    val now = clock.instant().toString()
                    RecoveryActionEntity
                        .new(UUID.randomUUID()) {
                            this.actorUserId = EntityID(UUID.fromString(actorUserId), UsersTable)
                            this.action = action.name
                            status = RecoveryActionStatus.ACCEPTED.name
                            requestedAt = now
                            executorId = executor.id
                        }.toResponse()
                }
            lockedActionId = created.id
            created
        } catch (exception: Exception) {
            executionMutex.unlock()
            throw exception
        }
    }

    suspend fun execute(id: String): RecoveryActionResponse {
        try {
            val action =
                transaction {
                    val entity = requireNotNull(RecoveryActionEntity.findById(UUID.fromString(id)))
                    entity.status = RecoveryActionStatus.RUNNING.name
                    entity.startedAt = clock.instant().toString()
                    RecoveryAction.valueOf(entity.action)
                }

            val result =
                try {
                    executor.execute(action)
                } catch (exception: Exception) {
                    pos.ambrosia.models.RecoveryExecutionResult(
                        success = false,
                        code = "executor_failure",
                        message = exception.message?.take(500),
                    )
                }

            return transaction {
                val entity = requireNotNull(RecoveryActionEntity.findById(UUID.fromString(id)))
                entity.status =
                    if (result.success) RecoveryActionStatus.SUCCEEDED.name else RecoveryActionStatus.FAILED.name
                entity.completedAt = clock.instant().toString()
                entity.resultCode = result.code
                entity.resultMessage = result.message?.take(500)
                entity.toResponse()
            }
        } finally {
            if (lockedActionId == id) {
                lockedActionId = null
                executionMutex.unlock()
            }
        }
    }

    fun get(id: String): RecoveryActionResponse? = transaction { RecoveryActionEntity.findById(UUID.fromString(id))?.toResponse() }

    private fun activeAction(): RecoveryActionResponse? = transaction { findActiveEntity()?.toResponse() }

    private fun findActiveEntity(): RecoveryActionEntity? =
        RecoveryActionEntity
            .find {
                RecoveryActionsTable.status inList
                    listOf(RecoveryActionStatus.ACCEPTED.name, RecoveryActionStatus.RUNNING.name)
            }.orderBy(RecoveryActionsTable.requestedAt to SortOrder.DESC)
            .firstOrNull()

    private fun RecoveryActionEntity.toResponse() =
        RecoveryActionResponse(
            id = id.value.toString(),
            actorUserId = actorUserId.value.toString(),
            action = RecoveryAction.valueOf(action),
            status = RecoveryActionStatus.valueOf(status),
            requestedAt = requestedAt,
            startedAt = startedAt,
            completedAt = completedAt,
            resultCode = resultCode,
            resultMessage = resultMessage,
            executor = executorId,
        )
}
