import mongoose from 'mongoose';
import { Event } from '../models/Event';
import { Payment } from '../models/Payment';
import { Registration } from '../models/Registration';
import { User, UserGender } from '../models/User';
import adminAnalyticsService, {
  resolveRange,
} from '../services/adminAnalytics/adminAnalytics.service';

// Fixed window used by summary / demographics / by-event tests.
const FROM = new Date('2026-06-01T00:00:00.000Z');
const TO = new Date('2026-06-07T00:00:00.000Z');
const inRange = (day: string) => new Date(`2026-06-${day}T12:00:00.000Z`);
const OUT_OF_RANGE = new Date('2026-05-01T12:00:00.000Z');

const scope = { start: FROM, end: new Date(TO.getTime() + 24 * 60 * 60 * 1000) };

let eventA: mongoose.Types.ObjectId;
let eventB: mongoose.Types.ObjectId;

async function createEvent(opts: { isActive: boolean; capacity: number; title: string }) {
  const ev = await Event.create({
    title: opts.title,
    description: 'A charity running event description.',
    date: inRange('15'),
    location: 'Kyiv City',
    capacity: opts.capacity,
    organizerId: new mongoose.Types.ObjectId(),
    isActive: opts.isActive,
    translations: { title: { en: `${opts.title} EN`, uk: `${opts.title} UK` } },
  });
  return ev._id;
}

async function createUser(gender: UserGender, age: number) {
  const year = new Date().getFullYear() - age;
  const u = await User.create({
    name: `User ${gender} ${age}`,
    email: `u-${new mongoose.Types.ObjectId().toString()}@example.com`,
    password: 'password123',
    gender,
    dateOfBirth: `${year}-01-01`,
  });
  return u._id;
}

interface RegOpts {
  eventId: mongoose.Types.ObjectId;
  registeredAt?: Date;
  status?: 'pending' | 'confirmed' | 'cancelled';
  userId?: mongoose.Types.ObjectId;
  city?: string;
  runningClub?: string;
  distanceLabel?: string;
  promo?: boolean;
  afuDonation?: number;
  kids?: { age: number }[];
}

async function createReg(opts: RegOpts) {
  return Registration.create({
    eventId: opts.eventId,
    registeredAt: opts.registeredAt ?? inRange('03'),
    status: opts.status ?? 'confirmed',
    userId: opts.userId,
    city: opts.city,
    runningClub: opts.runningClub,
    distanceLabel: opts.distanceLabel,
    afuDonation: opts.afuDonation,
    promoCodeId: opts.promo ? new mongoose.Types.ObjectId() : undefined,
    kidsRegistrations: opts.kids?.map((k, i) => ({
      name: `Kid ${i}`,
      age: k.age,
      distanceId: 'kids',
      distanceLabel: 'Kids run',
    })),
  });
}

async function createPayment(
  registrationId: mongoose.Types.ObjectId,
  amount: number,
  status: 'completed' | 'refunded' | 'pending'
) {
  return Payment.create({ registrationId, amount, status });
}

/**
 * Seeds the canonical fixture used across summary / demographics / by-event.
 * 6 in-range non-cancelled registrations across two active events, plus noise
 * (cancelled, out-of-range, inactive-event) that must be excluded.
 */
