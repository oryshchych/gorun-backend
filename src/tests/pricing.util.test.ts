import { IPromoCode } from '../models/PromoCode';
import { calculatePrice } from '../utils/pricing.util';

const buildPromo = (overrides: Partial<IPromoCode>): IPromoCode =>
  ({
    _id: undefined as never,
    code: 'DISCOUNT',
    discountType: 'percentage',
    discountValue: 10,
    usageLimit: 10,
    usedCount: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as IPromoCode;

describe('calculatePrice', () => {
  it('returns base price when no promo code applied', () => {
    const result = calculatePrice(1000, null);
    expect(result.finalPrice).toBe(1000);
    expect(result.discountAmount).toBe(0);
  });

  it('applies percentage discount', () => {
    const promo = buildPromo({ discountType: 'percentage', discountValue: 10 });
    const result = calculatePrice(1000, promo);
    expect(result.finalPrice).toBe(900);
    expect(result.discountAmount).toBe(100);
  });

  it('applies amount discount', () => {
    const promo = buildPromo({ discountType: 'amount', discountValue: 150 });
    const result = calculatePrice(1000, promo);
    expect(result.finalPrice).toBe(850);
    expect(result.discountAmount).toBe(150);
  });

  it('ignores inactive promo codes', () => {
    const promo = buildPromo({ isActive: false });
    const result = calculatePrice(1000, promo);
    expect(result.finalPrice).toBe(1000);
  });
});
