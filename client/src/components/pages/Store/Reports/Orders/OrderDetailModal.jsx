"use client";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { useTranslations } from "next-intl";

import formatDate from "@lib/formatDate";

export function OrderDetailModal({ order, formatCurrency, onClose }) {
  const t = useTranslations("reports");

  return (
    <Modal
      isOpen={Boolean(order)}
      onClose={onClose}
      size="md"
      scrollBehavior="inside"
      backdrop="blur"
      classNames={{
        backdrop: "backdrop-blur-xs bg-white/10",
        base: "my-auto",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5 pb-2">
          <span>{t("orders.detailTitle")}</span>
          {order && <span className="font-mono text-sm font-normal text-gray-400">#{order.shortId}</span>}
        </ModalHeader>
        <ModalBody className="pb-6">
          {order && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400">{t("sales.date")}</p>
                  <p className="font-medium">{formatDate(order.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">{t("sales.user")}</p>
                  <p className="font-medium">{order.userName ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">{t("sales.paymentMethod")}</p>
                  <p className="font-medium">{order.paymentMethod || t("payment.unknown")}</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400">
                      <th className="pb-2 font-medium">{t("orders.products")}</th>
                      <th className="pb-2 font-medium text-center">{t("sales.quantity")}</th>
                      <th className="pb-2 font-medium text-right">{t("sales.price")}</th>
                      <th className="pb-2 font-medium text-right">{t("orders.subtotal")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, index) => (
                      <tr key={index} className="border-t border-gray-50">
                        <td className="py-2 text-gray-700">{item.productName}</td>
                        <td className="py-2 text-center text-gray-500">×{item.quantity}</td>
                        <td className="py-2 text-right text-gray-500">{formatCurrency(item.priceAtOrder)}</td>
                        <td className="py-2 text-right font-semibold">{formatCurrency(item.quantity * item.priceAtOrder)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                <span className="font-semibold text-sm">{t("orders.total")}</span>
                <span className="font-bold text-green-700">{formatCurrency(order.total)}</span>
              </div>
            </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
