package pos.ambrosia.services

import pos.ambrosia.logger
import pos.ambrosia.models.OrderDish
import java.sql.Connection
import java.util.UUID

class OrderDishService(
    private val connection: Connection,
) {
    companion object {
        private const val ADD_ORDER_DISH =
            "INSERT INTO orders_dishes (id, order_id, dish_id, price_at_order, notes, status, should_prepare) VALUES (?, ?, ?, ?, ?, ?, ?)"
        private const val GET_ORDER_DISHES_BY_ORDER =
            "SELECT id, order_id, dish_id, price_at_order, notes, status, should_prepare FROM orders_dishes WHERE order_id = ?"
        private const val GET_ORDER_DISH_BY_ID =
            "SELECT id, order_id, dish_id, price_at_order, notes, status, should_prepare FROM orders_dishes WHERE id = ?"
        private const val UPDATE_ORDER_DISH =
            "UPDATE orders_dishes SET price_at_order = ?, notes = ?, status = ?, should_prepare = ? WHERE id = ?"
        private const val DELETE_ORDER_DISH = "DELETE FROM orders_dishes WHERE id = ?"
        private const val DELETE_ORDER_DISHES_BY_ORDER = "DELETE FROM orders_dishes WHERE order_id = ?"
        private const val CHECK_ORDER_EXISTS = "SELECT id FROM orders WHERE id = ? AND is_deleted = 0"
        private const val CHECK_DISH_EXISTS = "SELECT id FROM dishes WHERE id = ? AND is_deleted = 0"
        private const val CHECK_STATUS = "SELECT id FROM orders_dishes WHERE status = ?"
    }

    private fun orderExists(orderId: String): Boolean {
        val statement = connection.prepareStatement(CHECK_ORDER_EXISTS)
        statement.setString(1, orderId)
        val resultSet = statement.executeQuery()
        return resultSet.next()
    }

    private fun dishExists(dishId: String): Boolean {
        val statement = connection.prepareStatement(CHECK_DISH_EXISTS)
        statement.setString(1, dishId)
        val resultSet = statement.executeQuery()
        return resultSet.next()
    }

    private fun mapResultSetToOrderDish(resultSet: java.sql.ResultSet): OrderDish =
        OrderDish(
            id = resultSet.getString("id"),
            orderId = resultSet.getString("order_id"),
            dishId = resultSet.getString("dish_id"),
            priceAtOrder = resultSet.getDouble("price_at_order"),
            notes = resultSet.getString("notes"),
            status = resultSet.getString("status"),
            shouldPrepare = resultSet.getBoolean("should_prepare"),
        )

    suspend fun addOrderDish(orderDish: OrderDish): String? {
        if (!orderExists(orderDish.orderId)) {
            logger.error("Order does not exist: ${orderDish.orderId}")
            return null
        }

        if (!dishExists(orderDish.dishId)) {
            logger.error("Dish does not exist: ${orderDish.dishId}")
            return null
        }

        val generatedId = UUID.randomUUID().toString()
        val statement = connection.prepareStatement(ADD_ORDER_DISH)

        statement.setString(1, generatedId)
        statement.setString(2, orderDish.orderId)
        statement.setString(3, orderDish.dishId)
        statement.setDouble(4, orderDish.priceAtOrder)
        statement.setString(5, orderDish.notes)
        statement.setString(6, orderDish.status)
        statement.setBoolean(7, orderDish.shouldPrepare)

        val rowsAffected = statement.executeUpdate()

        return if (rowsAffected > 0) {
            logger.info("OrderDish created successfully with ID: $generatedId")
            generatedId
        } else {
            logger.error("Failed to create order dish")
            null
        }
    }

    suspend fun getOrderDishesByOrderId(orderId: String): List<OrderDish> {
        val statement = connection.prepareStatement(GET_ORDER_DISHES_BY_ORDER)
        statement.setString(1, orderId)
        val resultSet = statement.executeQuery()
        val orderDishes = mutableListOf<OrderDish>()
        while (resultSet.next()) {
            orderDishes.add(mapResultSetToOrderDish(resultSet))
        }
        logger.info("Retrieved ${orderDishes.size} dishes for order: $orderId")
        return orderDishes
    }

    suspend fun getOrderDishById(id: String): OrderDish? {
        val statement = connection.prepareStatement(GET_ORDER_DISH_BY_ID)
        statement.setString(1, id)
        val resultSet = statement.executeQuery()
        return if (resultSet.next()) {
            mapResultSetToOrderDish(resultSet)
        } else {
            logger.warn("OrderDish not found with ID: $id")
            null
        }
    }

    suspend fun updateOrderDish(orderDish: OrderDish): Boolean {
        if (orderDish.id == null) {
            logger.error("Cannot update order dish: ID is null")
            return false
        }

        val statement = connection.prepareStatement(UPDATE_ORDER_DISH)
        statement.setDouble(1, orderDish.priceAtOrder)
        statement.setString(2, orderDish.notes)
        statement.setString(3, orderDish.status)
        statement.setBoolean(4, orderDish.shouldPrepare)
        statement.setString(5, orderDish.id)

        val rowsUpdated = statement.executeUpdate()
        if (rowsUpdated > 0) {
            logger.info("OrderDish updated successfully: ${orderDish.id}")
        } else {
            logger.error("Failed to update order dish: ${orderDish.id}")
        }
        return rowsUpdated > 0
    }

    suspend fun deleteOrderDish(id: String): Boolean {
        val statement = connection.prepareStatement(DELETE_ORDER_DISH)
        statement.setString(1, id)
        val rowsDeleted = statement.executeUpdate()

        if (rowsDeleted > 0) {
            logger.info("OrderDish deleted successfully: $id")
        } else {
            logger.error("Failed to delete order dish: $id")
        }
        return rowsDeleted > 0
    }

    suspend fun deleteOrderDishesByOrderId(orderId: String): Boolean {
        val statement = connection.prepareStatement(DELETE_ORDER_DISHES_BY_ORDER)
        statement.setString(1, orderId)
        val rowsDeleted = statement.executeUpdate()

        if (rowsDeleted > 0) {
            logger.info("Deleted $rowsDeleted dishes for order: $orderId")
        } else {
            logger.info("No dishes found for order: $orderId")
        }
        return true
    }

    suspend fun checkOrderDishStatus(
        id: String,
        status: String,
    ): Boolean {
        val statement = connection.prepareStatement(CHECK_STATUS)
        statement.setString(1, status)
        statement.setString(2, id)
        val resultSet = statement.executeQuery()

        return resultSet.next()
    }
}
