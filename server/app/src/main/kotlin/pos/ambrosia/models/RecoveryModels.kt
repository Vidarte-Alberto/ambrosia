package pos.ambrosia.models

import kotlinx.serialization.Serializable

@Serializable
enum class RecoveryAction {
    RESTART_LIGHTNING,
    RESTART_AMBROSIA,
    REBOOT_DEVICE,
    SHUTDOWN_DEVICE,
}

@Serializable
enum class RecoveryActionStatus {
    ACCEPTED,
    RUNNING,
    SUCCEEDED,
    FAILED,
    INTERRUPTED,
}

@Serializable
data class RecoveryCapability(
    val available: Boolean,
    val reason: String? = null,
)

@Serializable
data class RecoveryCapabilitiesResponse(
    val executor: String,
    val busy: Boolean,
    val activeActionId: String? = null,
    val actions: Map<RecoveryAction, RecoveryCapability>,
)

@Serializable
data class RecoveryAuthorizationRequest(
    val action: RecoveryAction,
    val walletPassword: String,
)

@Serializable
data class RecoveryAuthorizationResponse(
    val token: String,
    val action: RecoveryAction,
    val expiresAt: String,
)

@Serializable
data class RecoveryActionRequest(
    val action: RecoveryAction,
    val authorizationToken: String,
)

@Serializable
data class RecoveryActionResponse(
    val id: String,
    val actorUserId: String,
    val action: RecoveryAction,
    val status: RecoveryActionStatus,
    val requestedAt: String,
    val startedAt: String? = null,
    val completedAt: String? = null,
    val resultCode: String? = null,
    val resultMessage: String? = null,
    val executor: String,
)

enum class RecoveryExecutionOutcome {
    SUCCEEDED,
    FAILED,
    INTERRUPTED,
}

data class RecoveryExecutionResult(
    val outcome: RecoveryExecutionOutcome,
    val code: String,
    val message: String? = null,
)

@Serializable
data class RecoveryErrorResponse(
    val code: String,
    val retryAfter: Long? = null,
)
