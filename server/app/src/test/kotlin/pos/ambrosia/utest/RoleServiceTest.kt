package pos.ambrosia.utest

import io.ktor.server.application.ApplicationEnvironment
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Before
import org.mockito.ArgumentMatchers.anyString
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import pos.ambrosia.models.Role
import pos.ambrosia.services.RolesService
import pos.ambrosia.util.ExposedTestDb
import pos.ambrosia.utils.LastAdminRemovalException
import java.io.File
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RoleServiceTest {
    private val mockConnection: Connection = mock()
    private val mockStatement: PreparedStatement = mock()
    private val mockResultSet: ResultSet = mock()
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
    fun `addRole returns null if role name is blank`() {
        runBlocking {
            val service = RolesService(mockEnv, mockConnection) // Arrange
            val result = service.addRole(Role(role = "  ")) // Act
            assertNull(result) // Assert
        }
    }

    @Test
    fun `updateRole returns false if role name is blank`() {
        runBlocking {
            val service = RolesService(mockEnv, mockConnection) // Arrange
            val result = service.updateRole("some-id", Role(role = "  ")) // Act
            assertFalse(result) // Assert
        }
    }

    @Test
    fun `getRoles returns list of roles when found`() {
        runBlocking {
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet) // Arrange
            whenever(mockResultSet.next()).thenReturn(true).thenReturn(true).thenReturn(false) // Arrange
            whenever(mockResultSet.getString("id")).thenReturn("role-1").thenReturn("role-2") // Arrange
            whenever(mockResultSet.getString("role")).thenReturn("Admin").thenReturn("Cashier") // Arrange
            whenever(mockResultSet.getString("password")).thenReturn("pass-hash-1").thenReturn("pass-hash-2") // Arrange
            whenever(mockResultSet.getBoolean("isAdmin")).thenReturn(true).thenReturn(false) // Arrange
            val service = RolesService(mockEnv, mockConnection) // Arrange
            val result = service.getRoles() // Act
            assertEquals(2, result.size) // Assert
            assertEquals("Admin", result[0].role) // Assert
            assertFalse(result[1].isAdmin ?: true) // Assert
        }
    }

    @Test
    fun `getRoles returns empty list when none found`() {
        runBlocking {
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet) // Arrange
            whenever(mockResultSet.next()).thenReturn(false) // Arrange
            val service = RolesService(mockEnv, mockConnection) // Arrange
            val result = service.getRoles() // Act
            assertTrue(result.isEmpty()) // Assert
        }
    }

    @Test
    fun `getRoleById returns role when found`() {
        runBlocking {
            val expectedRole = Role(id = "role-1", role = "Admin", isAdmin = true) // Arrange
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet) // Arrange
            whenever(mockResultSet.next()).thenReturn(true) // Arrange
            whenever(mockResultSet.getString("id")).thenReturn(expectedRole.id) // Arrange
            whenever(mockResultSet.getString("role")).thenReturn(expectedRole.role) // Arrange
            whenever(mockResultSet.getBoolean("isAdmin")).thenReturn(expectedRole.isAdmin) // Arrange
            val service = RolesService(mockEnv, mockConnection) // Arrange
            val result = service.getRoleById("role-1") // Act
            assertNotNull(result) // Assert
            assertEquals(expectedRole, result) // Assert
        }
    }

    @Test
    fun `getRoleById returns null when not found`() {
        runBlocking {
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet) // Arrange
            whenever(mockResultSet.next()).thenReturn(false) // Arrange
            val service = RolesService(mockEnv, mockConnection) // Arrange
            val result = service.getRoleById("not-found") // Act
            assertNull(result) // Assert
        }
    }

    @Test
    fun `deleteRole unassigns users and returns true on success`() {
        runBlocking {
            val roleId = ExposedTestDb.seedRole("Cashier", isAdmin = false)
            val unassignStatement: PreparedStatement = mock()
            val unassignResult: ResultSet = mock()
            val deleteStatement: PreparedStatement = mock()
            val deleteResult: ResultSet = mock()
            whenever(mockConnection.prepareStatement(anyString())).thenAnswer { invocation ->
                when {
                    invocation.getArgument<String>(0).contains("UPDATE users SET role_id = NULL") -> unassignStatement
                    invocation.getArgument<String>(0).contains("UPDATE roles SET role") -> deleteStatement
                    else -> mock()
                }
            }
            whenever(unassignStatement.executeQuery()).thenReturn(unassignResult)
            whenever(unassignStatement.executeUpdate()).thenReturn(1)
            whenever(deleteStatement.executeQuery()).thenReturn(deleteResult)
            whenever(deleteStatement.executeUpdate()).thenReturn(1)
            val service = RolesService(mockEnv, mockConnection)
            val result = service.deleteRole(roleId)
            assertTrue(result)
            verify(unassignStatement).executeUpdate()
        }
    }

    @Test
    fun `deleteRole returns false when role not found`() {
        runBlocking {
            val roleId =
                java.util.UUID
                    .randomUUID()
                    .toString()
            val unassignStatement: PreparedStatement = mock()
            val unassignResult: ResultSet = mock()
            val deleteStatement: PreparedStatement = mock()
            val deleteResult: ResultSet = mock()
            whenever(mockConnection.prepareStatement(anyString())).thenAnswer { invocation ->
                when {
                    invocation.getArgument<String>(0).contains("UPDATE users SET role_id = NULL") -> unassignStatement
                    invocation.getArgument<String>(0).contains("UPDATE roles SET role") -> deleteStatement
                    else -> mock()
                }
            }
            whenever(unassignStatement.executeQuery()).thenReturn(unassignResult)
            whenever(unassignStatement.executeUpdate()).thenReturn(0)
            whenever(deleteStatement.executeQuery()).thenReturn(deleteResult)
            whenever(deleteStatement.executeUpdate()).thenReturn(0)
            val service = RolesService(mockEnv, mockConnection)
            val result = service.deleteRole(roleId)
            assertFalse(result)
        }
    }

    @Test
    fun `deleteRole blocks deleting last admin role in use`() {
        runBlocking {
            val roleId = ExposedTestDb.seedRole("Admin", isAdmin = true)
            ExposedTestDb.seedUser("admin-user", roleId = roleId)

            val unassignStatement: PreparedStatement = mock()

            whenever(mockConnection.prepareStatement(anyString())).thenAnswer { invocation ->
                when {
                    invocation.getArgument<String>(0).contains("UPDATE users SET role_id = NULL") -> unassignStatement
                    else -> mock()
                }
            }

            val service = RolesService(mockEnv, mockConnection)

            assertFailsWith<LastAdminRemovalException> {
                service.deleteRole(roleId)
            }
            verify(unassignStatement, never()).executeUpdate()
        }
    }

    @Test
    fun `updateRole blocks removing admin from last admin role in use`() {
        runBlocking {
            val roleId = ExposedTestDb.seedRole("Admin", isAdmin = true)
            ExposedTestDb.seedUser("admin-user", roleId = roleId)

            val roleExistsStatement: PreparedStatement = mock()
            val roleExistsResult: ResultSet = mock()

            whenever(mockConnection.prepareStatement(anyString())).thenAnswer { invocation ->
                when {
                    invocation.getArgument<String>(0).contains("SELECT id FROM roles WHERE role = ? AND id != ?") -> roleExistsStatement
                    else -> mock()
                }
            }

            whenever(roleExistsStatement.executeQuery()).thenReturn(roleExistsResult)
            whenever(roleExistsResult.next()).thenReturn(false)

            val service = RolesService(mockEnv, mockConnection)

            assertFailsWith<LastAdminRemovalException> {
                service.updateRole(roleId, Role(role = "Cashier", isAdmin = false))
            }
        }
    }
}
