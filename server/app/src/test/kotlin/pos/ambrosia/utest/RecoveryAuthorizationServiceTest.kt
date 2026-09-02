package pos.ambrosia.utest

import org.junit.Test
import pos.ambrosia.models.RecoveryAction
import pos.ambrosia.services.RecoveryAuthorizationException
import pos.ambrosia.services.RecoveryAuthorizationService
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class RecoveryAuthorizationServiceTest {
    @Test
    fun `authorization is single use and bound to actor and action`() {
        val service = RecoveryAuthorizationService()
        val authorization = service.issue("actor-1", RecoveryAction.RESTART_LIGHTNING)

        val wrongAction =
            assertFailsWith<RecoveryAuthorizationException> {
                service.consume(authorization.token, "actor-1", RecoveryAction.REBOOT_DEVICE)
            }
        assertEquals("invalid_recovery_authorization", wrongAction.code)

        val replay =
            assertFailsWith<RecoveryAuthorizationException> {
                service.consume(authorization.token, "actor-1", RecoveryAction.RESTART_LIGHTNING)
            }
        assertEquals("invalid_recovery_authorization", replay.code)
    }

    @Test
    fun `valid authorization can be consumed exactly once`() {
        val service = RecoveryAuthorizationService()
        val authorization = service.issue("actor-1", RecoveryAction.RESTART_AMBROSIA)

        service.consume(authorization.token, "actor-1", RecoveryAction.RESTART_AMBROSIA)

        assertFailsWith<RecoveryAuthorizationException> {
            service.consume(authorization.token, "actor-1", RecoveryAction.RESTART_AMBROSIA)
        }
    }

    @Test
    fun `authorization cannot be used by a different actor`() {
        val service = RecoveryAuthorizationService()
        val authorization = service.issue("actor-1", RecoveryAction.RESTART_AMBROSIA)

        val error =
            assertFailsWith<RecoveryAuthorizationException> {
                service.consume(authorization.token, "actor-2", RecoveryAction.RESTART_AMBROSIA)
            }

        assertEquals("invalid_recovery_authorization", error.code)
    }

    @Test
    fun `expired authorization is rejected`() {
        val clock = MutableClock(Instant.parse("2026-09-02T12:00:00Z"))
        val service = RecoveryAuthorizationService(clock, Duration.ofSeconds(30))
        val authorization = service.issue("actor-1", RecoveryAction.SHUTDOWN_DEVICE)
        clock.current = clock.current.plusSeconds(31)

        val error =
            assertFailsWith<RecoveryAuthorizationException> {
                service.consume(authorization.token, "actor-1", RecoveryAction.SHUTDOWN_DEVICE)
            }
        assertEquals("expired_recovery_authorization", error.code)
    }
}

private class MutableClock(
    var current: Instant,
    private val zone: ZoneId = ZoneId.of("UTC"),
) : Clock() {
    override fun getZone(): ZoneId = zone

    override fun withZone(zone: ZoneId): Clock = MutableClock(current, zone)

    override fun instant(): Instant = current
}
