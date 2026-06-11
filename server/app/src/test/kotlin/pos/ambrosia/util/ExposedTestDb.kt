package pos.ambrosia.util

import org.jetbrains.exposed.v1.core.dao.id.EntityID
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.SchemaUtils
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import pos.ambrosia.db.tables.RoleEntity
import pos.ambrosia.db.tables.RolesTable
import pos.ambrosia.db.tables.UserEntity
import pos.ambrosia.db.tables.UsersTable
import java.io.File
import java.util.UUID

/** Helper for unit tests that exercise services backed by Exposed `transaction { }` blocks. */
object ExposedTestDb {
    fun connect(): File {
        val file = File.createTempFile("ambrosia-test", ".db")
        file.deleteOnExit()
        Database.connect("jdbc:sqlite:${file.absolutePath}", driver = "org.sqlite.JDBC")
        transaction {
            SchemaUtils.create(UsersTable, RolesTable)
        }
        return file
    }

    fun cleanup(file: File) {
        transaction {
            SchemaUtils.drop(UsersTable, RolesTable)
        }
        file.delete()
    }

    fun seedRole(
        role: String,
        isAdmin: Boolean = false,
    ): String =
        transaction {
            RoleEntity
                .new(UUID.randomUUID()) {
                    this.role = role
                    this.isAdmin = isAdmin
                }.id.value
                .toString()
        }

    fun seedUser(
        name: String,
        roleId: String? = null,
    ): String =
        transaction {
            UserEntity
                .new(UUID.randomUUID()) {
                    this.name = name
                    this.pin = "****"
                    this.roleId = roleId?.let { EntityID(UUID.fromString(it), RolesTable) }
                }.id.value
                .toString()
        }
}
