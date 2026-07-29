import { IPromoCode } from '../models/PromoCode';
import type { PricePeriod } from '../models/Event';

export interface PriceBreakdown {
  finalPrice: number;
  discountAmount: number;
}

export const calculatePrice = (
  basePrice: number,
  promoCode?: IPromoCode | null
): PriceBreakdown => {
  if (!promoCode || !promoCode.isActive) {
    return { finalPrice: Math.max(0, basePrice), discountAmount: 0 };
  }

  let discountAmount = 0;

  if (promoCode.discountType === 'percentage') {
    discountAmount = (basePrice * promoCode.discountValue) / 100;
  } else if (promoCode.discountType === 'amount') {
    discountAmount = promoCode.discountValue;
  }

  const finalPrice = Math.max(0, basePrice - discountAmount);

  return { finalPrice, discountAmount };
};

/** A distance/kids-distance shape carrying enough to derive its price. */
interface PriceablePeriods {
  feeUah?: number;
  pricePeriods?: PricePeriod[];
}

/**
 * Resolve the effective UAH price for a distance at a given moment.
 *
 * Newer events price distances through timed `pricePeriods` (each a
 * `{ from, to, price }` tier) and omit the flat `feeUah`; older ones only carry
 * `feeUah`. Returns `undefined` when neither is present, so callers can decide
 * whether to fall back to the event-level base price or reject the request.
 *
 * Selection rules when `pricePeriods` are present:
 * - a period whose `[from, to]` range contains `now` wins;
 * - before every period → the earliest (upcoming) period's price;
 * - after every period → the latest period's price;
 * - between gaps → the most recent period that has already started.
 */
export const resolveDistancePrice = (
  distance: PriceablePeriods,
  now: Date = new Date()
): number | undefined => {
  const periods = distance.pricePeriods;

  if (periods && periods.length > 0) {
    const price = resolvePricePeriod(periods, now.getTime());
    if (price !== undefined) return price;
  }

  return distance.feeUah;
};

const resolvePricePeriod = (periods: PricePeriod[], nowMs: number): number | undefined => {
  const sorted = periods
    .map(p => ({
      from: new Date(p.from).getTime(),
      to: new Date(p.to).getTime(),
      price: p.price,
    }))
    .filter(p => Number.isFinite(p.from) && Number.isFinite(p.price))
    .sort((a, b) => a.from - b.from);

  if (sorted.length === 0) return undefined;

  const active = sorted.find(p => nowMs >= p.from && nowMs <= p.to);
  if (active) return active.price;

  // Before the first tier opens → show the upcoming (earliest) price.
  if (nowMs < sorted[0]!.from) return sorted[0]!.price;

  // Otherwise fall to the most recent tier that has already started.
  const started = sorted.filter(p => p.from <= nowMs);
  return started[started.length - 1]!.price;
};

/** A distance option as stored on the event (only pricing-relevant fields typed). */
interface PriceableDistance extends PriceablePeriods {
  id?: string;
}

export interface RegistrationPriceInput {
  /** Event distances (race options). */
  distances?: PriceableDistance[] | undefined;
  /** Event kids-race options. */
  kidsDistances?: PriceableDistance[] | undefined;
  /** Selected race distance id. */
  distanceId?: string | undefined;
  /** Kids sign-ups, each pointing at a kids-distance id. */
  kidsRegistrations?: { distanceId: string }[] | undefined;
  /** Optional AFU (charity) donation, charged at full value. */
  afuDonation?: number | undefined;
  /** Event-level flat price, used when the selected distance has no price. */
  basePrice?: number | undefined;
  /** Validated promo code (discounts the race price only). */
  promoCode?: IPromoCode | null | undefined;
  /** Evaluation moment for timed pricing tiers. */
  now?: Date | undefined;
}

export interface RegistrationPriceBreakdown {
  /** Pre-discount race (distance) price. */
  distancePrice: number;
  /** Sum of kids-race fees (never discounted). */
  kidsTotal: number;
  /** AFU donation included in the charge (never discounted). */
  afuDonation: number;
  /** Pre-discount grand total: distance + kids + donation. */
  subtotal: number;
  /** Discount actually applied (capped at the race price). */
  discountAmount: number;
  /** Amount to charge: subtotal minus the applied discount. */
  finalPrice: number;
}

/**
 * Compute the authoritative amount to charge for a registration.
 *
 * The race (distance) price is resolved server-side from the selected
 * distance's `pricePeriods` / `feeUah`, falling back to the event `basePrice`
 * when the distance carries no price. A promo code discounts the race price
 * only; kids-race fees and the AFU donation are added on top at full value.
 *
 * Returns `null` when no race price can be resolved and no `basePrice` fallback
 * exists — the caller should treat that as "price not configured".
 */
export const calculateRegistrationPrice = (
  input: RegistrationPriceInput
): RegistrationPriceBreakdown | null => {
  const now = input.now ?? new Date();

  const selected = input.distanceId
    ? input.distances?.find(d => d.id === input.distanceId)
    : undefined;
  const resolvedDistance = selected ? resolveDistancePrice(selected, now) : undefined;
  const distancePrice = resolvedDistance ?? input.basePrice;

  if (distancePrice === undefined) {
    return null;
  }

  const { finalPrice: distanceFinal } = calculatePrice(distancePrice, input.promoCode);

  const kidsTotal = (input.kidsRegistrations ?? []).reduce((sum, kid) => {
    const kidsDistance = input.kidsDistances?.find(d => d.id === kid.distanceId);
    const price = kidsDistance ? resolveDistancePrice(kidsDistance, now) : undefined;
    return sum + (price ?? 0);
  }, 0);

  const afuDonation = input.afuDonation && input.afuDonation > 0 ? input.afuDonation : 0;

  const subtotal = distancePrice + kidsTotal + afuDonation;
  const finalPrice = Math.max(0, distanceFinal + kidsTotal + afuDonation);
  // Report the discount actually applied (race price floors at 0), so the
  // e-mail invariant subtotal − discountAmount === finalPrice always holds.
  const discountAmount = subtotal - finalPrice;

  return { distancePrice, kidsTotal, afuDonation, subtotal, discountAmount, finalPrice };
};
