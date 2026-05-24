"use client";
import { useState } from "react";

import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Image } from "@heroui/react";
import { ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useCurrency } from "@/components/hooks/useCurrency";
import { storedAssetUrl } from "@/components/utils/storedAssetUrl";

import { ProductDetailsModal } from "./ProductDetailsModal";

export function ProductList({ products, onAddProduct, categories }) {
  const cardProductTranslation = useTranslations("cart");
  const { formatAmount } = useCurrency();
  const defaultMaxStock = 11;
  const [showProductDetails, setShowProductDetails] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const getCategoryNames = (categoryIds) => {
    const ids = categoryIds ?? [];
    const names = categories
      .filter((cat) => ids.includes(cat.id))
      .map((cat) => cat.name);
    return names.length > 0 ? names.join(", ") : cardProductTranslation("card.errors.unknownCategory");
  };

  const handleOpenProductDetails = (product) => {
    setSelectedProduct(product);
    setShowProductDetails(true);
  };

  const normalizeNumber = (value, fallback = 0) => {
    const numeric = Number(value ?? fallback);
    return Number.isFinite(numeric) ? numeric : fallback;
  };

  const stockStatus = (product) => {
    const quantity = normalizeNumber(product.quantity);

    if (quantity <= 0) {
      return "out";
    }
    if (quantity < defaultMaxStock) {
      return "low";
    }
    return "ok";
  };

  return (
    <>
    <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
      {products.map((product) => {
        const status = stockStatus(product);
        const imageUrl = storedAssetUrl(product.imageUrl);
        return (
          <Card
            shadow="none"
            className="bg-white rounded-lg hover:bg-gray-300"
            key={product.id}
          >
            <div
              className="cursor-pointer"
              onClick={() => handleOpenProductDetails(product)}
            >
              <div className="h-28 md:h-36 bg-gray-100 overflow-hidden flex items-center justify-center">
                {imageUrl ? (
                  <Image
                    removeWrapper
                    alt={product.name}
                    src={imageUrl}
                    className="w-full h-full object-cover rounded-none"
                  />
                ) : (
                  <div data-testid={`product-image-placeholder-${product.id}`}>
                    <ImageIcon aria-hidden="true" className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>
              <CardHeader className="flex flex-col items-start pb-1">
                <h2 className="text-sm md:text-lg font-medium">{product.name}</h2>
                <p className="text-xs">{getCategoryNames(product.categoryIds)}</p>
              </CardHeader>
              <CardBody className="py-1">
                <h2 className="text-lg md:text-2xl font-bold text-green-800">
                  {formatAmount(product.priceCents)}
                </h2>
                <p className="hidden md:block text-xs">
                  SKU: <span className="text-gray-800">{product.SKU}</span>
                </p>
              </CardBody>
            </div>
            <CardFooter className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-center sm:justify-between">
              <Chip
                size="sm"
                className={
                  status === "out"
                    ? "bg-rose-100 text-rose-800 border border-rose-200 text-xs"
                    : status === "low"
                      ? "bg-amber-100 text-amber-800 border border-amber-200 text-xs"
                      : "bg-green-200 text-xs text-green-800 border border-green-300"
                }
              >
                {normalizeNumber(product.quantity)} {cardProductTranslation("card.stock")}
              </Chip>
              <Button
                color="primary"
                size="sm"
                isDisabled={product.quantity === 0}
                onPress={() => onAddProduct(product)}
              >
                {cardProductTranslation("card.add")}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
    <ProductDetailsModal
      isOpen={showProductDetails}
      onClose={() => setShowProductDetails(false)}
      onAddProduct={onAddProduct}
      product={selectedProduct}
      categories={categories}
    />
    </>
  );
}
