import { z } from 'zod';
import { analyticsQuerySchema } from '../../validators/adminAnalytics.validator';

/** Validated query as it leaves the Zod schema (raw preset + optional dates). */
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

/** Concrete, resolved date window shared by every analytics aggregation. */
export interface AnalyticsRange {
  /** Inclusive lower bound. */
  start: Date;
  /** Exclusive upper bound. */
  end: Date;
}

/** Common scope passed into the service layer after the range is resolved. */
export interface AnalyticsScope extends AnalyticsRange {
  /** When set, every metric is scoped to this single event (drill-in). */
  eventId?: string;
}

// --------------------------------------------------------------------------
// Summary (KPI cards)
// --------------------------------------------------------------------------

export interface SummaryResponse {
  /** Non-cancelled registrations in the period/scope. */
  totalRegistrations: number;
  /** Registrations with at least one completed payment. */
  paidRegistrations: number;
  /** Sum of completed payment amounts (UAH). Source of truth for revenue. */
  moneyGathered: number;
  /** paidRegistrations / totalRegistrations (0..1). */
  conversionRate: number;
  /** moneyGathered / paidRegistrations (UAH), 0 when none paid. */
  averageCheck: number;
  /** AFU donations collected from paid registrations (UAH). */
  afuDonationsTotal: number;
  /** Sum of refunded payment amounts (UAH). */
  refundsTotal: number;
  refundsCount: number;
  /** moneyGathered − refundsTotal (UAH). */
  netRevenue: number;
  cancelledRegistrations: number;
  /** Total nested kid entries across registrations in scope. */
  kidsRegistrations: number;
  newParticipants: number;
  returningParticipants: number;
}

// --------------------------------------------------------------------------
// Timeseries
// --------------------------------------------------------------------------

export interface RegistrationDayPoint {
  date: string; // YYYY-MM-DD (Europe/Kyiv)
  count: number;
  cumulative: number;
}

export interface PaymentDayPoint {
  date: string;
  count: number;
  sum: number;
}

export interface CombinedDayPoint {
  date: string;
  registrations: number;
  payments: number;
  revenue: number;
}

export interface TimeseriesResponse {
  registrationsByDay: RegistrationDayPoint[];
  paymentsByDay: PaymentDayPoint[];
  combinedByDay: CombinedDayPoint[];
}

// --------------------------------------------------------------------------
// Demographics
// --------------------------------------------------------------------------

export interface Bucket {
  label: string;
  count: number;
}

export interface DemographicsResponse {
  gender: Bucket[];
  ageCategory: Bucket[];
  adultsVsKids: { adults: number; kids: number };
  kidAgeBuckets: Bucket[];
  topCities: Bucket[];
  topRunningClubs: Bucket[];
  topDistances: Bucket[];
  promoUsage: { withPromo: number; withoutPromo: number };
  /** Breakdowns the schema does not yet capture — UI renders a "not collected" note. */
  gaps: { country: boolean; benefit: boolean };
}

// --------------------------------------------------------------------------
// By-event
// --------------------------------------------------------------------------

export interface ByEventRow {
  eventId: string;
  title: string;
  titleEn: string | null;
  titleUk: string | null;
  date: Date | null;
  registrations: number;
  paid: number;
  conversionRate: number;
  revenue: number;
  capacity: number;
  capacityFillPct: number;
}

export type ByEventResponse = ByEventRow[];
