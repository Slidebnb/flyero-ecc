export type CustomerPrice = {
  netPrice: string;
  vatAmount?: string | null;
  grossPrice: string;
};

function normalizedAmount(value: string | null | undefined) {
  return value == null ? "" : Number(value).toFixed(2);
}

export function sameCustomerPrice(left: CustomerPrice, right: CustomerPrice) {
  return normalizedAmount(left.netPrice) === normalizedAmount(right.netPrice)
    && normalizedAmount(left.vatAmount) === normalizedAmount(right.vatAmount)
    && normalizedAmount(left.grossPrice) === normalizedAmount(right.grossPrice);
}
