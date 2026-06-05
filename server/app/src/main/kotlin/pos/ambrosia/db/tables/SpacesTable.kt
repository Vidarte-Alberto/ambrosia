package pos.ambrosia.db.tables

import org.jetbrains.exposed.v1.core.dao.id.EntityID
import org.jetbrains.exposed.v1.core.dao.id.java.UUIDTable
import org.jetbrains.exposed.v1.dao.java.UUIDEntity
import org.jetbrains.exposed.v1.dao.java.UUIDEntityClass
import java.util.UUID

object SpacesTable : UUIDTable("spaces") {
    val name = varchar("name", 255).nullable()
    val isDeleted = bool("is_deleted").default(false)
}

class SpaceEntity(id: EntityID<UUID>) : UUIDEntity(id) {
    companion object : UUIDEntityClass<SpaceEntity>(SpacesTable)

    var name by SpacesTable.name
    var isDeleted by SpacesTable.isDeleted
}

object DiningTablesTable : UUIDTable("tables") {
    val name = varchar("name", 255)
    val status = varchar("status", 20).default("available")
    val spaceId = reference("space_id", SpacesTable)
    // orders.table_id creates a circular FK — stored as raw varchar to break the cycle
    val orderId = varchar("order_id", 36).nullable()
    val isDeleted = bool("is_deleted").default(false)
}

class DiningTableEntity(id: EntityID<UUID>) : UUIDEntity(id) {
    companion object : UUIDEntityClass<DiningTableEntity>(DiningTablesTable)

    var name by DiningTablesTable.name
    var status by DiningTablesTable.status
    var spaceId by DiningTablesTable.spaceId
    var orderId by DiningTablesTable.orderId
    var isDeleted by DiningTablesTable.isDeleted
}
