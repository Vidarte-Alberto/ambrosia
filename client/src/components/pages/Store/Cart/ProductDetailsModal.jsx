"use client";
import { Button, Chip, Image, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useCurrency } from "@/components/hooks/useCurrency";
import { storedAssetUrl } from "@/components/utils/storedAssetUrl";

export function ProductDetailsModal({ isOpen, onClose, onAddProduct, product, categories = [] }) {
  const t = useTranslations("cart");
  const { formatAmount } = useCurrency();

  if (!product) return null;

  const imageUrl = storedAssetUrl(product.imageUrl);
  const categoryIds = product.categoryIds ?? [];
  const categoryNames = categories
    .filter((cat) => categoryIds.includes(cat.id))
    .map((cat) => cat.name)
    .join(", ") || t("card.errors.unknownCategory");

  const quantity = Number(product.quantity ?? 0);
  const isOutOfStock = quantity <= 0;

  const stockChipClassName = isOutOfStock
    ? "bg-rose-100 text-rose-800 border border-rose-200"
    : quantity < 11
      ? "bg-amber-100 text-amber-800 border border-amber-200"
      : "bg-green-200 text-green-800 border border-green-300";

  const handleAddToCart = () => {
    onAddProduct?.(product);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      scrollBehavior="inside"
      backdrop="blur"
      classNames={{
        backdrop: "backdrop-blur-xs bg-white/10",
        wrapper: "items-start h-auto",
        base: "my-auto overflow-hidden",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col pb-2">
          {product.name}
          <span className="text-sm font-normal text-gray-500">{categoryNames}</span>
        </ModalHeader>

        <ModalBody className="space-y-4">
          {imageUrl ? (
            <div className="h-48 bg-gray-100 overflow-hidden rounded-lg flex items-center justify-center">
              <Image
                removeWrapper
                alt={product.name}
                src={imageUrl}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center">
              <ImageIcon className="h-12 w-12 text-gray-400" aria-hidden="true" />
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-green-800">{formatAmount(product.priceCents)}</p>
            <Chip size="sm" className={stockChipClassName}>
              {quantity} {t("card.stock")}
            </Chip>
          </div>

          <div className="border-t pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t("productDetails.sku")}</span>
              <span className="font-medium text-gray-800">{product.SKU ?? "—"}</span>
            </div>
          </div>

          {product.description && (
            <p className="text-sm text-gray-600">{product.description}</p>
          )}
        </ModalBody>

        <ModalFooter className="flex justify-between">
          <Button variant="bordered" onPress={onClose}>
            {t("productDetails.close")}
          </Button>
          <Button
            color="primary"
            className="bg-green-800"
            isDisabled={isOutOfStock}
            onPress={handleAddToCart}
          >
            {t("card.add")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
