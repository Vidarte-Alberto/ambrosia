package pos.ambrosia.utils

import fr.acinq.lightning.payment.Bolt11Invoice

data class DecodedInvoice(
    val amountSat: Long?,
    val description: String?,
)

object Bolt11Decoder {
    fun extractDescription(invoice: String?): String? {
        if (invoice.isNullOrBlank()) return null
        return try {
            val parsed = Bolt11Invoice.read(invoice).get()
            parsed.description
        } catch (e: Exception) {
            null
        }
    }

    fun decodeInvoice(invoice: String?): DecodedInvoice? {
        if (invoice.isNullOrBlank()) return null
        return try {
            val parsed = Bolt11Invoice.read(invoice).get()
            DecodedInvoice(
                amountSat = parsed.amount?.truncateToSatoshi()?.toLong(),
                description = parsed.description,
            )
        } catch (e: Exception) {
            null
        }
    }
}
