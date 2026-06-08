import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app';
import { Registration } from '../models/Registration';
import { User } from '../models/User';
import { generateAccessToken } from '../utils/jwt.util';

async function makeAdmin(): Promise<string> {
  const admin = await User.create({
    name: 'Admin User',
    email: `admin-reg-${new mongoose.Types.ObjectId().toString()}@example.com`,
    password: 'password123',
    isAdmin: true,
  });
  return generateAccessToken(admin._id.toString());
}

async function seedRegistration() {
  return Registration.create({
    name: 'Test',
    surname: 'Runner',
    email: `runner-${new mongoose.Types.ObjectId().toString()}@example.com`,
    eventId: new mongoose.Types.ObjectId(),
    status: 'confirmed',
    paymentStatus: 'completed',
    finalPrice: 500,
  });
}

describe('admin registrations routes', () => {
  it('rejects unauthenticated requests with 401', async () => {
    await request(app).get('/api/admin/registrations').expect(401);
  });

  it('rejects non-admin users with 403', async () => {
    const user = await User.create({
      name: 'Regular User',
      email: 'regular-reg@example.com',
      password: 'password123',
    });
    const token = generateAccessToken(user._id.toString());
    await request(app)
      .get('/api/admin/registrations')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('returns a paginated list for an admin', async () => {
    const token = await makeAdmin();
    await seedRegistration();

    const res = await request(app)
      .get('/api/admin/registrations')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({ page: 1 });
  });

  it('serves the CSV export with a csv content type', async () => {
    const token = await makeAdmin();

    const res = await request(app)
      .get('/api/admin/registrations/export')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text.split('\r\n')[0]).toBe(
      'Full name,Email,Phone,Event,Distance,Bib,Amount (UAH),Payment status,Status,Registered at'
    );
  });

  it('cancels a registration via POST /:id/cancel', async () => {
    const token = await makeAdmin();
    const reg = await seedRegistration();

    const res = await request(app)
      .post(`/api/admin/registrations/${reg._id.toString()}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.registration.status).toBe('cancelled');

    const refreshed = await Registration.findById(reg._id);
    expect(refreshed?.status).toBe('cancelled');
  });
});
