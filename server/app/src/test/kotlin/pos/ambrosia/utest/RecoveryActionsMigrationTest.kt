package pos.ambrosia.utest

import org.junit.Test
import java.nio.file.Files
import java.sql.DriverManager
import java.sql.SQLException
import kotlin.io.path.deleteIfExists
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class RecoveryActionsMigrationTest {
    @Test
    fun `V48 creates audit storage and enforces one active action`() {
        val databasePath = Files.createTempFile("ambrosia-recovery-migration-test", ".db")
        try {
            DriverManager.getConnection("jdbc:sqlite:$databasePath").use { connection ->
                connection.createStatement().use { statement ->
                    statement.execute("PRAGMA foreign_keys = ON")
                    statement.execute("CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL)")
                    statement.execute("INSERT INTO users (id) VALUES ('actor-1')")
                    val migration =
                        checkNotNull(javaClass.classLoader.getResource("db/migration/V48__add_recovery_actions.sql"))
                            .readText()
                    migration
                        .split(';')
                        .map(String::trim)
                        .filter(String::isNotEmpty)
                        .forEach(statement::execute)

                    val columns =
                        statement.executeQuery("PRAGMA table_info('recovery_actions')").use { resultSet ->
                            buildList {
                                while (resultSet.next()) add(resultSet.getString("name"))
                            }
                        }
                    assertTrue(
                        columns.containsAll(
                            listOf(
                                "actor_user_id",
                                "action",
                                "status",
                                "requested_at",
                                "started_at",
                                "completed_at",
                                "result_code",
                                "result_message",
                                "executor",
                            ),
                        ),
                    )

                    statement.execute(activeActionInsert("action-1"))
                    assertFailsWith<SQLException> { statement.execute(activeActionInsert("action-2")) }
                    statement.execute("UPDATE recovery_actions SET status = 'SUCCEEDED' WHERE id = 'action-1'")
                    assertEquals(1, statement.executeUpdate(activeActionInsert("action-2")))
                }
            }
        } finally {
            databasePath.deleteIfExists()
        }
    }

    private fun activeActionInsert(id: String): String =
        """
        INSERT INTO recovery_actions
        (id, actor_user_id, action, status, requested_at, executor)
        VALUES ('$id', 'actor-1', 'RESTART_LIGHTNING', 'RUNNING', '2026-09-02T12:00:00Z', 'fake')
        """.trimIndent()
}
