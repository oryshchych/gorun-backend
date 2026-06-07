import mongoose from 'mongoose';
import { Event } from '../../models/Event';
import { IPayment, Payment } from '../../models/Payment';
import { IRegistration, Registration } from '../../models/Registration';
import { IUser, User } from '../../models/User';
import { ADMIN_USERS_CODES } from '../../types/codes';
import { ConflictError, ForbiddenError, NotFoundError } from '../../types/errors';
import {
  PaginatedResponse,
  formatPaginatedResponse,
  getPaginationParams,
} from '../../utils/pagination.util';
import { pickDefined } from '../../utils/pickDefined.util';
import type {
  AdminUserDetailResponse,
  AdminUserExportQuery,
  AdminUserListItem,
  AdminUserListQuery,
  AdminUserPayment,
  AdminUserRegistration,
  CancelRegistrationResult,
  UpdateAdminUserInput,
} from './adminUsers.types';

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

/** Builds the Mongo filter shared by list + export (excludes soft-deleted users). */
async function buildUserFilter(query: {
  search?: string;
  source?: 'all' | 'registered' | 'app_only';
}): Promise<mongoose.FilterQuery<IUser>> {
  const filter: mongoose.FilterQuery<IUser> = { deletedAt: null };

  if (query.search?.trim()) {
    const re = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = [{ firstName: re }, { lastName: re }, { name: re }, { phone: re }, { email: re }];
  }

  if (query.source === 'registered' || query.source === 'app_only') {
    const registeredIds = (await Registration.distinct('userId', {
      userId: { $ne: null },
    })) as mongoose.Types.ObjectId[];
    filter._id = query.source === 'registered' ? { $in: registeredIds } : { $nin: registeredIds };
  }

  return filter;
}

/** Counts registrations per user id for the given page of users. */
async function countRegistrationsByUser(
  userIds: mongoose.Types.ObjectId[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (userIds.length === 0) return map;
  const rows = await Registration.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { userId: { $in: userIds } } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
  ]);
  for (const row of rows) {
    map.set(row._id.toString(), row.count);
  }
  return map;
}

function formatRegistration(
  doc: Pick<
    IRegistration,
    'eventId' | 'status' | 'paymentStatus' | 'distanceLabel' | 'finalPrice' | 'registeredAt'
  > & { _id: mongoose.Types.ObjectId },
  eventName: string | null
): AdminUserRegistration {
  return {
    id: doc._id.toString(),
    eventId: doc.eventId ? doc.eventId.toString() : null,
    eventName,
    status: doc.status,
    paymentStatus: doc.paymentStatus,
    distanceLabel: doc.distanceLabel ?? null,
    finalPrice: doc.finalPrice ?? null,
    registeredAt: doc.registeredAt,
  };
}

