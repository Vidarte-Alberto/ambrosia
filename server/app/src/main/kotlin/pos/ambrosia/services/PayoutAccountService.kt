package pos.ambrosia.services

import org.jetbrains.exposed.v1.core.dao.id.EntityID
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import pos.ambrosia.db.tables.CurrencyTable
import pos.ambrosia.db.tables.PayoutAccountEntity
import pos.ambrosia.db.tables.PayoutAccountsTable
import pos.ambrosia.logger
import pos.ambrosia.models.PayoutAccount
import pos.ambrosia.models.PayoutAccountUpsert
import pos.ambrosia.utils.LightningBackendUnavailableException
import java.time.LocalDateTime
import java.util.UUID

class PayoutAccountService {
    private fun parseUuid(rawUuid: String): UUID? =
        try {
            UUID.fromString(rawUuid)
        } catch (_: IllegalArgumentException) {
            null
        }

    private fun currencyExists(currencyId: String?): Boolean {
        if (currencyId.isNullOrBlank()) return true
        val currencyUuid = parseUuid(currencyId) ?: return false
        return !CurrencyTable
            .selectAll()
            .where { CurrencyTable.id eq EntityID(currencyUuid, CurrencyTable) }
            .empty()
    }

    private fun hasNoBankFields(payoutAccountRequest: PayoutAccountUpsert): Boolean =
        payoutAccountRequest.accountHolder.isNullOrBlank() &&
            payoutAccountRequest.bankName.isNullOrBlank() &&
            payoutAccountRequest.accountNumber.isNullOrBlank() &&
            payoutAccountRequest.swift.isNullOrBlank() &&
            payoutAccountRequest.iban.isNullOrBlank() &&
            payoutAccountRequest.clabe.isNullOrBlank()

    private fun isValidBankAccount(payoutAccountRequest: PayoutAccountUpsert): Boolean =
        !payoutAccountRequest.accountHolder.isNullOrBlank() &&
            !payoutAccountRequest.bankName.isNullOrBlank() &&
            !payoutAccountRequest.currencyId.isNullOrBlank() &&
            currencyExists(payoutAccountRequest.currencyId) &&
            (
                !payoutAccountRequest.accountNumber.isNullOrBlank() ||
                    !payoutAccountRequest.iban.isNullOrBlank() ||
                    !payoutAccountRequest.clabe.isNullOrBlank()
            ) &&
            payoutAccountRequest.lightningAddress.isNullOrBlank()

    private fun isValidLightningAccount(payoutAccountRequest: PayoutAccountUpsert): Boolean = hasNoBankFields(payoutAccountRequest)

    private fun requireLightningAddressOrActiveBackend(payoutAccountRequest: PayoutAccountUpsert) {
        val usesNodeLightningWallet =
            payoutAccountRequest.type == "lightning" && payoutAccountRequest.lightningAddress.isNullOrBlank()
        if (usesNodeLightningWallet && !ActiveLightningBackend.isAvailable()) {
            throw LightningBackendUnavailableException()
        }
    }

    private fun isValidPayoutAccountRequest(payoutAccountRequest: PayoutAccountUpsert): Boolean =
        when (payoutAccountRequest.type) {
            "bank" -> isValidBankAccount(payoutAccountRequest)
            "lightning" -> isValidLightningAccount(payoutAccountRequest)
            else -> false
        }

    private fun toPayoutAccountModel(payoutAccountEntity: PayoutAccountEntity): PayoutAccount =
        PayoutAccount(
            id = payoutAccountEntity.id.value.toString(),
            type = payoutAccountEntity.type,
            accountHolder = payoutAccountEntity.accountHolder,
            bankName = payoutAccountEntity.bankName,
            accountNumber = payoutAccountEntity.accountNumber,
            currencyId = payoutAccountEntity.currencyId?.value?.toString(),
            swift = payoutAccountEntity.swift,
            iban = payoutAccountEntity.iban,
            clabe = payoutAccountEntity.clabe,
            lightningAddress = payoutAccountEntity.lightningAddress,
            isDeleted = payoutAccountEntity.isDeleted,
            createdAt = payoutAccountEntity.createdAt,
        )

