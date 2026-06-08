import mongoose from 'mongoose';
import adminRegistrationsService from '../services/adminRegistrations/adminRegistrations.service';
import { Event } from '../models/Event';
import { Payment } from '../models/Payment';
import { Registration } from '../models/Registration';
import { User } from '../models/User';

const makeEventId = () => new mongoose.Types.ObjectId();

async function seedRegistration(overrides: {
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
  city?: string;
  status?: 'pending' | 'confirmed' | 'cancelled';
  paymentStatus?: 'pending' | 'completed' | 'failed';
  finalPrice?: number;
  distanceLabel?: string;
  bib?: string;
  eventId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
}) {
  return Registration.create({
    name: overrides.name ?? 'Test',
    surname: overrides.surname ?? 'User',
    email: overrides.email ?? `reg-${new mongoose.Types.ObjectId().toString()}@example.com`,
    phone: overrides.phone,
    city: overrides.city,
    status: overrides.status ?? 'confirmed',
    paymentStatus: overrides.paymentStatus ?? 'completed',
    finalPrice: overrides.finalPrice ?? 500,
    distanceLabel: overrides.distanceLabel ?? '10K',
    bib: overrides.bib,
    eventId: overrides.eventId ?? makeEventId(),
    userId: overrides.userId,
  });
}

