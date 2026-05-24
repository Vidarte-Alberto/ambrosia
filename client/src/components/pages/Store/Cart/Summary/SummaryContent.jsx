import { useMemo, useState } from "react";

import { addToast, Button, Divider, Select, SelectItem } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useCurrency } from "@/components/hooks/useCurrency";

import { BitcoinPaymentModal } from "../BitcoinPaymentModal";
import { CardPaymentModal } from "../CardPaymentModal";
import { CashPaymentModal } from "../CashPaymentModal";
import { usePaymentMethods } from "../hooks/usePaymentMethod";

import { CartItemCard } from "./CartItemCard";
import { usePendingRemoval } from "./hooks/usePendingRemoval";
import { SwipeableCartItem } from "./SwipeableCartItem";

export function SummaryContent({
  cartItems,
  discount,
  onRemoveProduct,
  onUpdateQuantity,
  onPay,
  isPaying,
  paymentError,
  onClearPaymentError,
  btcPayment,
  cashPayment,
  cardPayment,
}) {
  const t = useTranslations("cart");
  const { formatAmount } = useCurrency();
  const { paymentMethods } = usePaymentMethods();
  const { pendingRemovals, startRemoval, cancelRemoval } = usePendingRemoval();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [isTouchDevice] = useState(
    () => typeof window !== "undefined" && navigator.maxTouchPoints > 0,
  );
  const items = cartItems || [];
  const visibleItems = items.filter((item) => !pendingRemovals.has(item.id));

  const handleStartRemoval = (item) => {
    startRemoval(item.id, () => onRemoveProduct(item.id));
    addToast({
      description: item.name,
      timeout: 5000,
      endContent: (
        <Button
          size="sm"
          color="primary"
          className="bg-green-800"
          onPress={() => cancelRemoval(item.id)}
        >
          {t("summary.undoToast.undo")}
        </Button>
      ),
    });
  };

  const effectivePaymentMethod = useMemo(() => {
    if (selectedPaymentMethod) return selectedPaymentMethod;
    const bitcoinLightningMethod = paymentMethods.find((method) => method.name === "BTC");
    return bitcoinLightningMethod ? String(bitcoinLightningMethod.id) : "";
  }, [selectedPaymentMethod, paymentMethods]);

  const { subtotal, discountAmount, total } = useMemo(() => {
    const itemsToProcess = cartItems || [];
    const subtotalValue = itemsToProcess.reduce((sum, item) => sum + item.subtotal, 0);
    const discountValue = Number(discount) || 0;
    const discountTotal = (subtotalValue * discountValue) / 100;
    const totalValue = subtotalValue - discountTotal;

    return {
      subtotal: subtotalValue,
      discountAmount: discountTotal,
      total: totalValue,
    };
  }, [cartItems, discount]);

  const handlePay = () => {
    onClearPaymentError?.();
    onPay?.({
      items,
      subtotal,
      discount,
      discountAmount,
      total,
      selectedPaymentMethod: effectivePaymentMethod,
    });
  };

  return (
    <>
      <div className="space-y-4">
        {visibleItems.map((item) => (
          <SwipeableCartItem
            key={item.id}
            onRemove={() => handleStartRemoval(item)}
            isTouchDevice={isTouchDevice}
          >
            <CartItemCard
              item={item}
              onRemove={() => handleStartRemoval(item)}
              onUpdateQuantity={onUpdateQuantity}
            />
          </SwipeableCartItem>
        ))}

        <div className="space-y-2 text-sm text-gray-800">
          <div className="flex justify-between">
            <span>{t("summary.subtotal")}</span>
            <span>{formatAmount(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t("summary.discount")}</span>
            <span>{formatAmount(discountAmount)}</span>
          </div>
          <Divider className="bg-green-600" />
          <div className="flex justify-between items-center font-semibold text-green-900">
            <span>{t("summary.total")}:</span>
            <span className="text-lg">{formatAmount(total)}</span>
          </div>
        </div>

        {paymentError && (
          <p className="text-sm text-red-600">{paymentError}</p>
        )}

        <div className="space-y-2">
          <Select
            label={t("summary.paymentMethodLabel")}
            placeholder={t("summary.paymentMethodSelectPlaceholder")}
            isRequired
            errorMessage={t("summary.errorMsgSelectEmpty")}
            selectedKeys={effectivePaymentMethod ? [effectivePaymentMethod] : []}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0];
              if (!value) return;
              setSelectedPaymentMethod(value);
              onClearPaymentError?.();
            }}
            isDisabled={isPaying}
          >
            {paymentMethods.map((method) => (
              <SelectItem key={method.id} value={method.id}>
                {method.name === "BTC" ? `${method.name} (Lightning)` : method.name}
              </SelectItem>
            ))}
          </Select>

          <Button
            color="primary"
            className="w-full"
            size="lg"
            isLoading={isPaying}
            isDisabled={!visibleItems.length}
            onPress={handlePay}
          >
            {t("summary.pay")}
          </Button>
        </div>
      </div>

      <BitcoinPaymentModal
        isOpen={!!btcPayment?.config}
        amountFiat={btcPayment?.config?.amountFiat}
        currencyAcronym={btcPayment?.config?.currencyAcronym}
        paymentId={btcPayment?.config?.paymentId}
        invoiceDescription={btcPayment?.config?.invoiceDescription}
        displayTotal={btcPayment?.config?.displayTotal}
        onClose={btcPayment?.onClose}
        onInvoiceReady={btcPayment?.onInvoiceReady}
        onComplete={btcPayment?.onComplete}
      />

      <CashPaymentModal
        isOpen={!!cashPayment?.config}
        amountDue={cashPayment?.config?.amountDue}
        displayTotal={cashPayment?.config?.displayTotal}
        onClose={cashPayment?.onClose}
        onComplete={cashPayment?.onComplete}
      />

      <CardPaymentModal
        isOpen={!!cardPayment?.config}
        amountDue={cardPayment?.config?.amountDue}
        displayTotal={cardPayment?.config?.displayTotal}
        methodLabel={cardPayment?.config?.methodLabel}
        onClose={cardPayment?.onClose}
        onComplete={cardPayment?.onComplete}
      />

    </>
  );
}
