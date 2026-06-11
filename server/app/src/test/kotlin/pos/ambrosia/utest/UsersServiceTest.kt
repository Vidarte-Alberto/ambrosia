package pos.ambrosia.utest

import io.ktor.server.application.ApplicationEnvironment
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Before
import org.mockito.ArgumentMatchers.anyString
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import pos.ambrosia.models.UpdateUserRequest
import pos.ambrosia.services.UsersService
import pos.ambrosia.util.ExposedTestDb
import pos.ambrosia.utils.LastAdminRemovalException
import java.io.File
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class UsersServiceTest {
    private val mockConnection: Connection = mock()
    private val mockEnv: ApplicationEnvironment = mock()
    private lateinit var dbFile: File

    @Before
    fun setUp() {
        dbFile = ExposedTestDb.connect()
    }

    @After
    fun tearDown() {
        ExposedTestDb.cleanup(dbFile)
    }

    @Test
    fun `updateUser blocks reassigning last admin user to non admin role`() {
        runBlocking {
            val adminRoleId = ExposedTestDb.seedRole("Admin", isAdmin = true)
            val cashierRoleId = ExposedTestDb.seedRole("Cashier", isAdmin = false)
            val userId = ExposedTestDb.seedUser("admin-user", roleId = adminRoleId)

            val checkRoleStatement: PreparedStatement = mock()
            val checkRoleResult: ResultSet = mock()

            whenever(mockConnection.prepareStatement(anyString())).thenAnswer { invocation ->
                when {
                    invocation.getArgument<String>(0).contains("SELECT id FROM roles WHERE id = ? AND is_deleted = 0") -> checkRoleStatement
                    else -> mock()
                }
            }

            whenever(checkRoleStatement.executeQuery()).thenReturn(checkRoleResult)
            whenever(checkRoleResult.next()).thenReturn(true)

            val service = UsersService(mockEnv, mockConnection)

            assertFailsWith<LastAdminRemovalException> {
                service.updateUser(userId, UpdateUserRequest(roleId = cashierRoleId))
            }
        }
    }

    @Test
    fun `deleteUser blocks deleting last admin user`() {
        runBlocking {
            val adminRoleId = ExposedTestDb.seedRole("Admin", isAdmin = true)
            val userId = ExposedTestDb.seedUser("admin-user", roleId = adminRoleId)

            val countUsersStatement: PreparedStatement = mock()
            val countUsersResult: ResultSet = mock()

            whenever(mockConnection.prepareStatement(anyString())).thenAnswer { invocation ->
                when {
                    invocation.getArgument<String>(0).contains("SELECT COUNT(*) FROM users WHERE is_deleted = 0") -> countUsersStatement
                    else -> mock()
                }
            }

            whenever(countUsersStatement.executeQuery()).thenReturn(countUsersResult)
            whenever(countUsersResult.next()).thenReturn(true)
            whenever(countUsersResult.getLong(1)).thenReturn(2L)

            val service = UsersService(mockEnv, mockConnection)

            assertFailsWith<LastAdminRemovalException> {
                service.deleteUser(userId)
            }
        }
    }

    @Test
    fun `deleteUser allows deleting non admin user when another admin remains`() {
        runBlocking {
            val adminRoleId = ExposedTestDb.seedRole("Admin", isAdmin = true)
            val cashierRoleId = ExposedTestDb.seedRole("Cashier", isAdmin = false)
            ExposedTestDb.seedUser("admin-user", roleId = adminRoleId)
            val userId = ExposedTestDb.seedUser("cashier-user", roleId = cashierRoleId)

            val countUsersStatement: PreparedStatement = mock()
            val countUsersResult: ResultSet = mock()
            val deleteStatement: PreparedStatement = mock()
            val deleteResult: ResultSet = mock()

            whenever(mockConnection.prepareStatement(anyString())).thenAnswer { invocation ->
                when {
                    invocation.getArgument<String>(0).contains("SELECT COUNT(*) FROM users WHERE is_deleted = 0") -> countUsersStatement
                    invocation.getArgument<String>(0).contains("UPDATE users SET is_deleted = 1, name = ? WHERE id = ?") -> deleteStatement
                    else -> mock()
                }
            }

            whenever(countUsersStatement.executeQuery()).thenReturn(countUsersResult)
            whenever(countUsersResult.next()).thenReturn(true)
            whenever(countUsersResult.getLong(1)).thenReturn(2L)

            whenever(deleteStatement.executeQuery()).thenReturn(deleteResult)
            whenever(deleteStatement.executeUpdate()).thenReturn(1)

            val service = UsersService(mockEnv, mockConnection)

            assertTrue(service.deleteUser(userId))
            verify(deleteStatement).executeUpdate()
        }
    }
}