function formatPayment(
  doc: Pick<
    IPayment,
    'registrationId' | 'amount' | 'currency' | 'status' | 'createdAt' | 'updatedAt'
  > & {
    _id: mongoose.Types.ObjectId;
  }
): AdminUserPayment {
  return {
    id: doc._id.toString(),
    registrationId: doc.registrationId.toString(),
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

export async function listAdminUsers(
  query: AdminUserListQuery
): Promise<PaginatedResponse<AdminUserListItem>> {
  const { page, limit, skip } = getPaginationParams(query.page, query.limit);
  const filter = await buildUserFilter(query);

  const [total, docs] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select('name firstName lastName email phone city createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const countMap = await countRegistrationsByUser(docs.map(d => d._id));

  const data: AdminUserListItem[] = docs.map(d => ({
    id: d._id.toString(),
    fullName: d.name,
    firstName: d.firstName ?? null,
    lastName: d.lastName ?? null,
    email: d.email,
    phone: d.phone ?? null,
    city: d.city ?? null,
    registrationsCount: countMap.get(d._id.toString()) ?? 0,
    createdAt: d.createdAt,
  }));

  return formatPaginatedResponse(data, total, page, limit);
}

// --------------------------------------------------------------------------
// Detail
// --------------------------------------------------------------------------

export async function getAdminUserById(id: string): Promise<AdminUserDetailResponse> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new NotFoundError('User not found', ADMIN_USERS_CODES.ERROR_ADMIN_USER_NOT_FOUND);
  }
  const user = await User.findOne({ _id: id, deletedAt: null }).select('-password').lean();
  if (!user) {
    throw new NotFoundError('User not found', ADMIN_USERS_CODES.ERROR_ADMIN_USER_NOT_FOUND);
  }

  const registrations = await Registration.find({ userId: id })
    .select('eventId status paymentStatus distanceLabel finalPrice registeredAt')
    .sort({ registeredAt: -1 })
    .lean();

  const eventNames = await resolveEventNames(
    registrations.flatMap(r => (r.eventId ? [r.eventId.toString()] : []))
  );

  const regIds = registrations.map(r => r._id);
  const payments =
    regIds.length > 0
      ? await Payment.find({ registrationId: { $in: regIds } })
          .select('registrationId amount currency status createdAt updatedAt')
          .sort({ createdAt: -1 })
          .lean()
      : [];

  return {
    id: user._id.toString(),
    name: user.name,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    email: user.email,
    phone: user.phone ?? null,
    image: user.image ?? null,
    provider: user.provider,
    dateOfBirth: user.dateOfBirth ?? null,
    gender: user.gender ?? null,
    emergencyContactName: user.emergencyContactName ?? null,
    emergencyContactPhone: user.emergencyContactPhone ?? null,
    runningClub: user.runningClub ?? null,
    city: user.city ?? null,
    deliveryAddress: user.deliveryAddress ?? null,
    isAdmin: user.isAdmin,
    adminRole: user.adminRole ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    registrations: registrations.map(r =>
      formatRegistration(r, r.eventId ? (eventNames.get(r.eventId.toString()) ?? null) : null)
    ),
    payments: payments.map(formatPayment),
  };
}

// --------------------------------------------------------------------------
// Update (profile/contact only)
// --------------------------------------------------------------------------

const NULLABLE_FIELDS = [
  'phone',
  'dateOfBirth',
  'gender',
  'emergencyContactName',
  'emergencyContactPhone',
  'runningClub',
  'city',
  'deliveryAddress',
] as const;

export async function updateAdminUser(
  id: string,
  input: UpdateAdminUserInput
): Promise<AdminUserDetailResponse> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new NotFoundError('User not found', ADMIN_USERS_CODES.ERROR_ADMIN_USER_NOT_FOUND);
  }
  const user = await User.findOne({ _id: id, deletedAt: null });
  if (!user) {
    throw new NotFoundError('User not found', ADMIN_USERS_CODES.ERROR_ADMIN_USER_NOT_FOUND);
  }

  const patch = pickDefined<UpdateAdminUserInput>(input as Record<string, unknown>);

  // Uniqueness checks against the global indexes (email unique, phone unique sparse).
  if (patch.email !== undefined && patch.email !== user.email) {
    const taken = await User.findOne({ email: patch.email, _id: { $ne: user._id } });
    if (taken) {
      throw new ConflictError(
        'Email already in use',
        ADMIN_USERS_CODES.ERROR_ADMIN_USER_EMAIL_EXISTS
      );
    }
    user.email = patch.email;
  }

  if (patch.phone !== undefined && patch.phone !== null && patch.phone !== user.phone) {
    const taken = await User.findOne({ phone: patch.phone, _id: { $ne: user._id } });
    if (taken) {
      throw new ConflictError(
        'Phone already in use',
        ADMIN_USERS_CODES.ERROR_ADMIN_USER_PHONE_EXISTS
      );
    }
  }

  if (patch.firstName !== undefined) user.firstName = patch.firstName;
  if (patch.lastName !== undefined) user.lastName = patch.lastName;

  // Nullable optional fields: null clears, a value sets.
  for (const field of NULLABLE_FIELDS) {
    if (!(field in patch)) continue;
    const value = patch[field];
    if (value === null) {
      user.set(field, undefined);
    } else if (value !== undefined) {
      user.set(field, value);
    }
  }

  await user.save();
  return getAdminUserById(user._id.toString());
}

