package pos.ambrosia.api

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.auth.authenticate
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import kotlinx.coroutines.launch
import pos.ambrosia.models.RecoveryActionRequest
import pos.ambrosia.models.RecoveryAuthorizationRequest
import pos.ambrosia.services.AuthService
import pos.ambrosia.services.DatabaseRecoveryCredentialVerifier
import pos.ambrosia.services.RecoveryAuthorizationException
import pos.ambrosia.services.RecoveryConflictException
import pos.ambrosia.services.RecoveryCredentialVerifier
import pos.ambrosia.services.RecoveryExecutor
import pos.ambrosia.services.RecoveryService
import pos.ambrosia.services.RecoveryUnsupportedException
import pos.ambrosia.services.UnsupportedRecoveryExecutor
import pos.ambrosia.utils.getCurrentUser

fun Application.configureRecovery(executor: RecoveryExecutor = UnsupportedRecoveryExecutor()) {
    val service = RecoveryService(executor = executor)
    val credentialVerifier = DatabaseRecoveryCredentialVerifier(AuthService(environment))
    routing { route("/admin/recovery") { recovery(service, credentialVerifier) } }
}

private suspend fun ApplicationCall.currentAdminUserId(credentialVerifier: RecoveryCredentialVerifier): String? {
    val userId = getCurrentUser()?.userId
    if (userId == null || !credentialVerifier.isCurrentAdmin(userId)) {
        respond(HttpStatusCode.Forbidden, mapOf("code" to "admin_required"))
        return null
    }
    return userId
}

fun Route.recovery(
    recoveryService: RecoveryService,
    credentialVerifier: RecoveryCredentialVerifier,
) {
    authenticate("auth-jwt") {
        get("/capabilities") {
            call.currentAdminUserId(credentialVerifier) ?: return@get
            call.respond(recoveryService.capabilities())
        }

        post("/authorizations") {
            val actorUserId = call.currentAdminUserId(credentialVerifier) ?: return@post
            val request = call.receive<RecoveryAuthorizationRequest>()
            val capability = recoveryService.capabilities().actions[request.action]
            if (capability?.available != true) {
                return@post call.respond(
                    HttpStatusCode.UnprocessableEntity,
                    mapOf("code" to (capability?.reason ?: "unsupported_action")),
                )
            }
            if (request.walletPassword.isBlank()) {
                return@post call.respond(HttpStatusCode.BadRequest, mapOf("code" to "wallet_password_required"))
            }
            if (!credentialVerifier.verifyWalletPassword(actorUserId, request.walletPassword.toCharArray())) {
                return@post call.respond(HttpStatusCode.Unauthorized, mapOf("code" to "invalid_wallet_password"))
            }
            call.respond(
                HttpStatusCode.Created,
                recoveryService.authorize(actorUserId, request.action),
            )
        }

        post("/actions") {
            val actorUserId = call.currentAdminUserId(credentialVerifier) ?: return@post
            val request = call.receive<RecoveryActionRequest>()
            try {
                val action = recoveryService.create(actorUserId, request.action, request.authorizationToken)
                call.respond(HttpStatusCode.Accepted, action)
                call.application.launch { recoveryService.execute(action.id) }
            } catch (exception: RecoveryAuthorizationException) {
                call.respond(HttpStatusCode.Unauthorized, mapOf("code" to exception.code))
            } catch (_: RecoveryConflictException) {
                call.respond(HttpStatusCode.Conflict, mapOf("code" to "recovery_action_in_progress"))
            } catch (exception: RecoveryUnsupportedException) {
                call.respond(HttpStatusCode.UnprocessableEntity, mapOf("code" to exception.reason))
            }
        }

        get("/actions/{id}") {
            call.currentAdminUserId(credentialVerifier) ?: return@get
            val id =
                call.parameters["id"]
                    ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("code" to "missing_action_id"))
            val action =
                runCatching { recoveryService.get(id) }.getOrNull()
                    ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("code" to "action_not_found"))
            call.respond(action)
        }
    }
}
