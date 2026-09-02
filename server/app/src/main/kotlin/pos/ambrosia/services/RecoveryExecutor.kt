package pos.ambrosia.services

import pos.ambrosia.models.RecoveryAction
import pos.ambrosia.models.RecoveryActionResponse
import pos.ambrosia.models.RecoveryCapability
import pos.ambrosia.models.RecoveryExecutionOutcome
import pos.ambrosia.models.RecoveryExecutionResult

interface RecoveryExecutor {
    val id: String

    fun capabilities(): Map<RecoveryAction, RecoveryCapability>

    suspend fun execute(action: RecoveryAction): RecoveryExecutionResult

    fun reconcile(action: RecoveryActionResponse): RecoveryExecutionResult =
        RecoveryExecutionResult(
            outcome = RecoveryExecutionOutcome.INTERRUPTED,
            code = "backend_restarted",
            message = "Recovery execution was interrupted when the Ambrosia backend restarted",
        )
}

class UnsupportedRecoveryExecutor(
    private val reason: String = "unsupported_environment",
) : RecoveryExecutor {
    override val id = "unsupported"

    override fun capabilities(): Map<RecoveryAction, RecoveryCapability> =
        RecoveryAction.entries.associateWith { RecoveryCapability(available = false, reason = reason) }

    override suspend fun execute(action: RecoveryAction): RecoveryExecutionResult =
        RecoveryExecutionResult(RecoveryExecutionOutcome.FAILED, "unsupported_action")
}
