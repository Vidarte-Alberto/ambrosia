package pos.ambrosia.utest

import kotlinx.coroutines.runBlocking
import org.mockito.ArgumentMatchers.contains
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import pos.ambrosia.models.TicketPayment
import pos.ambrosia.services.TicketPaymentService
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class TicketPaymentServiceTest {
    private val mockConnection: Connection = mock()
    private val mockStatement: PreparedStatement = mock()
    private val mockResultSet: ResultSet = mock()

    @Test
    fun `getTicketPaymentsByTicket returns list of payments when found`() {
        runBlocking {
            val ticketCheckStatement: PreparedStatement = mock() // Arrange
            val ticketResultSet: ResultSet = mock() // Arrange
            whenever(mockConnection.prepareStatement(contains("tickets"))).thenReturn(ticketCheckStatement) // Arrange
            whenever(ticketCheckStatement.executeQuery()).thenReturn(ticketResultSet) // Arrange
            whenever(ticketResultSet.next()).thenReturn(true) // Arrange

            whenever(mockConnection.prepareStatement(contains("FROM ticket_payments WHERE ticket_id = ?"))).thenReturn(mockStatement)
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet) // Arrange
            whenever(mockResultSet.next()).thenReturn(true).thenReturn(true).thenReturn(false) // Arrange
            whenever(mockResultSet.getString("payment_id")).thenReturn("pay-1").thenReturn("pay-2") // Arrange
            whenever(mockResultSet.getString("ticket_id")).thenReturn("ticket-1").thenReturn("ticket-1") // Arrange
            val service = TicketPaymentService(mockConnection) // Arrange
            val result = service.getTicketPaymentsByTicket("ticket-1") // Act
            assertNotNull(result) // Assert
            assertEquals(2, result.size) // Assert
            assertEquals("pay-1", result[0].paymentId) // Assert
        }
    }

    @Test
    fun `getTicketPaymentsByTicket returns empty list when none found`() {
        runBlocking {
            val ticketCheckStatement: PreparedStatement = mock() // Arrange
            val ticketResultSet: ResultSet = mock() // Arrange
            whenever(mockConnection.prepareStatement(contains("tickets"))).thenReturn(ticketCheckStatement) // Arrange
            whenever(ticketCheckStatement.executeQuery()).thenReturn(ticketResultSet) // Arrange
            whenever(ticketResultSet.next()).thenReturn(true) // Arrange

            whenever(mockConnection.prepareStatement(contains("FROM ticket_payments WHERE ticket_id = ?"))).thenReturn(mockStatement)
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet) // Arrange
            whenever(mockResultSet.next()).thenReturn(false) // Arrange
            val service = TicketPaymentService(mockConnection) // Arrange
            val result = service.getTicketPaymentsByTicket("ticket-2") // Act
            assertNotNull(result) // Assert
            assertTrue(result.isEmpty()) // Assert
        }
    }

    @Test
    fun `getTicketPaymentsByTicket returns null when ticket not found`() {
        runBlocking {
            val ticketCheckStatement: PreparedStatement = mock() // Arrange
            val ticketResultSet: ResultSet = mock() // Arrange
            whenever(mockConnection.prepareStatement(contains("tickets"))).thenReturn(ticketCheckStatement) // Arrange
            whenever(ticketCheckStatement.executeQuery()).thenReturn(ticketResultSet) // Arrange
            whenever(ticketResultSet.next()).thenReturn(false) // Arrange

            val service = TicketPaymentService(mockConnection) // Arrange
            val result = service.getTicketPaymentsByTicket("not-found") // Act
            assertTrue(result == null) // Assert
        }
    }

    @Test
    fun `getTicketPaymentsByPayment returns list of tickets when found`() {
        runBlocking {
            val paymentCheckStatement: PreparedStatement = mock() // Arrange
            val paymentResultSet: ResultSet = mock() // Arrange
            whenever(mockConnection.prepareStatement(contains("payments"))).thenReturn(paymentCheckStatement) // Arrange
            whenever(paymentCheckStatement.executeQuery()).thenReturn(paymentResultSet) // Arrange
            whenever(paymentResultSet.next()).thenReturn(true) // Arrange

            whenever(mockConnection.prepareStatement(contains("FROM ticket_payments WHERE payment_id = ?"))).thenReturn(mockStatement)
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet) // Arrange
            whenever(mockResultSet.next()).thenReturn(true).thenReturn(true).thenReturn(false) // Arrange
            whenever(mockResultSet.getString("payment_id")).thenReturn("pay-1").thenReturn("pay-1") // Arrange
            whenever(mockResultSet.getString("ticket_id")).thenReturn("ticket-1").thenReturn("ticket-2") // Arrange
            val service = TicketPaymentService(mockConnection) // Arrange
            val result = service.getTicketPaymentsByPayment("pay-1") // Act
            assertNotNull(result) // Assert
            assertEquals(2, result.size) // Assert
            assertEquals("ticket-1", result[0].ticketId) // Assert
        }
    }

    @Test
    fun `getTicketPaymentsByPayment returns empty list when none found`() {
        runBlocking {
            val paymentCheckStatement: PreparedStatement = mock() // Arrange
            val paymentResultSet: ResultSet = mock() // Arrange
            whenever(mockConnection.prepareStatement(contains("payments"))).thenReturn(paymentCheckStatement) // Arrange
            whenever(paymentCheckStatement.executeQuery()).thenReturn(paymentResultSet) // Arrange
            whenever(paymentResultSet.next()).thenReturn(true) // Arrange

            whenever(mockConnection.prepareStatement(contains("FROM ticket_payments WHERE payment_id = ?"))).thenReturn(mockStatement)
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet) // Arrange
            whenever(mockResultSet.next()).thenReturn(false) // Arrange
            val service = TicketPaymentService(mockConnection) // Arrange
            val result = service.getTicketPaymentsByPayment("pay-2") // Act
            assertNotNull(result) // Assert
            assertTrue(result.isEmpty()) // Assert
        }
    }

    @Test
    fun `getTicketPaymentsByPayment returns null when payment not found`() {
        runBlocking {
            val paymentCheckStatement: PreparedStatement = mock() // Arrange
            val paymentResultSet: ResultSet = mock() // Arrange
            whenever(mockConnection.prepareStatement(contains("payments"))).thenReturn(paymentCheckStatement) // Arrange
            whenever(paymentCheckStatement.executeQuery()).thenReturn(paymentResultSet) // Arrange
            whenever(paymentResultSet.next()).thenReturn(false) // Arrange

            val service = TicketPaymentService(mockConnection) // Arrange
            val result = service.getTicketPaymentsByPayment("not-found") // Act
            assertTrue(result == null) // Assert
        }
    }

    @Test
    fun `addTicketPayment returns false if paymentId is blank`() {
        runBlocking {
            val ticketPayment = TicketPayment(paymentId = "", ticketId = "ticket-1") // Arrange
            val service = TicketPaymentService(mockConnection) // Arrange
            val result = service.addTicketPayment(ticketPayment) // Act
            assertFalse(result) // Assert
            verify(mockConnection, never()).prepareStatement(any()) // Assert
        }
    }

    @Test
    fun `addTicketPayment returns false if ticketId is blank`() {
        runBlocking {
            val ticketPayment = TicketPayment(paymentId = "pay-1", ticketId = "") // Arrange
            val service = TicketPaymentService(mockConnection) // Arrange
            val result = service.addTicketPayment(ticketPayment) // Act
            assertFalse(result) // Assert
            verify(mockConnection, never()).prepareStatement(any()) // Assert
        }
    }

    @Test
    fun `addTicketPayment returns false if ticketId does not exist`() {
        runBlocking {
            val ticketPayment = TicketPayment(paymentId = "pay-1", ticketId = "non-existent-ticket") // Arrange
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet) // Arrange
            whenever(mockResultSet.next()).thenReturn(false) // Arrange
            val service = TicketPaymentService(mockConnection) // Arrange
            val result = service.addTicketPayment(ticketPayment) // Act
            assertFalse(result) // Assert
        }
    }

    @Test
    fun `addTicketPayment returns false if paymentId does not exist`() {
        runBlocking {
            val ticketPayment = TicketPayment(paymentId = "non-existent-pay", ticketId = "ticket-1") // Arrange
            val ticketCheckStatement: PreparedStatement = mock() // Arrange
            val paymentCheckStatement: PreparedStatement = mock() // Arrange
            whenever(mockConnection.prepareStatement(contains("tickets"))).thenReturn(ticketCheckStatement) // Arrange
            whenever(mockConnection.prepareStatement(contains("payments"))).thenReturn(paymentCheckStatement) // Arrange
            val ticketResultSet: ResultSet = mock() // Arrange
            whenever(ticketResultSet.next()).thenReturn(true) // Arrange
            whenever(ticketCheckStatement.executeQuery()).thenReturn(ticketResultSet) // Arrange
            val paymentResultSet: ResultSet = mock() // Arrange
            whenever(paymentResultSet.next()).thenReturn(false) // Arrange
            whenever(paymentCheckStatement.executeQuery()).thenReturn(paymentResultSet) // Arrange
            val service = TicketPaymentService(mockConnection) // Arrange
            val result = service.addTicketPayment(ticketPayment) // Act
            assertFalse(result) // Assert
        }
    }

    @Test
    fun `addTicketPayment returns true on success`() {
        runBlocking {
            val ticketPayment = TicketPayment(paymentId = "pay-1", ticketId = "ticket-1") // Arrange
            val ticketCheckStatement: PreparedStatement = mock() // Arrange
            val paymentCheckStatement: PreparedStatement = mock() // Arrange
            val addStatement: PreparedStatement = mock() // Arrange
            whenever(mockConnection.prepareStatement(contains("tickets"))).thenReturn(ticketCheckStatement) // Arrange
            whenever(mockConnection.prepareStatement(contains("payments"))).thenReturn(paymentCheckStatement) // Arrange
            whenever(mockConnection.prepareStatement(contains("INSERT INTO"))).thenReturn(addStatement) // Arrange
            val ticketResultSet: ResultSet = mock() // Arrange
            whenever(ticketResultSet.next()).thenReturn(true) // Arrange
            whenever(ticketCheckStatement.executeQuery()).thenReturn(ticketResultSet) // Arrange
            val paymentResultSet: ResultSet = mock() // Arrange
            whenever(paymentResultSet.next()).thenReturn(true) // Arrange
            whenever(paymentCheckStatement.executeQuery()).thenReturn(paymentResultSet) // Arrange
            whenever(addStatement.executeUpdate()).thenReturn(1) // Arrange
            val service = TicketPaymentService(mockConnection) // Arrange
            val result = service.addTicketPayment(ticketPayment) // Act
            assertTrue(result) // Assert
        }
    }

    @Test
    fun `addTicketPayment returns false when database insert fails`() {
        runBlocking {
            val ticketPayment = TicketPayment(paymentId = "pay-1", ticketId = "ticket-1") // Arrange
            val ticketCheckStatement: PreparedStatement = mock() // Arrange
            val paymentCheckStatement: PreparedStatement = mock() // Arrange
            val addStatement: PreparedStatement = mock() // Arrange
            whenever(mockConnection.prepareStatement(contains("tickets"))).thenReturn(ticketCheckStatement) // Arrange
            whenever(mockConnection.prepareStatement(contains("payments"))).thenReturn(paymentCheckStatement) // Arrange
            whenever(mockConnection.prepareStatement(contains("INSERT INTO"))).thenReturn(addStatement) // Arrange
            val ticketResultSet: ResultSet = mock() // Arrange
            whenever(ticketResultSet.next()).thenReturn(true) // Arrange
            whenever(ticketCheckStatement.executeQuery()).thenReturn(ticketResultSet) // Arrange
            val paymentResultSet: ResultSet = mock() // Arrange
            whenever(paymentResultSet.next()).thenReturn(true) // Arrange
            whenever(paymentCheckStatement.executeQuery()).thenReturn(paymentResultSet) // Arrange
            whenever(addStatement.executeUpdate()).thenReturn(0) // Arrange
            val service = TicketPaymentService(mockConnection) // Arrange
            val result = service.addTicketPayment(ticketPayment) // Act
            assertFalse(result) // Assert
        }
    }

    @Test
    fun `deleteTicketPayment returns true on success`() {
        runBlocking {
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeUpdate()).thenReturn(1) // Arrange
            val service = TicketPaymentService(mockConnection) // Arrange
            val result = service.deleteTicketPayment("pay-1", "ticket-1") // Act
            assertTrue(result) // Assert
        }
    }

    @Test
    fun `deleteTicketPayment returns false when record not found`() {
        runBlocking {
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeUpdate()).thenReturn(0) // Arrange
            val service = TicketPaymentService(mockConnection) // Arrange
            val result = service.deleteTicketPayment("pay-1", "not-found-ticket") // Act
            assertFalse(result) // Assert
        }
    }

    @Test
    fun `deleteTicketPaymentsByTicket returns true on success`() {
        runBlocking {
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement) // Arrange
            whenever(mockStatement.executeUpdate()).thenReturn(3) // Arrange
            val service = TicketPaymentService(mockConnection) // Arrange
            val result = service.deleteTicketPaymentsByTicket("ticket-1") // Act
            assertTrue(result) // Assert
        }
    }
}
