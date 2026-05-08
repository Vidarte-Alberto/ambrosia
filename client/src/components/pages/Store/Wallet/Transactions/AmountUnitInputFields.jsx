"use client";

import { Button, NumberInput } from "@heroui/react";

import { formatSats } from "../utils/formatters";

export function AmountUnitInputFields({
  align = "center",
  amountInputMode,
  errorMessage,
  estimatedLabel,
  estimatedSats,
  fiatLabel,
  fiatOptionLabel,
  fiatPlaceholder,
  fiatToSatHasError,
  fiatToSatIsLoading,
  inputValue,
  isDisabled = false,
  loadingText,
  onAmountChange,
  onAmountModeChange,
  satLabel,
  satsOptionLabel,
  satPlaceholder,
  title,
  conversionErrorText,
}) {
  const isLeftAligned = align === "left";

  return (
    <>
      <div className={`space-y-3 ${isLeftAligned ? "text-left" : "text-center"}`}>
        {title && (
          <p className="text-sm font-medium text-default-700">
            {title}
          </p>
        )}
        <div className={`flex ${isLeftAligned ? "justify-start" : "justify-center"}`}>
          <div className="inline-flex items-center gap-1 rounded-xl border border-default-200 bg-default-50 p-1">
            <Button
              variant={amountInputMode === "sat" ? "solid" : "light"}
              color={amountInputMode === "sat" ? "primary" : "default"}
              onPress={() => onAmountModeChange("sat")}
              isDisabled={isDisabled}
              radius="lg"
              className="min-w-20 font-medium"
            >
              {satsOptionLabel}
            </Button>
            <Button
              variant={amountInputMode === "fiat" ? "solid" : "light"}
              color={amountInputMode === "fiat" ? "primary" : "default"}
              onPress={() => onAmountModeChange("fiat")}
              isDisabled={isDisabled}
              radius="lg"
              className="min-w-20 font-medium"
            >
              {fiatOptionLabel}
            </Button>
          </div>
        </div>
      </div>

      <NumberInput
        type="number"
        label={amountInputMode === "fiat" ? fiatLabel : satLabel}
        placeholder={amountInputMode === "fiat" ? fiatPlaceholder : satPlaceholder}
        value={inputValue === "" ? null : Number(inputValue)}
        onValueChange={onAmountChange}
        onChange={(event) => onAmountChange(event.target.value)}
        minValue={0}
        maxValue={amountInputMode === "fiat" ? Number.MAX_SAFE_INTEGER / 100 : Number.MAX_SAFE_INTEGER}
        formatOptions={{
          useGrouping: false,
          maximumFractionDigits: amountInputMode === "fiat" ? 2 : 0,
        }}
        isInvalid={Boolean(errorMessage) || fiatToSatHasError}
        errorMessage={errorMessage || (fiatToSatHasError ? conversionErrorText : "")}
        step={amountInputMode === "fiat" ? "0.01" : "1"}
        isDisabled={isDisabled}
        classNames={{
          inputWrapper: "border border-default-200 bg-white shadow-none",
        }}
      />

      {amountInputMode === "fiat" && (
        <div className={`flex items-center ${isLeftAligned ? "justify-start gap-2" : "justify-between"}`}>
          <span className="text-sm text-default-500">
            {estimatedLabel}
          </span>
          <span className="font-medium text-default-700">
            {fiatToSatIsLoading && loadingText}
            {fiatToSatHasError && conversionErrorText}
            {!fiatToSatIsLoading && !fiatToSatHasError && estimatedSats != null && `${formatSats(estimatedSats)} sats`}
          </span>
        </div>
      )}
    </>
  );
}
