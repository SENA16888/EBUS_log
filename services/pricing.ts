export const clampPercent = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
};

export const calcDiscountValue = (price: number, discount?: number, discountPercent?: number) => {
  const percentValue = price * (clampPercent(discountPercent) / 100);
  return (discount || 0) + percentValue;
};

export const calcUnitPrice = (price: number, discount?: number, discountPercent?: number) => {
  const unitPrice = price - calcDiscountValue(price, discount, discountPercent);
  return Math.max(0, unitPrice);
};

export const calcLineTotal = (price: number, quantity: number, discount?: number, discountPercent?: number) => {
  return calcUnitPrice(price, discount, discountPercent) * quantity;
};