async function seedFixture() {
  eventA = await createEvent({ isActive: true, capacity: 100, title: 'Event A' });
  eventB = await createEvent({ isActive: true, capacity: 10, title: 'Event B' });
  const eventC = await createEvent({ isActive: false, capacity: 50, title: 'Inactive C' });

  const userM25 = await createUser('male', 25);
  const userF35 = await createUser('female', 35);
  const userM65 = await createUser('male', 65);
  const userM17 = await createUser('male', 17);

  // Event A
  const r1 = await createReg({
    eventId: eventA,
    registeredAt: inRange('02'),
    userId: userM25,
    city: 'Kyiv',
    runningClub: 'Alpha',
    distanceLabel: '10K',
    promo: true,
    afuDonation: 100,
  });
  await createPayment(r1._id, 500, 'completed');

  const r2 = await createReg({
    eventId: eventA,
    registeredAt: inRange('03'),
    userId: userF35,
    city: 'Kyiv',
    runningClub: 'Alpha',
    distanceLabel: '21K',
    afuDonation: 50,
  });
  await createPayment(r2._id, 300, 'completed');

  await createReg({
    eventId: eventA,
    registeredAt: inRange('04'),
    status: 'pending',
    city: 'Lviv',
    distanceLabel: '10K',
    kids: [{ age: 5 }, { age: 12 }],
  }); // r3 — guest, unpaid

  // Event B
  const r4 = await createReg({
    eventId: eventB,
    registeredAt: inRange('05'),
    userId: userM65,
    city: 'Odesa',
    runningClub: 'Beta',
    distanceLabel: '5K',
  });
  await createPayment(r4._id, 1000, 'completed');

  const r5 = await createReg({
    eventId: eventB,
    registeredAt: inRange('05'),
    userId: userM17,
    city: 'Kyiv',
    distanceLabel: '5K',
  });
  await createPayment(r5._id, 200, 'completed');

  const r6 = await createReg({ eventId: eventB, registeredAt: inRange('06') }); // guest
  await createPayment(r6._id, 400, 'refunded');

  // Noise
  await createReg({ eventId: eventA, registeredAt: inRange('03'), status: 'cancelled' }); // r7
  // Out-of-range registration for the SAME user on a different active event →
  // makes userM25 "returning" (first-ever reg precedes the window).
  const r8 = await createReg({ eventId: eventB, registeredAt: OUT_OF_RANGE, userId: userM25 });
  await createPayment(r8._id, 700, 'completed');
  const r9 = await createReg({ eventId: eventC, registeredAt: inRange('03') }); // inactive event
  await createPayment(r9._id, 999, 'completed');
}

