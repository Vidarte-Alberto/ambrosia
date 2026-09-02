package pos.ambrosia.services

import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

interface RecoveryAuthorizationRateLimiter {
    fun retryAfterSeconds(actorUserId: String): Long

    fun recordFailure(actorUserId: String): Long

    fun reset(actorUserId: String)
}

class InMemoryRecoveryAuthorizationRateLimiter(
    private val clock: Clock = Clock.systemUTC(),
    private val freeAttempts: Int = 5,
    private val baseDelay: Duration = Duration.ofMinutes(1),
    private val maximumDelay: Duration = Duration.ofHours(1),
) : RecoveryAuthorizationRateLimiter {
    private data class AttemptState(
        val failures: Int,
        val blockedUntil: Instant,
    )

    private val attempts = ConcurrentHashMap<String, AttemptState>()

    init {
        require(freeAttempts >= 0) { "freeAttempts must not be negative" }
        require(!baseDelay.isNegative && !baseDelay.isZero) { "baseDelay must be positive" }
        require(maximumDelay >= baseDelay) { "maximumDelay must be at least baseDelay" }
    }

    override fun retryAfterSeconds(actorUserId: String): Long {
        val state = attempts[actorUserId] ?: return 0
        return remainingSeconds(state.blockedUntil)
    }

    override fun recordFailure(actorUserId: String): Long {
        val now = clock.instant()
        val state =
            attempts.compute(actorUserId) { _, current ->
                val failures = (current?.failures ?: 0) + 1
                val delay = delayFor(failures)
                AttemptState(failures, now.plus(delay))
            } ?: return 0
        return remainingSeconds(state.blockedUntil)
    }

    override fun reset(actorUserId: String) {
        attempts.remove(actorUserId)
    }

    private fun delayFor(failures: Int): Duration {
        if (failures <= freeAttempts) return Duration.ZERO
        val exponent = (failures - freeAttempts - 1).coerceAtMost(30)
        val multiplier = 1L shl exponent
        val delay = baseDelay.multipliedBy(multiplier)
        return if (delay > maximumDelay) maximumDelay else delay
    }

    private fun remainingSeconds(blockedUntil: Instant): Long {
        val remainingMillis = Duration.between(clock.instant(), blockedUntil).toMillis()
        return if (remainingMillis <= 0) 0 else (remainingMillis + 999) / 1_000
    }
}
