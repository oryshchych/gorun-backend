import { deactivateExpiredPromoCodes } from '../jobs/promoCodes.job';
import { PromoCode } from '../models/PromoCode';

describe('deactivateExpiredPromoCodes', () => {
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const isActiveByCode = async (code: string): Promise<boolean> => {
    const doc = await PromoCode.findOne({ code });
    if (!doc) {
      throw new Error(`Promo code ${code} not found`);
    }
    return doc.isActive;
  };

  it('deactivates only active codes whose expiration date has passed', async () => {
    await PromoCode.create([
      { code: 'EXPIRED', discountType: 'amount', discountValue: 50, expirationDate: past },
      { code: 'FUTURE', discountType: 'amount', discountValue: 50, expirationDate: future },
      {
        code: 'OLDINACTIVE',
        discountType: 'amount',
        discountValue: 50,
        isActive: false,
        expirationDate: past,
      },
      { code: 'NOEXPIRY', discountType: 'amount', discountValue: 50 },
    ]);

    const count = await deactivateExpiredPromoCodes();

    expect(count).toBe(1);
    expect(await isActiveByCode('EXPIRED')).toBe(false);
    expect(await isActiveByCode('FUTURE')).toBe(true);
    expect(await isActiveByCode('OLDINACTIVE')).toBe(false);
    expect(await isActiveByCode('NOEXPIRY')).toBe(true);
  });

  it('returns 0 when there are no expired active codes', async () => {
    await PromoCode.create({
      code: 'FUTURE',
      discountType: 'amount',
      discountValue: 50,
      expirationDate: future,
    });

    expect(await deactivateExpiredPromoCodes()).toBe(0);
  });
});
