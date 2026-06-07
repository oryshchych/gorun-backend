import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app';
import { User } from '../models/User';
import { generateAccessToken } from '../utils/jwt.util';

async function makeAdmin(): Promise<string> {
  const admin = await User.create({
    name: 'Admin User',
    email: `admin-${new mongoose.Types.ObjectId().toString()}@example.com`,
    password: 'password123',
    isAdmin: true,
  });
  return generateAccessToken(admin._id.toString());
}

describe('admin users routes', () => {
  it('rejects unauthenticated requests with 401', async () => {
    await request(app).get('/api/admin/users').expect(401);
  });

  it('rejects non-admin users with 403', async () => {
    const user = await User.create({
      name: 'Regular User',
      email: 'regular@example.com',
      password: 'password123',
    });
    const token = generateAccessToken(user._id.toString());
    await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`).expect(403);
  });

  it('returns a paginated list for an admin', async () => {
    const token = await makeAdmin();
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({ page: 1 });
  });

  it('serves the CSV export with a csv content type', async () => {
    const token = await makeAdmin();
    const res = await request(app)
      .get('/api/admin/users/export')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text.split('\r\n')[0]).toBe('Full name,Phone,Email,City,Registrations,Created');
  });

  it('soft-deletes a user via DELETE', async () => {
    const token = await makeAdmin();
    const target = await User.create({
      name: 'Target User',
      email: 'route-target@example.com',
      password: 'password123',
    });

    await request(app)
      .delete(`/api/admin/users/${target._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const refreshed = await User.findById(target._id);
    expect(refreshed?.deletedAt).toBeInstanceOf(Date);
  });
});
