package pos.ambrosia.db.tables

import org.jetbrains.exposed.v1.core.dao.id.EntityID
import org.jetbrains.exposed.v1.core.dao.id.java.UUIDTable
import org.jetbrains.exposed.v1.dao.java.UUIDEntity
import org.jetbrains.exposed.v1.dao.java.UUIDEntityClass
import java.util.UUID

object CategoriesTable : UUIDTable("categories") {
    val name = varchar("name", 255)
    val type = varchar("type", 20)
    val isDeleted = bool("is_deleted").default(false)
}

class CategoryEntity(id: EntityID<UUID>) : UUIDEntity(id) {
    companion object : UUIDEntityClass<CategoryEntity>(CategoriesTable)

    var name by CategoriesTable.name
    var type by CategoriesTable.type
    var isDeleted by CategoriesTable.isDeleted
}
