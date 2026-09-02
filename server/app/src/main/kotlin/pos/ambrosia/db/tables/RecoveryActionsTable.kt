package pos.ambrosia.db.tables

import org.jetbrains.exposed.v1.core.dao.id.EntityID
import org.jetbrains.exposed.v1.dao.java.UUIDEntity
import org.jetbrains.exposed.v1.dao.java.UUIDEntityClass
import pos.ambrosia.db.SQLiteUUIDTable
import java.util.UUID

object RecoveryActionsTable : SQLiteUUIDTable("recovery_actions") {
    val actorUserId = reference("actor_user_id", UsersTable)
    val action = varchar("action", 50)
    val status = varchar("status", 30)
    val requestedAt = varchar("requested_at", 50)
    val startedAt = varchar("started_at", 50).nullable()
    val completedAt = varchar("completed_at", 50).nullable()
    val resultCode = varchar("result_code", 100).nullable()
    val resultMessage = varchar("result_message", 500).nullable()
    val executorId = varchar("executor", 50)
}

class RecoveryActionEntity(
    id: EntityID<UUID>,
) : UUIDEntity(id) {
    companion object : UUIDEntityClass<RecoveryActionEntity>(RecoveryActionsTable)

    var actorUserId by RecoveryActionsTable.actorUserId
    var action by RecoveryActionsTable.action
    var status by RecoveryActionsTable.status
    var requestedAt by RecoveryActionsTable.requestedAt
    var startedAt by RecoveryActionsTable.startedAt
    var completedAt by RecoveryActionsTable.completedAt
    var resultCode by RecoveryActionsTable.resultCode
    var resultMessage by RecoveryActionsTable.resultMessage
    var executorId by RecoveryActionsTable.executorId
}
