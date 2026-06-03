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

  it('normalizes and deactivates codes whose expirationDate was stored as a string', async () => {
    // Insert via the raw driver to bypass Mongoose casting, simulating a direct DB import
    // that stored expirationDate as a string (MongoDB $lt:<Date> would otherwise skip it).
    await PromoCode.collection.insertOne({
      code: 'STRDATE',
      discountType: 'amount',
      discountValue: 50,
      isActive: true,
      usedCount: 0,
      expirationDate: '2016-02-01',
    });

    const count = await deactivateExpiredPromoCodes();

    expect(count).toBeGreaterThanOrEqual(1);
    const doc = await PromoCode.findOne({ code: 'STRDATE' });
    expect(doc!.isActive).toBe(false);
    expect(doc!.expirationDate).toBeInstanceOf(Date);
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
