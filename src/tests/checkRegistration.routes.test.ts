import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app';
import { Event } from '../models/Event';
import { Registration } from '../models/Registration';
import { User } from '../models/User';
import { generateAccessToken } from '../utils/jwt.util';

/**
 * GET /api/events/:id/check-registration must report the distances the signed-in
 * user is already registered for — matching by userId AND account e-mail, since
 * wizard (public) registrations are stored by e-mail with no userId.
 */
describe('GET /api/events/:id/check-registration', () => {
  async function seedUserAndEvent() {
    const user = await User.create({
      name: 'Runner One',
      email: 'runner@example.com',
      password: 'password123',
    });
    const event = await Event.create({
      title: 'City Run',
      description: 'A city running event',
      translations: { title: { en: 'City Run', uk: 'Міський забіг' } },
      date: new Date('2099-05-01'),
      location: 'Kyiv',
      capacity: 500,
      organizerId: new mongoose.Types.ObjectId(),
      distances: [],
    });
    const auth = `Bearer ${generateAccessToken(user._id.toString())}`;
    return { user, event, auth };
  }

  const baseReg = (eventId: mongoose.Types.ObjectId) => ({
    name: 'Runner',
    surname: 'One',
    finalPrice: 500,
    eventId,
    status: 'confirmed' as const,
    paymentStatus: 'completed' as const,
  });

  it('matches a public registration by e-mail and returns its distanceId', async () => {
    const { event, auth } = await seedUserAndEvent();
    await Registration.create({
      ...baseReg(event._id),
      email: 'runner@example.com', // no userId — public/wizard registration
      distanceId: 'dist-5k',
      distanceLabel: '5K',
    });

    const res = await request(app)
      .get(`/api/events/${event._id.toString()}/check-registration`)
      .set('Authorization', auth)
      .expect(200);

    expect(res.body.data.isRegistered).toBe(true);
    expect(res.body.data.distanceIds).toEqual(['dist-5k']);
  });

  it('matches a registration linked by userId', async () => {
    const { user, event, auth } = await seedUserAndEvent();
    await Registration.create({
      ...baseReg(event._id),
      email: 'someone-else@example.com',
      userId: user._id,
      distanceId: 'dist-10k',
      distanceLabel: '10K',
    });

    const res = await request(app)
      .get(`/api/events/${event._id.toString()}/check-registration`)
      .set('Authorization', auth)
      .expect(200);

    expect(res.body.data.isRegistered).toBe(true);
    expect(res.body.data.distanceIds).toEqual(['dist-10k']);
  });

  it('ignores non-confirmed (pending) registrations', async () => {
    const { event, auth } = await seedUserAndEvent();
    await Registration.create({
      ...baseReg(event._id),
      status: 'pending',
      paymentStatus: 'pending',
      email: 'runner@example.com',
      distanceId: 'dist-5k',
      distanceLabel: '5K',
    });

    const res = await request(app)
      .get(`/api/events/${event._id.toString()}/check-registration`)
      .set('Authorization', auth)
      .expect(200);

    expect(res.body.data.isRegistered).toBe(false);
    expect(res.body.data.distanceIds).toEqual([]);
  });

  it('returns not-registered with no distances when nothing matches', async () => {
    const { event, auth } = await seedUserAndEvent();

    const res = await request(app)
      .get(`/api/events/${event._id.toString()}/check-registration`)
      .set('Authorization', auth)
      .expect(200);

    expect(res.body.data.isRegistered).toBe(false);
    expect(res.body.data.distanceIds).toEqual([]);
  });
});