    fun getPayoutAccounts(): List<PayoutAccount> =
        transaction {
            PayoutAccountEntity
                .find { PayoutAccountsTable.isDeleted eq false }
                .map { payoutAccountEntity -> toPayoutAccountModel(payoutAccountEntity) }
        }

    fun getPayoutAccountById(payoutAccountId: String): PayoutAccount? =
        transaction {
            val payoutAccountUuid = parseUuid(payoutAccountId) ?: return@transaction null
            val payoutAccountEntity = PayoutAccountEntity.findById(payoutAccountUuid) ?: return@transaction null
            if (payoutAccountEntity.isDeleted) return@transaction null
            toPayoutAccountModel(payoutAccountEntity)
        }

    fun addPayoutAccount(payoutAccountRequest: PayoutAccountUpsert): String? =
        transaction {
            if (!isValidPayoutAccountRequest(payoutAccountRequest)) return@transaction null
            requireLightningAddressOrActiveBackend(payoutAccountRequest)

            val payoutAccountId =
                PayoutAccountEntity
                    .new(UUID.randomUUID()) {
                        type = payoutAccountRequest.type
                        accountHolder = payoutAccountRequest.accountHolder
                        bankName = payoutAccountRequest.bankName
                        accountNumber = payoutAccountRequest.accountNumber
                        currencyId =
                            payoutAccountRequest.currencyId?.let { EntityID(UUID.fromString(it), CurrencyTable) }
                        swift = payoutAccountRequest.swift
                        iban = payoutAccountRequest.iban
                        clabe = payoutAccountRequest.clabe
                        lightningAddress = payoutAccountRequest.lightningAddress
                        isDeleted = false
                        createdAt = LocalDateTime.now().toString()
                    }.id.value
                    .toString()
            logger.info("Payout account created: $payoutAccountId")
            payoutAccountId
        }

    fun updatePayoutAccount(
        payoutAccountId: String,
        payoutAccountRequest: PayoutAccountUpsert,
    ): Boolean =
        transaction {
            val payoutAccountUuid = parseUuid(payoutAccountId) ?: return@transaction false
            if (!isValidPayoutAccountRequest(payoutAccountRequest)) return@transaction false

            val payoutAccountEntity = PayoutAccountEntity.findById(payoutAccountUuid) ?: return@transaction false
            if (payoutAccountEntity.isDeleted) return@transaction false
            requireLightningAddressOrActiveBackend(payoutAccountRequest)

            payoutAccountEntity.type = payoutAccountRequest.type
            payoutAccountEntity.accountHolder = payoutAccountRequest.accountHolder
            payoutAccountEntity.bankName = payoutAccountRequest.bankName
            payoutAccountEntity.accountNumber = payoutAccountRequest.accountNumber
            payoutAccountEntity.currencyId =
                payoutAccountRequest.currencyId?.let { EntityID(UUID.fromString(it), CurrencyTable) }
            payoutAccountEntity.swift = payoutAccountRequest.swift
            payoutAccountEntity.iban = payoutAccountRequest.iban
            payoutAccountEntity.clabe = payoutAccountRequest.clabe
            payoutAccountEntity.lightningAddress = payoutAccountRequest.lightningAddress
            logger.info("Payout account updated: $payoutAccountId")
            true
        }

    fun deletePayoutAccount(payoutAccountId: String): Boolean =
        transaction {
            val payoutAccountUuid = parseUuid(payoutAccountId) ?: return@transaction false
            val payoutAccountEntity = PayoutAccountEntity.findById(payoutAccountUuid) ?: return@transaction false
            if (payoutAccountEntity.isDeleted) return@transaction false

            payoutAccountEntity.isDeleted = true
            logger.info("Payout account soft deleted: $payoutAccountId")
            true
        }
}
