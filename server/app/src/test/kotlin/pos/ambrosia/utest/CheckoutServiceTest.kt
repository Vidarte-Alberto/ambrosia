package pos.ambrosia.utest

import kotlinx.coroutines.runBlocking
import org.mockito.ArgumentMatchers.contains
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import pos.ambrosia.models.StoreCheckoutItem
import pos.ambrosia.models.StoreCheckoutRequest
import pos.ambrosia.models.phoenix.IncomingPayment
import pos.ambrosia.services.CheckoutResult
import pos.ambrosia.services.CheckoutService
import pos.ambrosia.services.PaymentVerifier
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.SQLException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CheckoutServiceTest {
    private val mockConnection: Connection = mock()
    private val mockStatement: PreparedStatement = mock()
    private val mockResultSet: ResultSet = mock()
    private val mockPaymentVerifier: PaymentVerifier = mock()

    private fun service() = CheckoutService(mockConnection, mockPaymentVerifier)

    private fun validStoreRequest(
        items: List<StoreCheckoutItem> = listOf(StoreCheckoutItem("prod-1", 2, 500)),
        transactionId: String? = null,
        paymentHash: String? = null,
    ) = StoreCheckoutRequest(
        userId = "user-1",
        items = items,
        paymentMethodId = "pm-cash",
        currencyId = "cur-mxn",
        amount = 10.0,
        transactionId = transactionId,
        ticketNotes = "",
        paymentHash = paymentHash,
    )

    private fun incomingPayment(
        paymentHash: String,
        isPaid: Boolean,
    ) = IncomingPayment(
        type = "incoming_payment",
        subType = "lightning",
        paymentHash = paymentHash,
        isPaid = isPaid,
        receivedSat = 0,
        fees = 0,
        createdAt = 0,
    )

    private fun stubNoExistingCheckout() {
        val findStatement: PreparedStatement = mock()
        val findResultSet: ResultSet = mock()
        whenever(mockConnection.prepareStatement(contains("payment_hash = ?"))).thenReturn(findStatement)
        whenever(findStatement.executeQuery()).thenReturn(findResultSet)
        whenever(findResultSet.next()).thenReturn(false)
    }

    private fun setupSuccessfulCheckout(
        orderStatement: PreparedStatement = mock(),
        itemStatement: PreparedStatement = mock(),
        stockStatement: PreparedStatement = mock(),
        ticketStatement: PreparedStatement = mock(),
        paymentStatement: PreparedStatement = mock(),
        ticketPaymentStatement: PreparedStatement = mock(),
    ) {
        whenever(mockConnection.prepareStatement(contains("INSERT INTO orders"))).thenReturn(orderStatement)
        whenever(mockConnection.prepareStatement(contains("INSERT INTO order_products"))).thenReturn(itemStatement)
        whenever(mockConnection.prepareStatement(contains("UPDATE products"))).thenReturn(stockStatement)
        whenever(mockConnection.prepareStatement(contains("INSERT INTO tickets"))).thenReturn(ticketStatement)
        whenever(mockConnection.prepareStatement(contains("INSERT INTO payments"))).thenReturn(paymentStatement)
        whenever(mockConnection.prepareStatement(contains("INSERT INTO ticket_payments"))).thenReturn(ticketPaymentStatement)
        whenever(stockStatement.executeUpdate()).thenReturn(1)
    }

    @Test
    fun `checkout returns Invalid when items list is empty`() {
        runBlocking {
            val result = service().checkout(validStoreRequest(items = emptyList()))
            assertEquals(CheckoutResult.Invalid, result)
            verify(mockConnection, never()).prepareStatement(any())
        }
    }

    @Test
    fun `checkout returns Invalid when any item has quantity zero`() {
        runBlocking {
            val items = listOf(StoreCheckoutItem("prod-1", 0, 500))
            val result = service().checkout(validStoreRequest(items = items))
            assertEquals(CheckoutResult.Invalid, result)
            verify(mockConnection, never()).prepareStatement(any())
        }
    }

    @Test
    fun `checkout returns Invalid when any item has negative quantity`() {
        runBlocking {
            val items = listOf(StoreCheckoutItem("prod-1", -1, 500))
            val result = service().checkout(validStoreRequest(items = items))
            assertEquals(CheckoutResult.Invalid, result)
        }
    }

    @Test
    fun `checkout returns Success with non-null IDs when paymentHash is absent`() {
        runBlocking {
            setupSuccessfulCheckout()
            val result = service().checkout(validStoreRequest())
            assertTrue(result is CheckoutResult.Success)
            assertEquals(false, result.alreadyExisted)
            assertTrue(result.response.orderId.isNotBlank())
            assertTrue(result.response.ticketId.isNotBlank())
            assertTrue(result.response.paymentId.isNotBlank())
            verify(mockPaymentVerifier, never()).getIncomingPayment(any())
        }
    }

    @Test
    fun `checkout returns unique IDs for order, ticket and payment`() {
        runBlocking {
            setupSuccessfulCheckout()
            val result = service().checkout(validStoreRequest()) as CheckoutResult.Success
            val response = result.response
            assertEquals(3, setOf(response.orderId, response.ticketId, response.paymentId).size)
        }
    }

    @Test
    fun `checkout commits transaction on success`() {
        runBlocking {
            setupSuccessfulCheckout()
            service().checkout(validStoreRequest())
            verify(mockConnection).commit()
            verify(mockConnection, never()).rollback()
        }
    }

    @Test
    fun `checkout returns Invalid and rolls back when stock decrement affects 0 rows`() {
        runBlocking {
            val orderStatement: PreparedStatement = mock()
            val itemStatement: PreparedStatement = mock()
            val stockStatement: PreparedStatement = mock()
            whenever(mockConnection.prepareStatement(contains("INSERT INTO orders"))).thenReturn(orderStatement)
            whenever(mockConnection.prepareStatement(contains("INSERT INTO order_products"))).thenReturn(itemStatement)
            whenever(mockConnection.prepareStatement(contains("UPDATE products"))).thenReturn(stockStatement)
            whenever(stockStatement.executeUpdate()).thenReturn(0)
            val result = service().checkout(validStoreRequest())
            assertEquals(CheckoutResult.Invalid, result)
            verify(mockConnection).rollback()
            verify(mockConnection, never()).commit()
        }
    }

    @Test
    fun `checkout rolls back and rethrows on SQL exception`() {
        val orderStatement: PreparedStatement = mock()
        whenever(mockConnection.prepareStatement(contains("INSERT INTO orders"))).thenReturn(orderStatement)
        whenever(orderStatement.executeUpdate()).thenThrow(SQLException("DB error"))
        assertFailsWith<SQLException> {
            runBlocking { service().checkout(validStoreRequest()) }
        }
        verify(mockConnection).rollback()
        verify(mockConnection, never()).commit()
    }

    @Test
    fun `checkout restores autoCommit to previous value after success`() {
        runBlocking {
            whenever(mockConnection.autoCommit).thenReturn(true)
            setupSuccessfulCheckout()
            service().checkout(validStoreRequest())
            verify(mockConnection).autoCommit = false
            verify(mockConnection).autoCommit = true
        }
    }

    @Test
    fun `checkout restores autoCommit after rollback`() {
        whenever(mockConnection.autoCommit).thenReturn(true)
        val orderStatement: PreparedStatement = mock()
        whenever(mockConnection.prepareStatement(contains("INSERT INTO orders"))).thenReturn(orderStatement)
        whenever(orderStatement.executeUpdate()).thenThrow(SQLException("forced"))
        assertFailsWith<SQLException> { runBlocking { service().checkout(validStoreRequest()) } }
        verify(mockConnection).autoCommit = true
    }

    @Test
    fun `checkout uses empty string when transactionId is null`() {
        runBlocking {
            val paymentStatement: PreparedStatement = mock()
            setupSuccessfulCheckout(paymentStatement = paymentStatement)
            service().checkout(validStoreRequest(transactionId = null))
            verify(paymentStatement).setString(4, "")
        }
    }

    @Test
    fun `checkout uses provided transactionId when not null`() {
        runBlocking {
            val paymentStatement: PreparedStatement = mock()
            setupSuccessfulCheckout(paymentStatement = paymentStatement)
            service().checkout(validStoreRequest(transactionId = "lnbc123"))
            verify(paymentStatement).setString(4, "lnbc123")
        }
    }

    @Test
    fun `checkout processes all items iterating stock decrement for each`() {
        runBlocking {
            val items =
                listOf(
                    StoreCheckoutItem("prod-1", 1, 100),
                    StoreCheckoutItem("prod-2", 3, 200),
                )
            val stockStatement: PreparedStatement = mock()
            setupSuccessfulCheckout(stockStatement = stockStatement)
            val result = service().checkout(validStoreRequest(items = items))
            assertTrue(result is CheckoutResult.Success)
            verify(stockStatement, times(2)).executeUpdate()
        }
    }

    @Test
    fun `checkout rolls back when second item has insufficient stock`() {
        runBlocking {
            val items =
                listOf(
                    StoreCheckoutItem("prod-1", 1, 100),
                    StoreCheckoutItem("prod-2", 999, 200),
                )
            val stockStatement: PreparedStatement = mock()
            val orderStatement: PreparedStatement = mock()
            val itemStatement: PreparedStatement = mock()
            whenever(mockConnection.prepareStatement(contains("INSERT INTO orders"))).thenReturn(orderStatement)
            whenever(mockConnection.prepareStatement(contains("INSERT INTO order_products"))).thenReturn(itemStatement)
            whenever(mockConnection.prepareStatement(contains("UPDATE products"))).thenReturn(stockStatement)
            whenever(stockStatement.executeUpdate()).thenReturn(1).thenReturn(0)
            val result = service().checkout(validStoreRequest(items = items))
            assertEquals(CheckoutResult.Invalid, result)
            verify(mockConnection).rollback()
        }
    }

    @Test
    fun `checkout returns existing order when paymentHash already recorded`() {
        runBlocking {
            val findStatement: PreparedStatement = mock()
            val findResultSet: ResultSet = mock()
            whenever(mockConnection.prepareStatement(contains("payment_hash = ?"))).thenReturn(findStatement)
            whenever(findStatement.executeQuery()).thenReturn(findResultSet)
            whenever(findResultSet.next()).thenReturn(true)
            whenever(findResultSet.getString("orderId")).thenReturn("order-existing")
            whenever(findResultSet.getString("ticketId")).thenReturn("ticket-existing")
            whenever(findResultSet.getString("paymentId")).thenReturn("payment-existing")

            val result = service().checkout(validStoreRequest(paymentHash = "hash-recovered"))

            assertTrue(result is CheckoutResult.Success)
            assertTrue(result.alreadyExisted)
            assertEquals("order-existing", result.response.orderId)
            assertEquals("ticket-existing", result.response.ticketId)
            assertEquals("payment-existing", result.response.paymentId)
            verify(mockConnection, never()).prepareStatement(contains("INSERT INTO orders"))
            verify(mockPaymentVerifier, never()).getIncomingPayment(any())
        }
    }

    @Test
    fun `checkout returns NotPaid when phoenix has not confirmed the payment`() {
        runBlocking {
            stubNoExistingCheckout()
            whenever(mockPaymentVerifier.getIncomingPayment("hash-pending"))
                .thenReturn(incomingPayment(paymentHash = "hash-pending", isPaid = false))

            val result = service().checkout(validStoreRequest(paymentHash = "hash-pending"))

            assertEquals(CheckoutResult.NotPaid, result)
            verify(mockConnection, never()).prepareStatement(contains("INSERT INTO orders"))
        }
    }

    @Test
    fun `checkout returns NotPaid when phoenix lookup fails`() {
        runBlocking {
            stubNoExistingCheckout()
            whenever(mockPaymentVerifier.getIncomingPayment("hash-unknown"))
                .thenThrow(RuntimeException("phoenix unreachable"))

            val result = service().checkout(validStoreRequest(paymentHash = "hash-unknown"))

            assertEquals(CheckoutResult.NotPaid, result)
            verify(mockConnection, never()).prepareStatement(contains("INSERT INTO orders"))
        }
    }

    @Test
    fun `checkout creates a new order when phoenix confirms the BTC payment is paid`() {
        runBlocking {
            stubNoExistingCheckout()
            whenever(mockPaymentVerifier.getIncomingPayment("hash-paid"))
                .thenReturn(incomingPayment(paymentHash = "hash-paid", isPaid = true))
            setupSuccessfulCheckout()

            val result = service().checkout(validStoreRequest(paymentHash = "hash-paid"))

            assertTrue(result is CheckoutResult.Success)
            assertEquals(false, result.alreadyExisted)
            verify(mockConnection).commit()
        }
    }

    @Test
    fun `getStoreOrders returns empty list when no orders found`() {
        runBlocking {
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement)
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet)
            whenever(mockResultSet.next()).thenReturn(false)
            val result = service().getStoreOrders()
            assertTrue(result.isEmpty())
        }
    }

    @Test
    fun `getStoreOrders uses status filter query when status is provided`() {
        runBlocking {
            val statusStatement: PreparedStatement = mock()
            val statusResultSet: ResultSet = mock()
            whenever(mockConnection.prepareStatement(contains("AND o.status = ?"))).thenReturn(statusStatement)
            whenever(statusStatement.executeQuery()).thenReturn(statusResultSet)
            whenever(statusResultSet.next()).thenReturn(false)
            service().getStoreOrders(status = "paid")
            verify(statusStatement).setString(1, "paid")
        }
    }

    @Test
    fun `getStoreOrderById returns null when order not found`() {
        runBlocking {
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement)
            whenever(mockStatement.executeQuery()).thenReturn(mockResultSet)
            whenever(mockResultSet.next()).thenReturn(false)
            val result = service().getStoreOrderById("not-found")
            assertNull(result)
        }
    }

    @Test
    fun `cancelStoreOrder returns true when order is cancelled`() {
        runBlocking {
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement)
            whenever(mockStatement.executeUpdate()).thenReturn(1)
            val result = service().cancelStoreOrder("order-1")
            assertTrue(result)
        }
    }

    @Test
    fun `cancelStoreOrder returns false when order not found or already closed`() {
        runBlocking {
            whenever(mockConnection.prepareStatement(any())).thenReturn(mockStatement)
            whenever(mockStatement.executeUpdate()).thenReturn(0)
            val result = service().cancelStoreOrder("not-found")
            assertEquals(false, result)
        }
    }
}
