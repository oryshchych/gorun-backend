import promoCodesService from '../services/promoCodes/promoCodes.service';
import { PromoCode } from '../models/PromoCode';

describe('admin promo codes — notes field & isActive filter', () => {
  const seed = (overrides: Record<string, unknown> = {}): Promise<unknown> =>
    PromoCode.create({
      code: 'BASE',
      discountType: 'amount',
      discountValue: 50,
      ...overrides,
    });

  describe('notes round-trip', () => {
    it('serializes notes (null when unset) in detail response', async () => {
      const withNotes = await seed({ code: 'WITHNOTES', notes: 'VIP partner code' });
      const without = await seed({ code: 'NONOTES' });

      const a = await promoCodesService.getAdminPromoCodeById(
        (withNotes as { _id: { toString(): string } })._id.toString()
      );
      const b = await promoCodesService.getAdminPromoCodeById(
        (without as { _id: { toString(): string } })._id.toString()
      );

      expect(a.notes).toBe('VIP partner code');
      expect(b.notes).toBeNull();
    });

    it('patches notes and clears it with null', async () => {
      const doc = await seed({ code: 'PATCHME' });
      const id = (doc as { _id: { toString(): string } })._id.toString();

      const set = await promoCodesService.patchAdminPromoCode(id, { notes: 'temporary note' });
      expect(set.notes).toBe('temporary note');

      const cleared = await promoCodesService.patchAdminPromoCode(id, { notes: null });
      expect(cleared.notes).toBeNull();
    });
  });

  describe('isActive list filter', () => {
    beforeEach(async () => {
      await seed({ code: 'ACTIVE1', isActive: true });
      await seed({ code: 'ACTIVE2', isActive: true });
      await seed({ code: 'INACTIVE1', isActive: false });
    });

    it('returns only active codes when isActive=true', async () => {
      const res = await promoCodesService.listAdminPromoCodes({
        page: 1,
        limit: 10,
        isActive: 'true',
      });
      expect(res.data).toHaveLength(2);
      expect(res.data.every(p => p.isActive)).toBe(true);
    });

    it('returns only inactive codes when isActive=false', async () => {
      const res = await promoCodesService.listAdminPromoCodes({
        page: 1,
        limit: 10,
        isActive: 'false',
      });
      expect(res.data).toHaveLength(1);
      expect(res.data[0]?.code).toBe('INACTIVE1');
    });

    it('returns all codes when isActive is absent', async () => {
      const res = await promoCodesService.listAdminPromoCodes({ page: 1, limit: 10 });
      expect(res.data).toHaveLength(3);
    });
  });
});
