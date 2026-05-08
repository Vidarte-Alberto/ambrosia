"use client";

import { Button, NumberInput } from "@heroui/react";

import { formatSats } from "../utils/formatters";

export function AmountUnitInputFields({
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
  return (
    <>
      <div className="space-y-2 text-center">
        {title && (
          <p className="text-sm text-gray-600">
            {title}
          </p>
        )}
        <div className="flex justify-center gap-2">
          <Button
            variant={amountInputMode === "sat" ? "solid" : "bordered"}
            color={amountInputMode === "sat" ? "primary" : "default"}
            onPress={() => onAmountModeChange("sat")}
            isDisabled={isDisabled}
          >
            {satsOptionLabel}
          </Button>
          <Button
            variant={amountInputMode === "fiat" ? "solid" : "bordered"}
            color={amountInputMode === "fiat" ? "primary" : "default"}
            onPress={() => onAmountModeChange("fiat")}
            isDisabled={isDisabled}
          >
            {fiatOptionLabel}
          </Button>
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
      />

      {amountInputMode === "fiat" && (
        <div className="flex justify-between">
          <span className="text-gray-500">
            {estimatedLabel}
          </span>
          <span className="font-medium">
            {fiatToSatIsLoading && loadingText}
            {fiatToSatHasError && conversionErrorText}
            {!fiatToSatIsLoading && !fiatToSatHasError && estimatedSats != null && `${formatSats(estimatedSats)} sats`}
          </span>
        </div>
      )}
    </>
  );
}