describe('adminAnalytics service', () => {
  describe('resolveRange', () => {
    it('includes the whole "to" day for custom ranges', () => {
      const { start, end } = resolveRange('custom', FROM, TO);
      expect(start).toEqual(FROM);
      expect(end).toEqual(new Date('2026-06-08T00:00:00.000Z'));
    });

    it('produces a rolling window for presets', () => {
      const now = new Date('2026-06-10T00:00:00.000Z');
      const { start, end } = resolveRange('week', undefined, undefined, now);
      expect(end).toEqual(now);
      expect(start).toEqual(new Date('2026-06-03T00:00:00.000Z'));
    });
  });

  describe('getSummary', () => {
    it('aggregates KPIs over active events in range, excluding noise', async () => {
      await seedFixture();
      const s = await adminAnalyticsService.getSummary(scope);

      expect(s.totalRegistrations).toBe(6);
      expect(s.cancelledRegistrations).toBe(1);
      expect(s.paidRegistrations).toBe(4);
      expect(s.moneyGathered).toBe(2000); // 500+300+1000+200
      expect(s.afuDonationsTotal).toBe(150); // 100+50 (paid regs only)
      expect(s.conversionRate).toBeCloseTo(4 / 6, 5);
      expect(s.averageCheck).toBe(500); // 2000/4
      expect(s.refundsTotal).toBe(400);
      expect(s.refundsCount).toBe(1);
      expect(s.netRevenue).toBe(1600); // 2000-400
      expect(s.kidsRegistrations).toBe(2);
      expect(s.newParticipants).toBe(3); // F35, M65, M17
      expect(s.returningParticipants).toBe(1); // M25 (first reg out of range)
    });

    it('returns zeros for an empty period without throwing', async () => {
      const s = await adminAnalyticsService.getSummary(scope);
      expect(s.totalRegistrations).toBe(0);
      expect(s.moneyGathered).toBe(0);
      expect(s.conversionRate).toBe(0);
      expect(s.averageCheck).toBe(0);
    });

    it('scopes to a single event when eventId is set', async () => {
      await seedFixture();
      const s = await adminAnalyticsService.getSummary({ ...scope, eventId: eventB.toString() });
      expect(s.totalRegistrations).toBe(3); // r4, r5, r6
      expect(s.paidRegistrations).toBe(2);
      expect(s.moneyGathered).toBe(1200);
    });
  });

  describe('getDemographics', () => {
    it('buckets gender, age, cities, clubs, distances and kids', async () => {
      await seedFixture();
      const d = await adminAnalyticsService.getDemographics(scope);

      const gender = Object.fromEntries(d.gender.map(b => [b.label, b.count]));
      expect(gender).toMatchObject({ male: 3, female: 1, unknown: 2 });

      const age = Object.fromEntries(d.ageCategory.map(b => [b.label, b.count]));
      expect(age['18-29']).toBe(1);
      expect(age['30-39']).toBe(1);
      expect(age['60+']).toBe(1);
      expect(age.unknown).toBe(3); // age 17 + 2 guests

      expect(d.adultsVsKids).toEqual({ adults: 6, kids: 2 });

      const kidAges = Object.fromEntries(d.kidAgeBuckets.map(b => [b.label, b.count]));
      expect(kidAges['4-6']).toBe(1);
      expect(kidAges['11-14']).toBe(1);

      const cities = Object.fromEntries(d.topCities.map(b => [b.label, b.count]));
      expect(cities).toMatchObject({ Kyiv: 3, Lviv: 1, Odesa: 1 });

      const clubs = Object.fromEntries(d.topRunningClubs.map(b => [b.label, b.count]));
      expect(clubs).toMatchObject({ Alpha: 2, Beta: 1 });

      expect(d.topDistances[0]).toMatchObject({ label: '10K', count: 2 });
      expect(d.promoUsage).toEqual({ withPromo: 1, withoutPromo: 5 });
      expect(d.gaps).toEqual({ country: true, benefit: true });
    });
  });

  describe('getByEvent', () => {
    it('returns one row per active event with conversion and capacity fill', async () => {
      await seedFixture();
      const rows = await adminAnalyticsService.getByEvent(scope);

      expect(rows).toHaveLength(2); // inactive event C excluded
      const a = rows.find(r => r.eventId === eventA.toString());
      const b = rows.find(r => r.eventId === eventB.toString());

      expect(a).toMatchObject({ registrations: 3, paid: 2, revenue: 800, capacity: 100 });
      expect(a?.conversionRate).toBeCloseTo(2 / 3, 5);
      expect(a?.capacityFillPct).toBeCloseTo(3 / 100, 5);

      expect(b).toMatchObject({ registrations: 3, paid: 2, revenue: 1200, capacity: 10 });
      expect(b?.capacityFillPct).toBeCloseTo(3 / 10, 5);
    });
  });

  describe('getTimeseries', () => {
    it('gap-fills every day with a monotonic cumulative and matching totals', async () => {
      const ev = await createEvent({ isActive: true, capacity: 100, title: 'TS Event' });
      const now = new Date();
      const day = (offset: number) => new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);

      const a = await createReg({ eventId: ev, registeredAt: day(0) });
      await createPayment(a._id, 100, 'completed');
      const b = await createReg({ eventId: ev, registeredAt: day(2) });
      await createPayment(b._id, 200, 'completed');
      await createReg({ eventId: ev, registeredAt: day(2) });

      const tsScope = {
        start: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        end: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      };
      const ts = await adminAnalyticsService.getTimeseries(tsScope);

      expect(ts.registrationsByDay.length).toBe(ts.combinedByDay.length);
      expect(ts.paymentsByDay.length).toBe(ts.registrationsByDay.length);

      // gap-filled: ~7 day buckets
      expect(ts.registrationsByDay.length).toBeGreaterThanOrEqual(7);

      // cumulative is non-decreasing and ends at the total
      let prev = 0;
      for (const p of ts.registrationsByDay) {
        expect(p.cumulative).toBeGreaterThanOrEqual(prev);
        prev = p.cumulative;
      }
      const totalRegs = ts.registrationsByDay.reduce((acc, p) => acc + p.count, 0);
      expect(totalRegs).toBe(3);
      expect(ts.registrationsByDay.at(-1)?.cumulative).toBe(3);

      const totalPaySum = ts.paymentsByDay.reduce((acc, p) => acc + p.sum, 0);
      expect(totalPaySum).toBe(300);
    });
  });
});