describe('adminRegistrations service', () => {
  describe('listAdminRegistrations', () => {
    it('searches across name, surname, email, and phone', async () => {
      await seedRegistration({ name: 'Olha', surname: 'Koval', email: 'olha@example.com' });
      await seedRegistration({ name: 'Petro', surname: 'Bondar', phone: '+380501112233' });
      await seedRegistration({ name: 'Iryna', surname: 'Shevchenko', email: 'iryna@gorun.ua' });

      const byName = await adminRegistrationsService.listAdminRegistrations({
        page: 1,
        limit: 10,
        search: 'Olha',
      });
      expect(byName.data).toHaveLength(1);

      const bySurname = await adminRegistrationsService.listAdminRegistrations({
        page: 1,
        limit: 10,
        search: 'bondar',
      });
      expect(bySurname.data).toHaveLength(1);

      const byPhone = await adminRegistrationsService.listAdminRegistrations({
        page: 1,
        limit: 10,
        search: '0501112233',
      });
      expect(byPhone.data).toHaveLength(1);

      const byEmail = await adminRegistrationsService.listAdminRegistrations({
        page: 1,
        limit: 10,
        search: 'gorun.ua',
      });
      expect(byEmail.data).toHaveLength(1);
    });

    it('filters by status', async () => {
      await seedRegistration({ name: 'Alpha', surname: 'One', status: 'confirmed' });
      await seedRegistration({ name: 'Beta', surname: 'Two', status: 'pending' });
      await seedRegistration({ name: 'Gamma', surname: 'Three', status: 'cancelled' });

      const confirmed = await adminRegistrationsService.listAdminRegistrations({
        page: 1,
        limit: 10,
        status: 'confirmed',
      });
      expect(confirmed.data).toHaveLength(1);
      expect(confirmed.data[0]?.status).toBe('confirmed');

      const pending = await adminRegistrationsService.listAdminRegistrations({
        page: 1,
        limit: 10,
        status: 'pending',
      });
      expect(pending.data).toHaveLength(1);
    });

    it('filters by paymentStatus', async () => {
      await seedRegistration({ name: 'Paid', surname: 'User', paymentStatus: 'completed' });
      await seedRegistration({ name: 'Unpaid', surname: 'User', paymentStatus: 'pending' });

      const paid = await adminRegistrationsService.listAdminRegistrations({
        page: 1,
        limit: 10,
        paymentStatus: 'completed',
      });
      expect(paid.data).toHaveLength(1);
      expect(paid.data[0]?.paymentStatus).toBe('completed');
    });

    it('filters by eventId', async () => {
      const eventId = makeEventId();
      await seedRegistration({ name: 'Event', surname: 'Reg', eventId });
      await seedRegistration({ name: 'Other', surname: 'Reg', eventId: makeEventId() });

      const result = await adminRegistrationsService.listAdminRegistrations({
        page: 1,
        limit: 10,
        eventId: eventId.toString(),
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.eventId).toBe(eventId.toString());
    });

    it('paginates correctly', async () => {
      for (let i = 0; i < 5; i++) {
        await seedRegistration({ name: `Runner${i}`, surname: 'Test' });
      }
      const page1 = await adminRegistrationsService.listAdminRegistrations({
        page: 1,
        limit: 3,
      });
      expect(page1.data).toHaveLength(3);
      expect(page1.pagination.totalPages).toBe(2);

      const page2 = await adminRegistrationsService.listAdminRegistrations({
        page: 2,
        limit: 3,
      });
      expect(page2.data).toHaveLength(2);
    });

    it('batch-resolves event names without N+1', async () => {
      const eventId = makeEventId();
      await Event.create({
        _id: eventId,
        title: 'Spring Run',
        description: 'Annual spring running event',
        translations: { title: { en: 'Spring Run', uk: 'Весняний забіг' } },
        date: new Date('2026-05-01'),
        location: 'Kyiv',
        capacity: 500,
        organizerId: new mongoose.Types.ObjectId(),
        distances: [],
      });
      await seedRegistration({ name: 'Runner', surname: 'Alpha', eventId });
      await seedRegistration({ name: 'Runner', surname: 'Beta', eventId });

      const result = await adminRegistrationsService.listAdminRegistrations({
        page: 1,
        limit: 10,
        search: 'Runner',
      });
      expect(result.data).toHaveLength(2);
      result.data.forEach(item => {
        expect(item.eventName).toBe('Spring Run');
      });
    });
  });

  describe('getAdminRegistrationById', () => {
    it('returns full detail including payments and resolves userName', async () => {
      const user = await User.create({
        name: 'Linked User',
        email: 'linked@example.com',
        password: 'password123',
      });
      const reg = await seedRegistration({
        name: 'Detail',
        surname: 'Test',
        userId: user._id,
      });
      await Payment.create({
        registrationId: reg._id,
        amount: 500,
        status: 'completed',
      });

      const detail = await adminRegistrationsService.getAdminRegistrationById(reg._id.toString());
      expect(detail.fullName).toBe('Detail Test');
      expect(detail.payments).toHaveLength(1);
      expect(detail.payments[0]?.status).toBe('completed');
      expect(detail.userId).toBe(user._id.toString());
      expect(detail.userName).toBe('Linked User');
    });

    it('returns null userName when no userId', async () => {
      const reg = await seedRegistration({ name: 'Guest', surname: 'User' });
      const detail = await adminRegistrationsService.getAdminRegistrationById(reg._id.toString());
      expect(detail.userId).toBeNull();
      expect(detail.userName).toBeNull();
    });

    it('throws 404 for a missing registration', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      await expect(
        adminRegistrationsService.getAdminRegistrationById(fakeId)
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 404 for an invalid ObjectId', async () => {
      await expect(
        adminRegistrationsService.getAdminRegistrationById('not-an-id')
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('cancelAdminRegistration', () => {
    it('cancels the registration and refunds a completed payment', async () => {
      const reg = await seedRegistration({
        name: 'Active',
        surname: 'Runner',
        status: 'confirmed',
        paymentStatus: 'completed',
      });
      const payment = await Payment.create({
        registrationId: reg._id,
        amount: 400,
        status: 'completed',
      });

      const result = await adminRegistrationsService.cancelAdminRegistration(reg._id.toString());

      expect(result.registration.status).toBe('cancelled');

      const refreshedReg = await Registration.findById(reg._id);
      expect(refreshedReg?.status).toBe('cancelled');

      const refreshedPayment = await Payment.findById(payment._id);
      expect(refreshedPayment?.status).toBe('refunded');
    });

    it('marks pending payments as failed', async () => {
      const reg = await seedRegistration({ name: 'Pending', surname: 'Pay', status: 'pending' });
      const payment = await Payment.create({
        registrationId: reg._id,
        amount: 200,
        status: 'pending',
      });

      await adminRegistrationsService.cancelAdminRegistration(reg._id.toString());

      const refreshedPayment = await Payment.findById(payment._id);
      expect(refreshedPayment?.status).toBe('failed');
    });

    it('throws 409 when the registration is already cancelled', async () => {
      const reg = await seedRegistration({
        name: 'Already',
        surname: 'Cancelled',
        status: 'cancelled',
      });
      await expect(
        adminRegistrationsService.cancelAdminRegistration(reg._id.toString())
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('throws 404 for a missing id', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      await expect(adminRegistrationsService.cancelAdminRegistration(fakeId)).rejects.toMatchObject(
        { statusCode: 404 }
      );
    });
  });

  describe('exportAdminRegistrationsCsv', () => {
    it('produces a CSV with a header row and one line per registration', async () => {
      await seedRegistration({ name: 'Csv', surname: 'One', email: 'csv1@example.com' });
      await seedRegistration({ name: 'Csv', surname: 'Two', email: 'csv2@example.com' });

      const csv = await adminRegistrationsService.exportAdminRegistrationsCsv({});
      const lines = csv.split('\r\n');
      expect(lines[0]).toBe(
        'Full name,Email,Phone,Event,Distance,Bib,Amount (UAH),Payment status,Status,Registered at'
      );
      expect(lines).toHaveLength(3); // header + 2 rows
    });

    it('escapes cells containing commas', async () => {
      await seedRegistration({ name: 'Comma, Runner', surname: 'Test', distanceLabel: '21K' });
      const csv = await adminRegistrationsService.exportAdminRegistrationsCsv({});
      expect(csv).toContain('"Comma, Runner Test"');
    });

    it('filters CSV by status', async () => {
      await seedRegistration({ name: 'Confirmed', surname: 'One', status: 'confirmed' });
      await seedRegistration({ name: 'Pending', surname: 'Two', status: 'pending' });

      const csv = await adminRegistrationsService.exportAdminRegistrationsCsv({
        status: 'confirmed',
      });
      const lines = csv.split('\r\n');
      expect(lines).toHaveLength(2); // header + 1 row
      expect(lines[1]).toContain('confirmed');
    });
  });
});
