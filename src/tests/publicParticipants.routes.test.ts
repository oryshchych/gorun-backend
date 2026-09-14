import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app';
import { Event } from '../models/Event';
import { Registration } from '../models/Registration';

/**
 * GET /api/events/:eventId/participants must expose the fields the public
 * participants tab needs: city, distance (+ id), gender, and derived age.
 */
describe('GET /api/events/:eventId/participants', () => {
  it('returns city, distance, distanceId, gender and derived age', async () => {
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

    // Birthday already reached this year → deterministic age of exactly 30.
    const dobYear = new Date().getFullYear() - 30;
    await Registration.create({
      eventId: event._id,
      name: 'Ada',
      surname: 'Runner',
      email: 'ada@example.com',
      city: 'Lviv',
      finalPrice: 500,
      status: 'confirmed',
      paymentStatus: 'completed',
      distanceId: 'dist-21k',
      distanceLabel: '21K',
      gender: 'female',
      dateOfBirth: `${dobYear}-01-01`,
    });

    const res = await request(app)
      .get(`/api/events/${event._id.toString()}/participants`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    const p = res.body.data[0];
    expect(p).toMatchObject({
      name: 'Ada',
      surname: 'Runner',
      city: 'Lviv',
      distance: '21K',
      distanceId: 'dist-21k',
      gender: 'female',
      age: 30,
    });
  });

  it('omits age when the registration has no date of birth', async () => {
    const event = await Event.create({
      title: 'No-DOB Run',
      description: 'A running event without DOB data',
      translations: { title: { en: 'No-DOB Run', uk: 'Забіг' } },
      date: new Date('2099-05-01'),
      location: 'Kyiv',
      capacity: 100,
      organizerId: new mongoose.Types.ObjectId(),
      distances: [],
    });
    await Registration.create({
      eventId: event._id,
      name: 'Bob',
      surname: 'Legacy',
      email: 'bob@example.com',
      city: 'Odesa',
      finalPrice: 500,
      status: 'confirmed',
      paymentStatus: 'completed',
      distanceId: 'dist-10k',
      distanceLabel: '10K',
    });

    const res = await request(app)
      .get(`/api/events/${event._id.toString()}/participants`)
      .expect(200);

    expect(res.body.data[0].age).toBeUndefined();
    expect(res.body.data[0].gender).toBeUndefined();
    expect(res.body.data[0].distanceId).toBe('dist-10k');
  });
});
