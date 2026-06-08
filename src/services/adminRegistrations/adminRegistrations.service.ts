import mongoose from 'mongoose';
import { Event } from '../../models/Event';
import { IPayment, Payment } from '../../models/Payment';
import { IRegistration, Registration } from '../../models/Registration';
import { User } from '../../models/User';
import { ADMIN_REGISTRATIONS_CODES } from '../../types/codes';
import { ConflictError, NotFoundError } from '../../types/errors';
import {
  PaginatedResponse,
  formatPaginatedResponse,
  getPaginationParams,
} from '../../utils/pagination.util';
import type {
  AdminRegPayment,
  AdminRegistrationDetail,
  AdminRegistrationExportQuery,
  AdminRegistrationListItem,
  AdminRegistrationListQuery,
  CancelAdminRegistrationResult,
  KidRegistration,
} from './adminRegistrations.types';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Batch-resolve event display names (en → uk → legacy title) for a set of ids. */
async function resolveEventNames(eventIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(eventIds)];
  if (unique.length === 0) return map;
  const events = await Event.find({ _id: { $in: unique } })
    .select('title translations.title')
    .lean();
  for (const e of events) {
    const name = e.translations?.title?.en ?? e.translations?.title?.uk ?? e.title;
    map.set(e._id.toString(), name);
  }
  return map;
}

/** Builds the Mongo filter shared by list + export. */
function buildRegistrationFilter(query: {
  search?: string | undefined;
  status?: 'pending' | 'confirmed' | 'cancelled' | undefined;
  paymentStatus?: 'pending' | 'completed' | 'failed' | 'refunded' | undefined;
  eventId?: string | undefined;
}): mongoose.FilterQuery<IRegistration> {
  const filter: mongoose.FilterQuery<IRegistration> = {};

  if (query.search?.trim()) {
    const re = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = [{ name: re }, { surname: re }, { email: re }, { phone: re }];
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.paymentStatus) {
    filter.paymentStatus = query.paymentStatus;
  }

  if (query.eventId) {
    filter.eventId = new mongoose.Types.ObjectId(query.eventId);
  }

  return filter;
}

function formatListItem(
  doc: Pick<
    IRegistration,
    | 'name'
    | 'surname'
    | 'email'
    | 'phone'
    | 'eventId'
    | 'distanceLabel'
    | 'bib'
    | 'finalPrice'
    | 'paymentStatus'
    | 'status'
    | 'registeredAt'
  > & { _id: mongoose.Types.ObjectId },
  eventName: string | null
): AdminRegistrationListItem {
  return {
    id: doc._id.toString(),
    fullName: `${doc.name ?? ''} ${doc.surname ?? ''}`.trim(),
    name: doc.name ?? '',
    surname: doc.surname ?? '',
    email: doc.email ?? '',
    phone: doc.phone ?? null,
    eventId: doc.eventId ? doc.eventId.toString() : null,
    eventName,
    distanceLabel: doc.distanceLabel ?? null,
    bib: doc.bib ?? null,
    finalPrice: doc.finalPrice ?? null,
    paymentStatus: doc.paymentStatus,
    status: doc.status,
    registeredAt: doc.registeredAt,
  };
}

