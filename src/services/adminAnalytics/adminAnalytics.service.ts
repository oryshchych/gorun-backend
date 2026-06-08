import mongoose from 'mongoose';
import { Event } from '../../models/Event';
import { Payment } from '../../models/Payment';
import { Registration } from '../../models/Registration';
import type { AnalyticsPreset } from '../../validators/adminAnalytics.validator';
import type {
  AnalyticsScope,
  Bucket,
  ByEventResponse,
  CombinedDayPoint,
  DemographicsResponse,
  PaymentDayPoint,
  RegistrationDayPoint,
  SummaryResponse,
  TimeseriesResponse,
} from './adminAnalytics.types';

/** All day-bucketing and range anchoring uses the audience's timezone. */
const TIMEZONE = 'Europe/Kyiv';
const DAY_MS = 24 * 60 * 60 * 1000;

const PRESET_DAYS: Record<Exclude<AnalyticsPreset, 'custom'>, number> = {
  week: 7,
  month: 30,
  '3months': 90,
  year: 365,
};

// --------------------------------------------------------------------------
// Range + scope helpers
// --------------------------------------------------------------------------

/**
 * Resolve a preset (or explicit from/to) into a concrete [start, end) window.
 * `end` is exclusive; for custom ranges the `to` day is fully included.
 */
export function resolveRange(
  preset: AnalyticsPreset,
  from: Date | undefined,
  to: Date | undefined,
  now: Date = new Date()
): { start: Date; end: Date } {
  if (preset === 'custom' && from && to) {
    // Include the whole `to` day by pushing the exclusive bound to the next day.
    return { start: from, end: new Date(to.getTime() + DAY_MS) };
  }
  // Allow explicit overrides even on non-custom presets.
  if (from && to) {
    return { start: from, end: new Date(to.getTime() + DAY_MS) };
  }
  const days = PRESET_DAYS[preset as Exclude<AnalyticsPreset, 'custom'>] ?? PRESET_DAYS.month;
  return { start: new Date(now.getTime() - days * DAY_MS), end: now };
}

/** Object-ids of every active event — the default GENERAL scope. */
async function getActiveEventIds(): Promise<mongoose.Types.ObjectId[]> {
  const events = await Event.find({ isActive: true }).select('_id').lean();
  return events.map(e => e._id);
}

/** Build the `eventId` portion of a `$match` for the requested scope. */
function eventScopeMatch(
  eventId: string | undefined,
  activeIds: mongoose.Types.ObjectId[]
): mongoose.FilterQuery<unknown> {
  return eventId
    ? { eventId: new mongoose.Types.ObjectId(eventId) }
    : { eventId: { $in: activeIds } };
}

