import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app';
import { User } from '../models/User';
import { generateAccessToken } from '../utils/jwt.util';

async function makeAdmin(): Promise<string> {
  const admin = await User.create({
    name: 'Admin User',
    email: `admin-analytics-${new mongoose.Types.ObjectId().toString()}@example.com`,
    password: 'password123',
    isAdmin: true,
  });
  return generateAccessToken(admin._id.toString());
}

describe('admin analytics routes', () => {
  it('rejects unauthenticated requests with 401', async () => {
    await request(app).get('/api/admin/analytics/summary').expect(401);
  });

  it('rejects non-admin users with 403', async () => {
    const user = await User.create({
      name: 'Regular User',
      email: 'regular-analytics@example.com',
      password: 'password123',
    });
    const token = generateAccessToken(user._id.toString());
    await request(app)
      .get('/api/admin/analytics/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('returns 422 when preset=custom without from/to', async () => {
    const token = await makeAdmin();
    await request(app)
      .get('/api/admin/analytics/summary?preset=custom')
      .set('Authorization', `Bearer ${token}`)
      .expect(422);
  });

  it('returns a summary envelope for an admin', async () => {
    const token = await makeAdmin();
    const res = await request(app)
      .get('/api/admin/analytics/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.code).toBe('SUCCESS_ANALYTICS_SUMMARY_RETRIEVED');
    expect(res.body.data).toHaveProperty('totalRegistrations');
    expect(res.body.data).toHaveProperty('conversionRate');
  });

  it('serves the other three analytics endpoints', async () => {
    const token = await makeAdmin();
    for (const path of ['timeseries', 'demographics', 'by-event']) {
      const res = await request(app)
        .get(`/api/admin/analytics/${path}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.success).toBe(true);
    }
  });
});
