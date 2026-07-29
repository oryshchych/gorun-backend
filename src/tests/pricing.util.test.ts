import { IPromoCode } from '../models/PromoCode';
import {
  calculatePrice,
  resolveDistancePrice,
  calculateRegistrationPrice,
} from '../utils/pricing.util';

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

const periods = [
  {
    from: new Date('2026-07-18T06:20:00.000Z'),
    to: new Date('2026-08-19T21:00:00.000Z'),
    price: 700,
  },
  {
    from: new Date('2026-08-21T06:00:00.000Z'),
    to: new Date('2026-09-02T06:00:00.000Z'),
    price: 900,
  },
];

describe('resolveDistancePrice', () => {
  it('returns the active period price', () => {
    expect(
      resolveDistancePrice({ pricePeriods: periods }, new Date('2026-07-25T00:00:00.000Z'))
    ).toBe(700);
  });

  it('switches to the next tier once its range starts', () => {
    expect(
      resolveDistancePrice({ pricePeriods: periods }, new Date('2026-08-25T00:00:00.000Z'))
    ).toBe(900);
  });

  it('uses the earliest tier before any period opens', () => {
    expect(
      resolveDistancePrice({ pricePeriods: periods }, new Date('2026-07-01T00:00:00.000Z'))
    ).toBe(700);
  });

  it('falls to the most recent started tier in a gap', () => {
    expect(
      resolveDistancePrice({ pricePeriods: periods }, new Date('2026-08-20T12:00:00.000Z'))
    ).toBe(700);
  });

  it('uses the last tier after all periods end', () => {
    expect(
      resolveDistancePrice({ pricePeriods: periods }, new Date('2026-10-01T00:00:00.000Z'))
    ).toBe(900);
  });

  it('prefers pricePeriods over a flat feeUah', () => {
    expect(
      resolveDistancePrice(
        { feeUah: 500, pricePeriods: periods },
        new Date('2026-07-25T00:00:00.000Z')
      )
    ).toBe(700);
  });

  it('falls back to feeUah with no pricePeriods', () => {
    expect(resolveDistancePrice({ feeUah: 400 })).toBe(400);
  });

  it('returns undefined when nothing is priced', () => {
    expect(resolveDistancePrice({})).toBeUndefined();
  });
});

describe('calculateRegistrationPrice', () => {
  const now = new Date('2026-07-25T00:00:00.000Z');
  const distances = [
    { id: '5k', pricePeriods: periods },
    { id: '10k', feeUah: 1000 },
  ];
  const kidsDistances = [
    { id: 'kid-1', feeUah: 200 },
    { id: 'kid-2', feeUah: 300 },
  ];

  it('charges the resolved distance price', () => {
    const result = calculateRegistrationPrice({ distances, distanceId: '5k', now });
    expect(result).not.toBeNull();
    expect(result!.distancePrice).toBe(700);
    expect(result!.finalPrice).toBe(700);
    expect(result!.discountAmount).toBe(0);
  });

  it('adds kids fees and the AFU donation at full value', () => {
    const result = calculateRegistrationPrice({
      distances,
      kidsDistances,
      distanceId: '5k',
      kidsRegistrations: [{ distanceId: 'kid-1' }, { distanceId: 'kid-2' }],
      afuDonation: 500,
      now,
    });
    // 700 (race) + 200 + 300 (kids) + 500 (donation)
    expect(result!.subtotal).toBe(1700);
    expect(result!.finalPrice).toBe(1700);
    expect(result!.kidsTotal).toBe(500);
    expect(result!.afuDonation).toBe(500);
  });

  it('discounts the race price only, not kids or donation', () => {
    const promo = buildPromo({ discountType: 'percentage', discountValue: 50 });
    const result = calculateRegistrationPrice({
      distances,
      kidsDistances,
      distanceId: '5k',
      kidsRegistrations: [{ distanceId: 'kid-1' }],
      afuDonation: 500,
      promoCode: promo,
      now,
    });
    // race 700 → 350 after 50%; kids 200 + donation 500 untouched
    expect(result!.distancePrice).toBe(700);
    expect(result!.discountAmount).toBe(350);
    expect(result!.finalPrice).toBe(1050);
    // e-mail invariant: subtotal − discountAmount === finalPrice
    expect(result!.subtotal - result!.discountAmount).toBe(result!.finalPrice);
  });

  it('caps the reported discount at the race price', () => {
    const promo = buildPromo({ discountType: 'amount', discountValue: 1000 });
    const result = calculateRegistrationPrice({
      distances,
      distanceId: '5k',
      afuDonation: 500,
      promoCode: promo,
      now,
    });
    // race 700 fully discounted (not 1000); donation 500 still charged
    expect(result!.discountAmount).toBe(700);
    expect(result!.finalPrice).toBe(500);
  });

  it('falls back to basePrice when the distance has no price', () => {
    const result = calculateRegistrationPrice({
      distances: [{ id: 'free-form' }],
      distanceId: 'free-form',
      basePrice: 800,
      now,
    });
    expect(result!.distancePrice).toBe(800);
    expect(result!.finalPrice).toBe(800);
  });

  it('falls back to basePrice when no distance is selected', () => {
    const result = calculateRegistrationPrice({ distances, basePrice: 800, now });
    expect(result!.finalPrice).toBe(800);
  });

  it('returns null when no price can be resolved', () => {
    const result = calculateRegistrationPrice({
      distances: [{ id: 'free-form' }],
      distanceId: 'free-form',
      now,
    });
    expect(result).toBeNull();
  });

  it('ignores kids fees for unknown kids-distance ids', () => {
    const result = calculateRegistrationPrice({
      distances,
      kidsDistances,
      distanceId: '10k',
      kidsRegistrations: [{ distanceId: 'does-not-exist' }],
      now,
    });
    expect(result!.finalPrice).toBe(1000);
    expect(result!.kidsTotal).toBe(0);
  });
});
