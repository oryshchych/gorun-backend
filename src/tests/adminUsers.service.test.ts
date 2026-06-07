import mongoose from 'mongoose';
import adminUsersService from '../services/adminUsers/adminUsers.service';
import { login } from '../services/auth/auth.service';
import { Payment } from '../models/Payment';
import { Registration } from '../models/Registration';
import { IUser, User } from '../models/User';

interface UserOverrides {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  password?: string;
  isAdmin?: boolean;
  adminRole?: 'admin' | 'super_admin';
}

const seedUser = (overrides: UserOverrides = {}): Promise<IUser> =>
  User.create({
    name: `${overrides.firstName ?? 'Test'} ${overrides.lastName ?? 'User'}`,
    email: overrides.email ?? `user-${new mongoose.Types.ObjectId().toString()}@example.com`,
    password: overrides.password ?? 'password123',
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
    ...(overrides.phone ? { phone: overrides.phone } : {}),
    ...(overrides.city ? { city: overrides.city } : {}),
    ...(overrides.isAdmin ? { isAdmin: true } : {}),
    ...(overrides.adminRole ? { adminRole: overrides.adminRole } : {}),
  });

describe('adminUsers service', () => {
  describe('listAdminUsers', () => {
    it('searches across firstName, lastName, phone, and email', async () => {
      await seedUser({ firstName: 'Olha', lastName: 'Koval', email: 'olha@example.com' });
      await seedUser({ firstName: 'Petro', lastName: 'Bondar', phone: '+380501112233' });
      await seedUser({ firstName: 'Iryna', lastName: 'Shevchenko', email: 'iryna@gorun.ua' });

      const byFirst = await adminUsersService.listAdminUsers({
        page: 1,
        limit: 10,
        search: 'Olha',
      });
      expect(byFirst.data).toHaveLength(1);

      const byLast = await adminUsersService.listAdminUsers({
        page: 1,
        limit: 10,
        search: 'bondar',
      });
      expect(byLast.data).toHaveLength(1);

      const byPhone = await adminUsersService.listAdminUsers({
        page: 1,
        limit: 10,
        search: '0501112233',
      });
      expect(byPhone.data).toHaveLength(1);

      const byEmail = await adminUsersService.listAdminUsers({
        page: 1,
        limit: 10,
        search: 'gorun.ua',
      });
      expect(byEmail.data).toHaveLength(1);
    });

    it('excludes soft-deleted users and paginates', async () => {
      await seedUser({ firstName: 'Active', lastName: 'One' });
      const deleted = await seedUser({ firstName: 'Gone', lastName: 'User' });
      deleted.deletedAt = new Date();
      await deleted.save();

      const res = await adminUsersService.listAdminUsers({ page: 1, limit: 10 });
      expect(res.data).toHaveLength(1);
      expect(res.data[0]?.fullName).toContain('Active');
      expect(res.pagination.total).toBe(1);
    });

    it('filters by source (registered vs app_only) and includes registrationsCount', async () => {
      const registered = await seedUser({ firstName: 'Has', lastName: 'Reg' });
      await seedUser({ firstName: 'No', lastName: 'Reg' });
      const eventId = new mongoose.Types.ObjectId();
      await Registration.create({ eventId, userId: registered._id, email: 'has@example.com' });

      const onlyRegistered = await adminUsersService.listAdminUsers({
        page: 1,
        limit: 10,
        source: 'registered',
      });
      expect(onlyRegistered.data).toHaveLength(1);
      expect(onlyRegistered.data[0]?.id).toBe(registered._id.toString());
      expect(onlyRegistered.data[0]?.registrationsCount).toBe(1);

      const appOnly = await adminUsersService.listAdminUsers({
        page: 1,
        limit: 10,
        source: 'app_only',
      });
      expect(appOnly.data).toHaveLength(1);
      expect(appOnly.data[0]?.fullName).toContain('No');
    });
  });

  describe('getAdminUserById', () => {
    it('returns the user with registrations and payments and never the password', async () => {
      const user = await seedUser({ firstName: 'Detail', lastName: 'User' });
      const eventId = new mongoose.Types.ObjectId();
      const reg = await Registration.create({ eventId, userId: user._id, finalPrice: 500 });
      await Payment.create({ registrationId: reg._id, amount: 500, status: 'completed' });

      const detail = await adminUsersService.getAdminUserById(user._id.toString());
      expect(detail.registrations).toHaveLength(1);
      expect(detail.payments).toHaveLength(1);
      expect(detail.payments[0]?.status).toBe('completed');
      expect((detail as unknown as Record<string, unknown>).password).toBeUndefined();
    });

    it('throws for missing or soft-deleted users', async () => {
      const user = await seedUser();
      user.deletedAt = new Date();
      await user.save();
      await expect(adminUsersService.getAdminUserById(user._id.toString())).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('updateAdminUser', () => {
    it('updates profile fields', async () => {
      const user = await seedUser({ city: 'Lviv' });
      const updated = await adminUsersService.updateAdminUser(user._id.toString(), {
        city: 'Kyiv',
        runningClub: 'GoRun Club',
      });
      expect(updated.city).toBe('Kyiv');
      expect(updated.runningClub).toBe('GoRun Club');
    });

    it('rejects an email already used by another user', async () => {
      await seedUser({ email: 'taken@example.com' });
      const user = await seedUser({ email: 'free@example.com' });
      await expect(
        adminUsersService.updateAdminUser(user._id.toString(), { email: 'taken@example.com' })
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('softDeleteUser', () => {
    it('soft-deletes a user, blocks login, and removes them from the list', async () => {
      const admin = await seedUser({ isAdmin: true });
      const target = await seedUser({ email: 'target@example.com', password: 'password123' });

      await adminUsersService.softDeleteUser(target._id.toString(), admin._id.toString());

      const refreshed = await User.findById(target._id);
      expect(refreshed?.deletedAt).toBeInstanceOf(Date);

      await expect(
        login({ email: 'target@example.com', password: 'password123' })
      ).rejects.toMatchObject({ statusCode: 401 });

      const list = await adminUsersService.listAdminUsers({ page: 1, limit: 10 });
      expect(list.data.some(u => u.id === target._id.toString())).toBe(false);
    });

    it('refuses self-deletion', async () => {
      const admin = await seedUser({ isAdmin: true });
      await expect(
        adminUsersService.softDeleteUser(admin._id.toString(), admin._id.toString())
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('refuses to delete the last super admin', async () => {
      const superAdmin = await seedUser({ isAdmin: true, adminRole: 'super_admin' });
      const actor = await seedUser({ isAdmin: true, adminRole: 'super_admin' });
      // Two super admins exist → deleting one is allowed
      await adminUsersService.softDeleteUser(superAdmin._id.toString(), actor._id.toString());
      // Now only `actor` remains; another admin trying to delete it must be blocked
      const otherAdmin = await seedUser({ isAdmin: true });
      await expect(
        adminUsersService.softDeleteUser(actor._id.toString(), otherAdmin._id.toString())
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('cancelRegistration', () => {
    it('cancels the registration and refunds a completed payment', async () => {
      const user = await seedUser();
      const eventId = new mongoose.Types.ObjectId();
      const reg = await Registration.create({
        eventId,
        userId: user._id,
        status: 'confirmed',
        paymentStatus: 'completed',
      });
      const payment = await Payment.create({
        registrationId: reg._id,
        amount: 400,
        status: 'completed',
      });

      const result = await adminUsersService.cancelRegistration(
        user._id.toString(),
        reg._id.toString(),
        user._id.toString()
      );

      expect(result.registration.status).toBe('cancelled');
      const refreshedReg = await Registration.findById(reg._id);
      expect(refreshedReg?.status).toBe('cancelled');
      const refreshedPayment = await Payment.findById(payment._id);
      expect(refreshedPayment?.status).toBe('refunded');
    });

    it('rejects an already-cancelled registration', async () => {
      const user = await seedUser();
      const eventId = new mongoose.Types.ObjectId();
      const reg = await Registration.create({
        eventId,
        userId: user._id,
        status: 'cancelled',
      });
      await expect(
        adminUsersService.cancelRegistration(
          user._id.toString(),
          reg._id.toString(),
          user._id.toString()
        )
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('throws when the registration does not belong to the user', async () => {
      const user = await seedUser();
      const otherEventId = new mongoose.Types.ObjectId();
      const orphanReg = await Registration.create({ eventId: otherEventId });
      await expect(
        adminUsersService.cancelRegistration(
          user._id.toString(),
          orphanReg._id.toString(),
          user._id.toString()
        )
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('exportAdminUsersCsv', () => {
    it('produces a CSV with a header row and one line per user', async () => {
      await seedUser({ firstName: 'Csv', lastName: 'One', email: 'csv1@example.com' });
      await seedUser({ firstName: 'Csv', lastName: 'Two', email: 'csv2@example.com' });

      const csv = await adminUsersService.exportAdminUsersCsv({});
      const lines = csv.split('\r\n');
      expect(lines[0]).toBe('Full name,Phone,Email,City,Registrations,Created');
      expect(lines).toHaveLength(3);
    });

    it('escapes cells containing commas', async () => {
      await seedUser({ firstName: 'Comma', lastName: 'User', city: 'Lviv, Ukraine' });
      const csv = await adminUsersService.exportAdminUsersCsv({});
      expect(csv).toContain('"Lviv, Ukraine"');
    });
  });
});
