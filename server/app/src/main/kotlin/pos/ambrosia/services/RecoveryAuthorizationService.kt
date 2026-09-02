package pos.ambrosia.services

import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import pos.ambrosia.db.tables.RoleEntity
import pos.ambrosia.db.tables.UserEntity
import pos.ambrosia.models.RecoveryAction
import pos.ambrosia.models.RecoveryAuthorizationResponse
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.Base64
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class RecoveryAuthorizationException(
    val code: String,
) : RuntimeException(code)

private data class RecoveryAuthorizationGrant(
    val actorUserId: String,
    val action: RecoveryAction,
    val expiresAt: Instant,
)

class RecoveryAuthorizationService(
    private val clock: Clock = Clock.systemUTC(),
    private val lifetime: Duration = Duration.ofSeconds(60),
    private val secureRandom: SecureRandom = SecureRandom(),
) {
    private val grants = ConcurrentHashMap<String, RecoveryAuthorizationGrant>()

    fun issue(
        actorUserId: String,
        action: RecoveryAction,
    ): RecoveryAuthorizationResponse {
        removeExpired()
        val tokenBytes = ByteArray(32).also(secureRandom::nextBytes)
        val token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes)
        val expiresAt = clock.instant().plus(lifetime)
        grants[tokenHash(token)] = RecoveryAuthorizationGrant(actorUserId, action, expiresAt)
        return RecoveryAuthorizationResponse(token = token, action = action, expiresAt = expiresAt.toString())
    }

    fun consume(
        token: String,
        actorUserId: String,
        action: RecoveryAction,
    ) {
        if (token.isBlank()) throw RecoveryAuthorizationException("recovery_authorization_required")
        val grant =
            grants.remove(tokenHash(token))
                ?: throw RecoveryAuthorizationException("invalid_recovery_authorization")
        if (!clock.instant().isBefore(grant.expiresAt)) {
            throw RecoveryAuthorizationException("expired_recovery_authorization")
        }
        if (grant.actorUserId != actorUserId || grant.action != action) {
            throw RecoveryAuthorizationException("invalid_recovery_authorization")
        }
    }

    private fun removeExpired() {
        val now = clock.instant()
        grants.entries.removeIf { !now.isBefore(it.value.expiresAt) }
    }

    private fun tokenHash(token: String): String =
        Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(token.toByteArray()))
}

interface RecoveryCredentialVerifier {
    fun isCurrentAdmin(userId: String): Boolean

    fun verifyWalletPassword(
        userId: String,
        password: CharArray,
    ): Boolean
}

class DatabaseRecoveryCredentialVerifier(
    private val authService: AuthService,
) : RecoveryCredentialVerifier {
    override fun isCurrentAdmin(userId: String): Boolean =
        transaction {
            val user =
                runCatching { UserEntity.findById(UUID.fromString(userId)) }
                    .getOrNull()
                    ?.takeIf { !it.isDeleted }
                    ?: return@transaction false
            val role =
                user.roleId
                    ?.let { RoleEntity.findById(it.value) }
                    ?.takeIf { !it.isDeleted }
            role?.isAdmin == true
        }

    override fun verifyWalletPassword(
        userId: String,
        password: CharArray,
    ): Boolean = authService.authenticateByRole(userId, password)
}
