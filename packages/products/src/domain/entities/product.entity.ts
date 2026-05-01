export interface Product {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly description: string | null;
  readonly priceCents: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewProduct {
  readonly ownerId: string;
  readonly name: string;
  readonly description?: string | null;
  readonly priceCents: number;
}

export interface ProductPatch {
  readonly name?: string;
  readonly description?: string | null;
  readonly priceCents?: number;
}

export const decimalToCents = (decimal: string): number => {
  const [whole = '0', frac = ''] = decimal.split('.');
  const padded = (frac + '00').slice(0, 2);
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(padded, 10);
};

export const centsToDecimal = (cents: number): string => {
  const whole = Math.trunc(cents / 100);
  const frac = Math.abs(cents % 100)
    .toString()
    .padStart(2, '0');
  return `${whole}.${frac}`;
};

export const toProductDto = (p: Product) => ({
  id: p.id,
  ownerId: p.ownerId,
  name: p.name,
  description: p.description,
  price: centsToDecimal(p.priceCents),
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});