function formatPayment(
  doc: Pick<IPayment, 'amount' | 'currency' | 'status' | 'createdAt' | 'updatedAt'> & {
    _id: mongoose.Types.ObjectId;
  }
): AdminRegPayment {
  return {
    id: doc._id.toString(),
    amount: doc.amount,
    currency: doc.currency,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// --------------------------------------------------------------------------
// List
// --------------------------------------------------------------------------

export async function listAdminRegistrations(
  query: AdminRegistrationListQuery
): Promise<PaginatedResponse<AdminRegistrationListItem>> {
  const { page, limit, skip } = getPaginationParams(query.page, query.limit);
  const filter = buildRegistrationFilter(query);

  const [total, docs] = await Promise.all([
    Registration.countDocuments(filter),
    Registration.find(filter)
      .select(
        'name surname email phone eventId distanceLabel bib finalPrice paymentStatus status registeredAt'
      )
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const eventNames = await resolveEventNames(
    docs.flatMap(d => (d.eventId ? [d.eventId.toString()] : []))
  );

  const data: AdminRegistrationListItem[] = docs.map(d =>
    formatListItem(d, d.eventId ? (eventNames.get(d.eventId.toString()) ?? null) : null)
  );

  return formatPaginatedResponse(data, total, page, limit);
}

// --------------------------------------------------------------------------
// Detail
// --------------------------------------------------------------------------

export async function getAdminRegistrationById(id: string): Promise<AdminRegistrationDetail> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new NotFoundError(
      'Registration not found',
      ADMIN_REGISTRATIONS_CODES.ERROR_ADMIN_REGISTRATION_NOT_FOUND
    );
  }

  const reg = await Registration.findById(id).lean();
  if (!reg) {
    throw new NotFoundError(
      'Registration not found',
      ADMIN_REGISTRATIONS_CODES.ERROR_ADMIN_REGISTRATION_NOT_FOUND
    );
  }

  // Resolve event name
  const eventName = reg.eventId
    ? ((await resolveEventNames([reg.eventId.toString()])).get(reg.eventId.toString()) ?? null)
    : null;

  // Resolve linked user name (if any)
  let userName: string | null = null;
  if (reg.userId) {
    const user = await User.findById(reg.userId).select('name').lean();
    userName = user?.name ?? null;
  }

  // Linked payments
  const payments = await Payment.find({ registrationId: reg._id })
    .select('amount currency status createdAt updatedAt')
    .sort({ createdAt: -1 })
    .lean();

  // Map kids registrations
  const kidsRegistrations: KidRegistration[] = (reg.kidsRegistrations ?? []).map(k => ({
    kidId: k.kidId ?? '',
    name: k.name ?? '',
    age: k.age ?? null,
    distanceId: k.distanceId ?? null,
    distanceLabel: k.distanceLabel ?? null,
    shirtSize: k.shirtSize ?? null,
  }));

  const listItem = formatListItem(reg, eventName);

  return {
    ...listItem,
    city: reg.city ?? null,
    runningClub: reg.runningClub ?? null,
    shirtSize: reg.shirtSize ?? null,
    estimatedPace: reg.estimatedPace ?? null,
    promoCode: reg.promoCode ?? null,
    afuDonation: reg.afuDonation ?? null,
    kidsRegistrations,
    userId: reg.userId ? reg.userId.toString() : null,
    userName,
    payments: payments.map(formatPayment),
  };
}

// --------------------------------------------------------------------------
// Cancel
// --------------------------------------------------------------------------

export async function cancelAdminRegistration(id: string): Promise<CancelAdminRegistrationResult> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new NotFoundError(
      'Registration not found',
      ADMIN_REGISTRATIONS_CODES.ERROR_ADMIN_REGISTRATION_NOT_FOUND
    );
  }

  const registration = await Registration.findById(id);
  if (!registration) {
    throw new NotFoundError(
      'Registration not found',
      ADMIN_REGISTRATIONS_CODES.ERROR_ADMIN_REGISTRATION_NOT_FOUND
    );
  }

  if (registration.status === 'cancelled') {
    throw new ConflictError(
      'Registration is already cancelled',
      ADMIN_REGISTRATIONS_CODES.ERROR_ADMIN_REGISTRATION_ALREADY_CANCELLED
    );
  }

  registration.status = 'cancelled';
  await registration.save();

  // Refund completed payments; mark pending payments as failed.
  const paymentDocs = await Payment.find({ registrationId: registration._id });
  for (const payment of paymentDocs) {
    if (payment.status === 'completed') {
      payment.status = 'refunded';
      await payment.save();
    } else if (payment.status === 'pending') {
      payment.status = 'failed';
      await payment.save();
    }
  }

  const eventName = registration.eventId
    ? ((await resolveEventNames([registration.eventId.toString()])).get(
        registration.eventId.toString()
      ) ?? null)
    : null;

  return {
    registration: formatListItem(registration, eventName),
    payments: paymentDocs.map(formatPayment),
  };
}

// --------------------------------------------------------------------------
// CSV export
// --------------------------------------------------------------------------

function csvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportAdminRegistrationsCsv(
  query: AdminRegistrationExportQuery
): Promise<string> {
  const filter = buildRegistrationFilter(query);
  const docs = await Registration.find(filter)
    .select(
      'name surname email phone eventId distanceLabel bib finalPrice paymentStatus status registeredAt'
    )
    .sort({ registeredAt: -1 })
    .lean();

  const eventNames = await resolveEventNames(
    docs.flatMap(d => (d.eventId ? [d.eventId.toString()] : []))
  );

  const header = [
    'Full name',
    'Email',
    'Phone',
    'Event',
    'Distance',
    'Bib',
    'Amount (UAH)',
    'Payment status',
    'Status',
    'Registered at',
  ];

  const rows = docs.map(d => {
    const eventName = d.eventId ? (eventNames.get(d.eventId.toString()) ?? '') : '';
    const fullName = `${d.name ?? ''} ${d.surname ?? ''}`.trim();
    return [
      csvCell(fullName),
      csvCell(d.email),
      csvCell(d.phone),
      csvCell(eventName),
      csvCell(d.distanceLabel),
      csvCell(d.bib),
      csvCell(d.finalPrice),
      csvCell(d.paymentStatus),
      csvCell(d.status),
      csvCell(d.registeredAt.toISOString()),
    ].join(',');
  });

  return [header.join(','), ...rows].join('\r\n');
}

export default {
  listAdminRegistrations,
  getAdminRegistrationById,
  cancelAdminRegistration,
  exportAdminRegistrationsCsv,
};
