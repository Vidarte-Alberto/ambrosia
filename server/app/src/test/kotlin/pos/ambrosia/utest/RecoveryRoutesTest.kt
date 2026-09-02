package pos.ambrosia.utest

import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.install
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.junit.After
import org.junit.Before
import pos.ambrosia.api.configureRecovery
import pos.ambrosia.api.handler
import pos.ambrosia.api.recovery
import pos.ambrosia.db.tables.RoleEntity
import pos.ambrosia.db.tables.RolesTable
import pos.ambrosia.models.RecoveryAction
import pos.ambrosia.models.RecoveryActionResponse
import pos.ambrosia.models.RecoveryAuthorizationResponse
import pos.ambrosia.services.FakeRecoveryExecutor
import pos.ambrosia.services.RecoveryCredentialVerifier
import pos.ambrosia.services.RecoveryService
import pos.ambrosia.services.UnsupportedRecoveryExecutor
import pos.ambrosia.utils.ExposedTestDb
import pos.ambrosia.utils.installAdminAuth
import pos.ambrosia.utils.installNonAdminAuth
import pos.ambrosia.utils.withAuthCookies
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals

class RecoveryRoutesTest {
    private lateinit var databaseFile: File

    @Before
    fun setUp() {
        databaseFile = ExposedTestDb.connect()
    }

    @After
    fun tearDown() {
        ExposedTestDb.cleanup(databaseFile)
    }

    @Test
    fun `capabilities require a valid authenticated session`() =
        testApplication {
            installAdminAuth()
            application {
                install(ContentNegotiation) { json() }
                handler()
                configureRecovery()
            }

            assertEquals(HttpStatusCode.Unauthorized, client.get("/admin/recovery/capabilities").status)
        }

    @Test
    fun `non admin cannot access recovery routes`() =
        testApplication {
            val auth = installNonAdminAuth()
            application {
                install(ContentNegotiation) { json() }
                handler()
                configureRecovery()
            }

            val response = client.get("/admin/recovery/capabilities") { withAuthCookies(auth) }
            assertEquals(HttpStatusCode.Forbidden, response.status)
            val authorizationResponse =
                client.post("/admin/recovery/authorizations") {
                    withAuthCookies(auth)
                    header(HttpHeaders.ContentType, "application/json")
                    setBody("""{"action":"RESTART_LIGHTNING","walletPassword":"wallet-secret"}""")
                }
            assertEquals(HttpStatusCode.Forbidden, authorizationResponse.status)
        }

    @Test
    fun `admin status is checked from database instead of stale access token`() =
        testApplication {
            val auth = installAdminAuth(roleName = "recovery-demoted-role")
            transaction {
                RoleEntity.find { RolesTable.role eq "recovery-demoted-role" }.single().isAdmin = false
            }
            application {
                install(ContentNegotiation) { json() }
                handler()
                configureRecovery()
            }

            val response = client.get("/admin/recovery/capabilities") { withAuthCookies(auth) }
            assertEquals(HttpStatusCode.Forbidden, response.status)
        }

    @Test
    fun `unsupported executor exposes capabilities and refuses authorization`() =
        testApplication {
            val auth = installAdminAuth()
            val verifier = AllowAdminCredentialVerifier(passwordValid = true)
            application {
                install(ContentNegotiation) { json() }
                handler()
                routing {
                    route("/admin/recovery") {
                        recovery(RecoveryService(UnsupportedRecoveryExecutor()), verifier)
                    }
                }
            }

            val capabilities = client.get("/admin/recovery/capabilities") { withAuthCookies(auth) }
            val authorization =
                client.post("/admin/recovery/authorizations") {
                    withAuthCookies(auth)
                    header(HttpHeaders.ContentType, "application/json")
                    setBody("""{"action":"RESTART_LIGHTNING","walletPassword":"wallet-secret"}""")
                }

            assertEquals(HttpStatusCode.OK, capabilities.status)
            assertEquals(HttpStatusCode.UnprocessableEntity, authorization.status)
        }

    @Test
    fun `wallet password is required before issuing short authorization`() =
        testApplication {
            val auth = installAdminAuth()
            val verifier = AllowAdminCredentialVerifier(passwordValid = false)
            application {
                install(ContentNegotiation) { json() }
                handler()
                routing {
                    route("/admin/recovery") {
                        recovery(RecoveryService(FakeRecoveryExecutor()), verifier)
                    }
                }
            }

            val response =
                client.post("/admin/recovery/authorizations") {
                    withAuthCookies(auth)
                    header(HttpHeaders.ContentType, "application/json")
                    setBody("""{"action":"RESTART_LIGHTNING","walletPassword":"wrong"}""")
                }

            assertEquals(HttpStatusCode.Unauthorized, response.status)
        }

    @Test
    fun `authorization executes one action and replay is rejected`() =
        testApplication {
            val auth = installAdminAuth()
            val verifier = AllowAdminCredentialVerifier(passwordValid = true)
            val executor = FakeRecoveryExecutor()
            val service = RecoveryService(executor)
            application {
                install(ContentNegotiation) { json() }
                handler()
                routing { route("/admin/recovery") { recovery(service, verifier) } }
            }

            val authorizationResponse =
                client.post("/admin/recovery/authorizations") {
                    withAuthCookies(auth)
                    header(HttpHeaders.ContentType, "application/json")
                    setBody("""{"action":"RESTART_LIGHTNING","walletPassword":"wallet-secret"}""")
                }
            val authorization =
                Json.decodeFromString<RecoveryAuthorizationResponse>(authorizationResponse.bodyAsText())
            val requestBody =
                """{"action":"RESTART_LIGHTNING","authorizationToken":"${authorization.token}"}"""

            val accepted =
                client.post("/admin/recovery/actions") {
                    withAuthCookies(auth)
                    header(HttpHeaders.ContentType, "application/json")
                    setBody(requestBody)
                }
            val acceptedAction = Json.decodeFromString<RecoveryActionResponse>(accepted.bodyAsText())
            val statusResponse =
                client.get("/admin/recovery/actions/${acceptedAction.id}") {
                    withAuthCookies(auth)
                }
            val replay =
                client.post("/admin/recovery/actions") {
                    withAuthCookies(auth)
                    header(HttpHeaders.ContentType, "application/json")
                    setBody(requestBody)
                }

            assertEquals(HttpStatusCode.Created, authorizationResponse.status)
            assertEquals(HttpStatusCode.Accepted, accepted.status)
            assertEquals(HttpStatusCode.OK, statusResponse.status)
            assertEquals(HttpStatusCode.Unauthorized, replay.status)
        }
}

private class AllowAdminCredentialVerifier(
    private val passwordValid: Boolean,
) : RecoveryCredentialVerifier {
    override fun isCurrentAdmin(userId: String) = true

    override fun verifyWalletPassword(
        userId: String,
        password: CharArray,
    ) = passwordValid
}
