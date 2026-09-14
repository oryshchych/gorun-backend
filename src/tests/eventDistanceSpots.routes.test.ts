import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app';
import { Event } from '../models/Event';
import { Registration } from '../models/Registration';

/**
 * GET /api/events/:id must return per-distance `spots.taken` recomputed from the
 * confirmed registrations, not the (stale) value stored on the event document.
 */
describe('GET /api/events/:id — authoritative distance spots.taken', () => {
  const reg = (
    eventId: mongoose.Types.ObjectId,
    distanceId: string,
    overrides: Record<string, unknown> = {}
  ) =>
    Registration.create({
      eventId,
      name: 'Run',
      surname: 'Unner',
      email: `${new mongoose.Types.ObjectId().toString()}@example.com`,
      city: 'Kyiv',
      finalPrice: 0,
      status: 'confirmed',
      paymentStatus: 'completed',
      distanceId,
      distanceLabel: distanceId,
      ...overrides,
    });

  it('counts confirmed registrations per distance and ignores others', async () => {
    const event = await Event.create({
      title: 'Counted Run',
      description: 'An event with counted distances',
      translations: { title: { en: 'Counted Run', uk: 'Забіг' } },
      date: new Date('2099-05-01'),
      location: 'Kyiv',
      capacity: 500,
      isActive: true,
      organizerId: new mongoose.Types.ObjectId(),
      distances: [
        { id: 'd-21k', label: '21K', name: 'Half', spots: { taken: 999 } },
        { id: 'd-10k', label: '10K', name: 'Ten' },
      ],
    });

    await reg(event._id, 'd-21k');
    await reg(event._id, 'd-21k');
    await reg(event._id, 'd-10k');
    // Should NOT be counted:
    await reg(event._id, 'd-21k', { status: 'pending', paymentStatus: 'pending' });
    await reg(event._id, 'd-21k', { status: 'cancelled' });
    await Registration.create({
      eventId: event._id,
      name: 'No',
      surname: 'Distance',
      email: 'nodist@example.com',
      city: 'Kyiv',
      finalPrice: 0,
      status: 'confirmed',
      paymentStatus: 'completed',
    });

    const res = await request(app).get(`/api/events/${event._id.toString()}`).expect(200);

    const distances = res.body.data.distances as Array<{
      id: string;
      spots?: { taken?: number };
    }>;
    const d21 = distances.find(d => d.id === 'd-21k');
    const d10 = distances.find(d => d.id === 'd-10k');

    // Overwrites the stale stored value (999) with the real confirmed count.
    expect(d21?.spots?.taken).toBe(2);
    expect(d10?.spots?.taken).toBe(1);
  });
});