// --------------------------------------------------------------------------
// Soft delete (deactivate)
// --------------------------------------------------------------------------

export async function softDeleteUser(
  id: string,
  actingAdminId: string
): Promise<{ id: string; deletedAt: Date }> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new NotFoundError('User not found', ADMIN_USERS_CODES.ERROR_ADMIN_USER_NOT_FOUND);
  }
  if (id === actingAdminId) {
    throw new ForbiddenError(
      'You cannot deactivate your own account',
      ADMIN_USERS_CODES.ERROR_ADMIN_USER_CANNOT_DELETE_SELF
    );
  }

  const user = await User.findOne({ _id: id, deletedAt: null });
  if (!user) {
    throw new NotFoundError('User not found', ADMIN_USERS_CODES.ERROR_ADMIN_USER_NOT_FOUND);
  }

  if (user.adminRole === 'super_admin') {
    const superAdmins = await User.countDocuments({ adminRole: 'super_admin', deletedAt: null });
    if (superAdmins <= 1) {
      throw new ForbiddenError(
        'Cannot deactivate the last super admin',
        ADMIN_USERS_CODES.ERROR_ADMIN_USER_CANNOT_DELETE_LAST_SUPER_ADMIN
      );
    }
  }

  const deletedAt = new Date();
  user.deletedAt = deletedAt;
  await user.save();

  return { id: user._id.toString(), deletedAt };
}

// --------------------------------------------------------------------------
// Cancel a single registration (+ refund/cancel its payments)
// --------------------------------------------------------------------------

export async function cancelRegistration(
  userId: string,
  registrationId: string,
  _actingAdminId: string
): Promise<CancelRegistrationResult> {
  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(registrationId)
  ) {
    throw new NotFoundError(
      'Registration not found',
      ADMIN_USERS_CODES.ERROR_ADMIN_USER_REGISTRATION_NOT_FOUND
    );
  }

  const registration = await Registration.findOne({ _id: registrationId, userId });
  if (!registration) {
    throw new NotFoundError(
      'Registration not found',
      ADMIN_USERS_CODES.ERROR_ADMIN_USER_REGISTRATION_NOT_FOUND
    );
  }
  if (registration.status === 'cancelled') {
    throw new ConflictError(
      'Registration is already cancelled',
      ADMIN_USERS_CODES.ERROR_ADMIN_USER_REGISTRATION_ALREADY_CANCELLED
    );
  }

  registration.status = 'cancelled';
  await registration.save();

  // Refund completed payments; mark still-pending payments as failed.
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
    registration: formatRegistration(registration, eventName),
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

export async function exportAdminUsersCsv(query: AdminUserExportQuery): Promise<string> {
  const filter = await buildUserFilter(query);
  const docs = await User.find(filter)
    .select('name email phone city createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const countMap = await countRegistrationsByUser(docs.map(d => d._id));

  const header = ['Full name', 'Phone', 'Email', 'City', 'Registrations', 'Created'];
  const rows = docs.map(d =>
    [
      csvCell(d.name),
      csvCell(d.phone),
      csvCell(d.email),
      csvCell(d.city),
      csvCell(countMap.get(d._id.toString()) ?? 0),
      csvCell(d.createdAt.toISOString()),
    ].join(',')
  );

  return [header.join(','), ...rows].join('\r\n');
}

export default {
  listAdminUsers,
  getAdminUserById,
  updateAdminUser,
  softDeleteUser,
  cancelRegistration,
  exportAdminUsersCsv,
};