/** Format a Date as a YYYY-MM-DD string in the analytics timezone. */
function formatDay(date: Date): string {
  // en-CA yields YYYY-MM-DD; timeZone makes it a Kyiv-day label.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Ordered, de-duplicated list of Kyiv-day labels covering [start, end). */
function buildDayAxis(start: Date, end: Date): string[] {
  const days: string[] = [];
  let last = '';
  // Step by 12h so a DST shift can never skip a calendar day.
  for (let t = start.getTime(); t < end.getTime(); t += DAY_MS / 2) {
    const label = formatDay(new Date(t));
    if (label !== last) {
      if (!days.includes(label)) days.push(label);
      last = label;
    }
  }
  // Guarantee the final day is present even if the loop stops just short.
  const endLabel = formatDay(new Date(end.getTime() - 1));
  if (!days.includes(endLabel)) days.push(endLabel);
  return days;
}

// --------------------------------------------------------------------------
// Summary
// --------------------------------------------------------------------------

export async function getSummary(scope: AnalyticsScope): Promise<SummaryResponse> {
  const { start, end, eventId } = scope;
  const activeIds = await getActiveEventIds();
  const evScope = eventScopeMatch(eventId, activeIds);

  const baseScope = { registeredAt: { $gte: start, $lt: end }, ...evScope };
  const regMatch = { ...baseScope, status: { $ne: 'cancelled' } };

  const [facet] = await Registration.aggregate<{
    total: { n: number }[];
    kids: { n: number }[];
    paid: { paid: number; money: number; afuPaid: number }[];
  }>([
    { $match: regMatch },
    {
      $facet: {
        total: [{ $count: 'n' }],
        kids: [
          { $project: { k: { $size: { $ifNull: ['$kidsRegistrations', []] } } } },
          { $group: { _id: null, n: { $sum: '$k' } } },
        ],
        paid: [
          {
            $lookup: {
              from: 'payments',
              localField: '_id',
              foreignField: 'registrationId',
              pipeline: [{ $match: { status: 'completed' } }],
              as: 'pays',
            },
          },
          { $match: { 'pays.0': { $exists: true } } },
          {
            $group: {
              _id: null,
              paid: { $sum: 1 },
              money: { $sum: { $sum: '$pays.amount' } },
              afuPaid: { $sum: { $ifNull: ['$afuDonation', 0] } },
            },
          },
        ],
      },
    },
  ]);

  const totalRegistrations = facet?.total[0]?.n ?? 0;
  const kidsRegistrations = facet?.kids[0]?.n ?? 0;
  const paidRegistrations = facet?.paid[0]?.paid ?? 0;
  const moneyGathered = facet?.paid[0]?.money ?? 0;
  const afuDonationsTotal = facet?.paid[0]?.afuPaid ?? 0;

  const cancelledRegistrations = await Registration.countDocuments({
    ...baseScope,
    status: 'cancelled',
  });

  // Refunds: refunded payments whose registration falls in the period/scope.
  const [refundAgg] = await Payment.aggregate<{ sum: number; count: number }>([
    { $match: { status: 'refunded' } },
    {
      $lookup: {
        from: 'registrations',
        localField: 'registrationId',
        foreignField: '_id',
        as: 'reg',
      },
    },
    { $unwind: '$reg' },
    { $match: { 'reg.registeredAt': { $gte: start, $lt: end }, ...prefixReg(evScope) } },
    { $group: { _id: null, sum: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const refundsTotal = refundAgg?.sum ?? 0;
  const refundsCount = refundAgg?.count ?? 0;

  // New vs returning: among users who registered in range, was their first-ever
  // registration (within scope) inside the range?
  const [nvr] = await Registration.aggregate<{ newU: number; returning: number }>([
    {
      $match: {
        ...evScope,
        status: { $ne: 'cancelled' },
        registeredAt: { $lt: end },
        userId: { $exists: true },
      },
    },
    {
      $group: {
        _id: '$userId',
        firstReg: { $min: '$registeredAt' },
        inRange: { $max: { $cond: [{ $gte: ['$registeredAt', start] }, 1, 0] } },
      },
    },
    { $match: { inRange: 1 } },
    {
      $group: {
        _id: null,
        newU: { $sum: { $cond: [{ $gte: ['$firstReg', start] }, 1, 0] } },
        returning: { $sum: { $cond: [{ $gte: ['$firstReg', start] }, 0, 1] } },
      },
    },
  ]);

  return {
    totalRegistrations,
    paidRegistrations,
    moneyGathered,
    conversionRate: totalRegistrations > 0 ? paidRegistrations / totalRegistrations : 0,
    averageCheck: paidRegistrations > 0 ? moneyGathered / paidRegistrations : 0,
    afuDonationsTotal,
    refundsTotal,
    refundsCount,
    netRevenue: moneyGathered - refundsTotal,
    cancelledRegistrations,
    kidsRegistrations,
    newParticipants: nvr?.newU ?? 0,
    returningParticipants: nvr?.returning ?? 0,
  };
}

/** Re-key an `{ eventId: ... }` match onto the joined `reg.eventId` field. */
function prefixReg(evScope: mongoose.FilterQuery<unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(evScope)) out[`reg.${k}`] = v;
  return out;
}

// --------------------------------------------------------------------------
// Timeseries
// --------------------------------------------------------------------------

export async function getTimeseries(scope: AnalyticsScope): Promise<TimeseriesResponse> {
  const { start, end, eventId } = scope;
  const activeIds = await getActiveEventIds();
  const evScope = eventScopeMatch(eventId, activeIds);

  const regRows = await Registration.aggregate<{ _id: string; count: number }>([
    {
      $match: { registeredAt: { $gte: start, $lt: end }, status: { $ne: 'cancelled' }, ...evScope },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$registeredAt', timezone: TIMEZONE } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const payRows = await Payment.aggregate<{ _id: string; count: number; sum: number }>([
    { $match: { status: 'completed', createdAt: { $gte: start, $lt: end } } },
    {
      $lookup: {
        from: 'registrations',
        localField: 'registrationId',
        foreignField: '_id',
        as: 'reg',
      },
    },
    { $unwind: '$reg' },
    { $match: { 'reg.status': { $ne: 'cancelled' }, ...prefixReg(evScope) } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TIMEZONE } },
        count: { $sum: 1 },
        sum: { $sum: '$amount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const regMap = new Map(regRows.map(r => [r._id, r.count]));
  const payMap = new Map(payRows.map(p => [p._id, { count: p.count, sum: p.sum }]));

  const axis = buildDayAxis(start, end);

  let running = 0;
  const registrationsByDay: RegistrationDayPoint[] = axis.map(date => {
    const count = regMap.get(date) ?? 0;
    running += count;
    return { date, count, cumulative: running };
  });

  const paymentsByDay: PaymentDayPoint[] = axis.map(date => {
    const p = payMap.get(date);
    return { date, count: p?.count ?? 0, sum: p?.sum ?? 0 };
  });

  const combinedByDay: CombinedDayPoint[] = axis.map(date => {
    const p = payMap.get(date);
    return {
      date,
      registrations: regMap.get(date) ?? 0,
      payments: p?.count ?? 0,
      revenue: p?.sum ?? 0,
    };
  });

  return { registrationsByDay, paymentsByDay, combinedByDay };
}

// --------------------------------------------------------------------------
// Demographics
// --------------------------------------------------------------------------

const AGE_LABELS: Record<string, string> = {
  '18': '18-29',
  '30': '30-39',
  '40': '40-49',
  '50': '50-59',
  '60': '60+',
  unknown: 'unknown',
};

const KID_AGE_LABELS: Record<string, string> = {
  '0': '0-3',
  '4': '4-6',
  '7': '7-10',
  '11': '11-14',
  '15': '15-17',
  '18+': '18+',
};

function relabel(
  rows: { _id: string | number; count: number }[],
  labels: Record<string, string>
): Bucket[] {
  return rows.map(r => ({ label: labels[String(r._id)] ?? String(r._id), count: r.count }));
}

function toBuckets(rows: { _id: string | null; count: number }[]): Bucket[] {
  return rows.map(r => ({ label: r._id ?? 'unknown', count: r.count }));
}

export async function getDemographics(scope: AnalyticsScope): Promise<DemographicsResponse> {
  const { start, end, eventId } = scope;
  const activeIds = await getActiveEventIds();
  const evScope = eventScopeMatch(eventId, activeIds);
  const regMatch = {
    registeredAt: { $gte: start, $lt: end },
    status: { $ne: 'cancelled' },
    ...evScope,
  };

  const [facet] = await Registration.aggregate<{
    gender: { _id: string; count: number }[];
    age: { _id: string | number; count: number }[];
    cities: { _id: string | null; count: number }[];
    clubs: { _id: string | null; count: number }[];
    distances: { _id: string | null; count: number }[];
    adults: { n: number }[];
    kids: { n: number }[];
    kidAges: { _id: string | number; count: number }[];
    promo: { _id: boolean; count: number }[];
  }>([
    { $match: regMatch },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        pipeline: [{ $project: { gender: 1, dateOfBirth: 1 } }],
        as: 'u',
      },
    },
    { $set: { u: { $first: '$u' } } },
    {
      $set: {
        dob: {
          $dateFromString: {
            dateString: { $ifNull: ['$u.dateOfBirth', ''] },
            format: '%Y-%m-%d',
            onError: null,
            onNull: null,
          },
        },
      },
    },
    {
      $set: {
        ageYears: {
          $cond: [
            { $eq: ['$dob', null] },
            null,
            {
              $dateDiff: { startDate: '$dob', endDate: '$$NOW', unit: 'year', timezone: TIMEZONE },
            },
          ],
        },
      },
    },
    {
      $facet: {
        gender: [{ $group: { _id: { $ifNull: ['$u.gender', 'unknown'] }, count: { $sum: 1 } } }],
        age: [
          {
            $bucket: {
              groupBy: '$ageYears',
              boundaries: [18, 30, 40, 50, 60, 200],
              default: 'unknown',
              output: { count: { $sum: 1 } },
            },
          },
        ],
        cities: [
          { $match: { city: { $nin: [null, ''] } } },
          { $group: { _id: '$city', count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 10 },
        ],
        clubs: [
          { $match: { runningClub: { $nin: [null, ''] } } },
          { $group: { _id: '$runningClub', count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 10 },
        ],
        distances: [
          { $match: { distanceLabel: { $nin: [null, ''] } } },
          { $group: { _id: '$distanceLabel', count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 10 },
        ],
        adults: [{ $count: 'n' }],
        kids: [
          { $project: { k: { $size: { $ifNull: ['$kidsRegistrations', []] } } } },
          { $group: { _id: null, n: { $sum: '$k' } } },
        ],
        kidAges: [
          { $unwind: '$kidsRegistrations' },
          {
            $bucket: {
              groupBy: '$kidsRegistrations.age',
              boundaries: [0, 4, 7, 11, 15, 18],
              default: '18+',
              output: { count: { $sum: 1 } },
            },
          },
        ],
        promo: [
          {
            $group: {
              _id: { $cond: [{ $ifNull: ['$promoCodeId', false] }, true, false] },
              count: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]);

  const withPromo = facet?.promo.find(p => p._id === true)?.count ?? 0;
  const withoutPromo = facet?.promo.find(p => p._id === false)?.count ?? 0;

  return {
    gender: toBuckets(facet?.gender ?? []),
    ageCategory: relabel(facet?.age ?? [], AGE_LABELS),
    adultsVsKids: { adults: facet?.adults[0]?.n ?? 0, kids: facet?.kids[0]?.n ?? 0 },
    kidAgeBuckets: relabel(facet?.kidAges ?? [], KID_AGE_LABELS),
    topCities: toBuckets(facet?.cities ?? []),
    topRunningClubs: toBuckets(facet?.clubs ?? []),
    topDistances: toBuckets(facet?.distances ?? []),
    promoUsage: { withPromo, withoutPromo },
    gaps: { country: true, benefit: true },
  };
}

// --------------------------------------------------------------------------
// By-event
// --------------------------------------------------------------------------

export async function getByEvent(scope: AnalyticsScope): Promise<ByEventResponse> {
  const { start, end } = scope;
  const activeIds = await getActiveEventIds();

  const rows = await Registration.aggregate<{
    _id: mongoose.Types.ObjectId;
    registrations: number;
    paid: number;
    revenue: number;
    title?: string;
    titleEn?: string | null;
    titleUk?: string | null;
    date?: Date | null;
    capacity?: number | null;
  }>([
    {
      $match: {
        registeredAt: { $gte: start, $lt: end },
        status: { $ne: 'cancelled' },
        eventId: { $in: activeIds },
      },
    },
    {
      $lookup: {
        from: 'payments',
        localField: '_id',
        foreignField: 'registrationId',
        pipeline: [{ $match: { status: 'completed' } }],
        as: 'pays',
      },
    },
    {
      $group: {
        _id: '$eventId',
        registrations: { $sum: 1 },
        paid: { $sum: { $cond: [{ $gt: [{ $size: '$pays' }, 0] }, 1, 0] } },
        revenue: { $sum: { $sum: '$pays.amount' } },
      },
    },
    { $lookup: { from: 'events', localField: '_id', foreignField: '_id', as: 'ev' } },
    { $unwind: '$ev' },
    {
      $project: {
        registrations: 1,
        paid: 1,
        revenue: 1,
        title: '$ev.title',
        titleEn: '$ev.translations.title.en',
        titleUk: '$ev.translations.title.uk',
        date: '$ev.date',
        capacity: '$ev.capacity',
      },
    },
    { $sort: { date: -1 } },
  ]);

  return rows.map(r => {
    const capacity = r.capacity ?? 0;
    return {
      eventId: r._id.toString(),
      title: r.title ?? '',
      titleEn: r.titleEn ?? null,
      titleUk: r.titleUk ?? null,
      date: r.date ?? null,
      registrations: r.registrations,
      paid: r.paid,
      conversionRate: r.registrations > 0 ? r.paid / r.registrations : 0,
      revenue: r.revenue,
      capacity,
      capacityFillPct: capacity > 0 ? r.registrations / capacity : 0,
    };
  });
}

export default { resolveRange, getSummary, getTimeseries, getDemographics, getByEvent };
