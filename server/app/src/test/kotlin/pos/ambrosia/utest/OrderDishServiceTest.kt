package pos.ambrosia.utest

import kotlinx.coroutines.runBlocking
import org.mockito.ArgumentMatchers.contains
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import pos.ambrosia.models.OrderDish
import pos.ambrosia.services.OrderDishService
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class OrderDishServiceTest {
    private val mockConnection: Connection = mock()
    private val mockStatement: PreparedStatement = mock()
    private val mockResultSet: ResultSet = mock()

    @Test
    fun `getOrderDishesByOrderId returns list of dishes when found`() {
        runBlocking {
            val orderDish1 =
                OrderDish(
                    id = "od1",
                    orderId = "order123",
                    dishId = "dish1",
                    priceAtOrder = 50.00,
                    notes = "Extra spicy",
                    status = "PENDING",
                    shouldPrepare = true,
                ) // Arrange
            val orderDish2 =
                OrderDish(
                    id = "od2",
                    orderId = "order123",
                    dishId = "dish2",
                    priceAtOrder = 100.00,
                    notes = "No onion",
                    status = "PENDING",
                    shouldPrepare = true,
                ) // Arrange
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet) // Arrange
            whenever(mockResultSet.next()).thenReturn(true).thenReturn(true).thenReturn(false) // Arrange
            whenever(mockResultSet.getString("id")).thenReturn(orderDish1.id).thenReturn(orderDish2.id) // Arrange
            whenever(mockResultSet.getString("order_id")).thenReturn(orderDish1.orderId).thenReturn(orderDish2.orderId) // Arrange
            whenever(mockResultSet.getString("dish_id")).thenReturn(orderDish1.dishId).thenReturn(orderDish2.dishId) // Arrange
            whenever(mockResultSet.getDouble("price_at_order")).thenReturn(orderDish1.priceAtOrder).thenReturn(orderDish2.priceAtOrder)
            whenever(mockResultSet.getString("notes")).thenReturn(orderDish1.notes).thenReturn(orderDish2.notes) // Arrange
            whenever(mockResultSet.getString("status")).thenReturn(orderDish1.status).thenReturn(orderDish2.status) // Arrange
            whenever(mockResultSet.getBoolean("should_prepare")).thenReturn(orderDish1.shouldPrepare).thenReturn(orderDish2.shouldPrepare)
            val service = OrderDishService(mockConnection) // Arrange
            val result = service.getOrderDishesByOrderId("order123") // Act
            assertEquals(2, result.size) // Assert
            assertEquals("dish1", result[0].dishId) // Assert
        }
    }

    @Test
    fun `getOrderDishesByOrderId returns empty list when none found`() {
        runBlocking {
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet) // Arrange
            whenever(mockResultSet.next()).thenReturn(false) // Arrange
            val service = OrderDishService(mockConnection) // Arrange
            val result = service.getOrderDishesByOrderId("od1") // Act
            assertTrue(result.isEmpty()) // Assert
        }
    }

    @Test
    fun `getOrderDishById returns dish when found`() {
        runBlocking {
            val expectedOrderDish =
                OrderDish(orderId = "od1", dishId = "dish1", priceAtOrder = 50.00, status = "PENDING", shouldPrepare = true) // Arrange
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet) // Arrange
            whenever(mockResultSet.next()).thenReturn(true) // Arrange
            whenever(mockResultSet.getString("order_id")).thenReturn(expectedOrderDish.orderId) // Arrange
            whenever(mockResultSet.getString("dish_id")).thenReturn(expectedOrderDish.dishId) // Arrange
            whenever(mockResultSet.getDouble("price_at_order")).thenReturn(expectedOrderDish.priceAtOrder) // Arrange
            whenever(mockResultSet.getString("status")).thenReturn(expectedOrderDish.status) // Arrange
            whenever(mockResultSet.getBoolean("should_prepare")).thenReturn(expectedOrderDish.shouldPrepare) // Arrange
            val service = OrderDishService(mockConnection) // Arrange
            val result = service.getOrderDishById("od1") // Act
            assertNotNull(result) // Assert
            assertEquals(expectedOrderDish, result) // Assert
        }
    }

    @Test
    fun `getOrderDishById returns null when none found`() {
        runBlocking {
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet) // Arrange
            whenever(mockResultSet.next()).thenReturn(false) // Arrange
            val service = OrderDishService(mockConnection) // Arrange
            val result = service.getOrderDishById("not-found") // Act
            assertNull(result) // Assert
        }
    }

    @Test
    fun `addOrderDish returns null if order id not found`() {
        runBlocking {
            val orderDish =
                OrderDish(
                    id = "non-existing-id",
                    orderId = "order123",
                    dishId = "dish1",
                    priceAtOrder = 50.00,
                    notes = "Extra spicy",
                    status = "PENDING",
                    shouldPrepare = true,
                ) // Arrange
            whenever(mockConnection.prepareStatement(contains("SELECT id FROM orders WHERE id = ?"))).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet) // Arrange
            whenever(mockResultSet.next()).thenReturn(false) // Arrange
            val service = OrderDishService(mockConnection) // Arrange
            val result = service.addOrderDish(orderDish) // Act
            assertNull(result) // Assert
        }
    }

    @Test
    fun `addOrderDish returns null if dish id not found`() {
        runBlocking {
            val orderDish =
                OrderDish(
                    id = "od1",
                    orderId = "order123",
                    dishId = "dish-not-found",
                    priceAtOrder = 50.00,
                    notes = "Extra spicy",
                    status = "PENDING",
                    shouldPrepare = true,
                ) // Arrange
            val orderCheckStatement: PreparedStatement = mock() // Arrange
            val dishCheckStatement: PreparedStatement = mock() // Arrange
            whenever(mockConnection.prepareStatement(contains("FROM orders"))).thenReturn(orderCheckStatement) // Arrange
            whenever(mockConnection.prepareStatement(contains("FROM dishes"))).thenReturn(dishCheckStatement) // Arrange
            val orderResultSet: ResultSet = mock() // Arrange
            whenever(orderResultSet.next()).thenReturn(true) // Arrange
            whenever(orderCheckStatement.executeQuery()).thenReturn(orderResultSet) // Arrange
            val dishResultSet: ResultSet = mock() // Arrange
            whenever(dishResultSet.next()).thenReturn(false) // Arrange
            whenever(dishCheckStatement.executeQuery()).thenReturn(dishResultSet) // Arrange
            val service = OrderDishService(mockConnection) // Arrange
            val result = service.addOrderDish(orderDish) // Act
            assertNull(result) // Assert
        }
    }

    @Test
    fun `addOrderDish returns new ID on success`() {
        runBlocking {
            val orderDish =
                OrderDish(
                    id = "od1",
                    orderId = "order123",
                    dishId = "dish1",
                    priceAtOrder = 50.00,
                    notes = "Extra spicy",
                    status = "PENDING",
                    shouldPrepare = true,
                ) // Arrange
            val orderCheckStatement: PreparedStatement = mock() // Arrange
            val dishCheckStatement: PreparedStatement = mock() // Arrange
            val addOrderDishStatement: PreparedStatement = mock() // Arrange
            whenever(mockConnection.prepareStatement(contains("FROM orders"))).thenReturn(orderCheckStatement) // Arrange
            whenever(mockConnection.prepareStatement(contains("FROM dishes"))).thenReturn(dishCheckStatement) // Arrange
            whenever(mockConnection.prepareStatement(contains("INSERT INTO"))).thenReturn(addOrderDishStatement) // Arrange
            val orderResultSet: ResultSet = mock() // Arrange
            whenever(orderResultSet.next()).thenReturn(true) // Arrange
            whenever(orderCheckStatement.executeQuery()).thenReturn(orderResultSet) // Arrange
            val dishResultSet: ResultSet = mock() // Arrange
            whenever(dishResultSet.next()).thenReturn(true) // Arrange
            whenever(dishCheckStatement.executeQuery()).thenReturn(dishResultSet) // Arrange
            whenever(addOrderDishStatement.executeUpdate()).thenReturn(1) // Arrange
            val service = OrderDishService(mockConnection) // Arrange
            val result = service.addOrderDish(orderDish) // Act
            assertNotNull(result) // Assert
        }
    }

    @Test
    fun `addOrderDish returns null when database insert fails`() {
        runBlocking {
            val orderDish =
                OrderDish(
                    id = "od1",
                    orderId = "order123",
                    dishId = "dish1",
                    priceAtOrder = 50.00,
                    notes = "Extra spicy",
                    status = "PENDING",
                    shouldPrepare = true,
                ) // Arrange
            val orderCheckStatement: PreparedStatement = mock() // Arrange
            val dishCheckStatement: PreparedStatement = mock() // Arrange
            val addOrderDishStatement: PreparedStatement = mock() // Arrange
            whenever(mockConnection.prepareStatement(contains("FROM orders"))).thenReturn(orderCheckStatement) // Arrange
            whenever(mockConnection.prepareStatement(contains("FROM dishes"))).thenReturn(dishCheckStatement) // Arrange
            whenever(mockConnection.prepareStatement(contains("INSERT INTO"))).thenReturn(addOrderDishStatement) // Arrange
            val orderResultSet: ResultSet = mock() // Arrange
            whenever(orderResultSet.next()).thenReturn(true) // Arrange
            whenever(orderCheckStatement.executeQuery()).thenReturn(orderResultSet) // Arrange
            val dishResultSet: ResultSet = mock() // Arrange
            whenever(dishResultSet.next()).thenReturn(true) // Arrange
            whenever(dishCheckStatement.executeQuery()).thenReturn(dishResultSet) // Arrange
            whenever(addOrderDishStatement.executeUpdate()).thenReturn(0) // Arrange
            val service = OrderDishService(mockConnection) // Arrange
            val result = service.addOrderDish(orderDish) // Act
            assertNull(result) // Assert
        }
    }

    @Test
    fun `updateOrderDish returns false if ID is null`() {
        runBlocking {
            val orderDish =
                OrderDish(
                    id = null,
                    orderId = "order123",
                    dishId = "dish1",
                    priceAtOrder = 50.00,
                    notes = "Extra spicy",
                    status = "PENDING",
                    shouldPrepare = true,
                ) // Arrange
            val service = OrderDishService(mockConnection) // Arrange
            val result = service.updateOrderDish(orderDish) // Act
            assertFalse(result) // Assert
            verify(mockConnection, never()).prepareStatement(any()) // Assert
        }
    }

    @Test
    fun `updateOrderDish returns true on success`() {
        runBlocking {
            val orderDish =
                OrderDish(
                    id = "od1",
                    orderId = "order123",
                    dishId = "dish1",
                    priceAtOrder = 55.00,
                    notes = "No spicy",
                    status = "COOKING",
                    shouldPrepare = false,
                ) // Arrange
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeUpdate()).thenReturn(1) // Arrange
            val service = OrderDishService(mockConnection) // Arrange
            val result = service.updateOrderDish(orderDish) // Act
            assertTrue(result) // Assert
        }
    }

    @Test
    fun `updateOrderDish returns false when order dish not found`() {
        runBlocking {
            val orderDish =
                OrderDish(
                    id = "not-found-od",
                    orderId = "order123",
                    dishId = "dish1",
                    priceAtOrder = 50.00,
                    notes = "Extra spicy",
                    status = "PENDING",
                    shouldPrepare = true,
                ) // Arrange
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeUpdate()).thenReturn(0) // Arrange
            val service = OrderDishService(mockConnection) // Arrange
            val result = service.updateOrderDish(orderDish) // Act
            assertFalse(result) // Assert
        }
    }

    @Test
    fun `deleteOrderDish returns true on success`() {
        runBlocking {
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeUpdate()).thenReturn(1) // Arrange
            val service = OrderDishService(mockConnection) // Arrange
            val result = service.deleteOrderDish("od1") // Act
            assertTrue(result) // Assert
        }
    }

    @Test
    fun `deleteOrderDish returns false when order dish not found`() {
        runBlocking {
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeUpdate()).thenReturn(0) // Arrange
            val service = OrderDishService(mockConnection) // Arrange
            val result = service.deleteOrderDish("not-found-od") // Act
            assertFalse(result) // Assert
        }
    }

    @Test
    fun `deleteOrderDishesByOrderId returns true on success`() {
        runBlocking {
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeUpdate()).thenReturn(3) // Arrange: Simulate 3 rows deleted
            val service = OrderDishService(mockConnection) // Arrange
            val result = service.deleteOrderDishesByOrderId("order-123") // Act
            assertTrue(result) // Assert
        }
    }

    @Test
    fun `checkOrderDishStatus returns true when status matches`() {
        runBlocking {
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet) // Arrange
            whenever(mockResultSet.next()).thenReturn(true) // Arrange
            val service = OrderDishService(mockConnection) // Arrange
            val result = service.checkOrderDishStatus("od1", "PENDING") // Act
            assertTrue(result) // Assert
        }
    }

    @Test
    fun `checkOrderDishStatus returns false when status does not match`() {
        runBlocking {
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet) // Arrange
            whenever(mockResultSet.next()).thenReturn(false) // Arrange
            val service = OrderDishService(mockConnection) // Arrange
            val result = service.checkOrderDishStatus("od1", "COOKING") // Act
            assertFalse(result) // Assert
        }
    }
}
