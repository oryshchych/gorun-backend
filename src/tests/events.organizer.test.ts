import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app';
import { generateAccessToken } from '../utils/jwt.util';

/**
 * Regression coverage for the organizer contact fields (organizerInfo,
 * organizerContactName, organizerContactInfo) being silently dropped on
 * create/update and never surfaced on read.
 */
describe('Event organizer contact fields', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const token = generateAccessToken(userId);
  const auth = `Bearer ${token}`;

  const futureDate = new Date('2099-01-01T10:00:00.000Z').toISOString();

  const baseBody = {
    translations: {
      title: { en: 'Test Run', uk: 'Тестовий забіг' },
      description: { en: 'A test event description', uk: 'Опис тестової події' },
      location: { en: 'Lviv', uk: 'Львів' },
    },
    date: futureDate,
    capacity: 100,
    organizerInfo: 'Acme Running Club',
    organizerContactName: 'Jane Doe',
    organizerContactInfo: 'jane@example.com',
  };

  it('persists and returns organizer fields on create', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', auth)
      .send(baseBody)
      .expect(201);

    expect(res.body.data.organizerInfo).toBe('Acme Running Club');
    expect(res.body.data.organizerContactName).toBe('Jane Doe');
    expect(res.body.data.organizerContactInfo).toBe('jane@example.com');
  });

  it('returns organizer fields on GET after create', async () => {
    const created = await request(app)
      .post('/api/events')
      .set('Authorization', auth)
      .send(baseBody)
      .expect(201);

    const { id } = created.body.data;

    const res = await request(app).get(`/api/events/${id}`).expect(200);

    expect(res.body.data.organizerInfo).toBe('Acme Running Club');
    expect(res.body.data.organizerContactName).toBe('Jane Doe');
    expect(res.body.data.organizerContactInfo).toBe('jane@example.com');
  });

  it('updates organizer fields via PUT and reflects them on GET', async () => {
    const created = await request(app)
      .post('/api/events')
      .set('Authorization', auth)
      .send(baseBody)
      .expect(201);

    const { id } = created.body.data;

    const updateRes = await request(app)
      .put(`/api/events/${id}`)
      .set('Authorization', auth)
      .send({
        organizerInfo: 'Updated Club',
        organizerContactName: 'John Smith',
        organizerContactInfo: '+380000000000',
      })
      .expect(200);

    expect(updateRes.body.data.organizerInfo).toBe('Updated Club');
    expect(updateRes.body.data.organizerContactName).toBe('John Smith');
    expect(updateRes.body.data.organizerContactInfo).toBe('+380000000000');

    const getRes = await request(app).get(`/api/events/${id}`).expect(200);
    expect(getRes.body.data.organizerInfo).toBe('Updated Club');
    expect(getRes.body.data.organizerContactName).toBe('John Smith');
    expect(getRes.body.data.organizerContactInfo).toBe('+380000000000');
  });

  it('leaves organizer fields untouched on an unrelated partial update', async () => {
    const created = await request(app)
      .post('/api/events')
      .set('Authorization', auth)
      .send(baseBody)
      .expect(201);

    const { id } = created.body.data;

    await request(app)
      .put(`/api/events/${id}`)
      .set('Authorization', auth)
      .send({ capacity: 250 })
      .expect(200);

    const getRes = await request(app).get(`/api/events/${id}`).expect(200);
    expect(getRes.body.data.capacity).toBe(250);
    expect(getRes.body.data.organizerInfo).toBe('Acme Running Club');
    expect(getRes.body.data.organizerContactName).toBe('Jane Doe');
    expect(getRes.body.data.organizerContactInfo).toBe('jane@example.com');
  });
});

describe('Event auxiliary fields (socials, regulationUrl, scheduleText, registration window)', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const auth = `Bearer ${generateAccessToken(userId)}`;

  const baseBody = {
    translations: {
      title: { en: 'Aux Run', uk: 'Біг Aux' },
      description: { en: 'Aux event description', uk: 'Опис події Aux' },
      location: { en: 'Kyiv', uk: 'Київ' },
    },
    date: new Date('2099-02-01T10:00:00.000Z').toISOString(),
    capacity: 50,
    socials: { instagram: 'https://instagram.com/run', facebook: '', telegram: 't.me/run' },
    regulationUrl: 'https://example.com/regulation.pdf',
    consentLetterUrl: 'https://example.com/consent.pdf',
    scheduleText: 'Gates open at 8:00, start at 9:00',
    registrationStart: new Date('2098-01-01T00:00:00.000Z').toISOString(),
    registrationEnd: new Date('2098-12-31T00:00:00.000Z').toISOString(),
  };

  it('persists and returns aux fields on create', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', auth)
      .send(baseBody)
      .expect(201);

    expect(res.body.data.socials).toMatchObject({
      instagram: 'https://instagram.com/run',
      telegram: 't.me/run',
    });
    expect(res.body.data.regulationUrl).toBe('https://example.com/regulation.pdf');
    expect(res.body.data.consentLetterUrl).toBe('https://example.com/consent.pdf');
    expect(res.body.data.scheduleText).toBe('Gates open at 8:00, start at 9:00');
    expect(res.body.data.registrationStart).toBeDefined();
    expect(res.body.data.registrationEnd).toBeDefined();
  });

  it('updates aux fields via PUT and reflects them on GET', async () => {
    const created = await request(app)
      .post('/api/events')
      .set('Authorization', auth)
      .send(baseBody)
      .expect(201);

    const { id } = created.body.data;

    await request(app)
      .put(`/api/events/${id}`)
      .set('Authorization', auth)
      .send({
        regulationUrl: 'https://example.com/v2.pdf',
        scheduleText: 'Updated schedule',
      })
      .expect(200);

    const getRes = await request(app).get(`/api/events/${id}`).expect(200);
    expect(getRes.body.data.regulationUrl).toBe('https://example.com/v2.pdf');
    expect(getRes.body.data.scheduleText).toBe('Updated schedule');
    // untouched aux fields survive the partial update
    expect(getRes.body.data.socials).toMatchObject({ instagram: 'https://instagram.com/run' });
  });

  it('rejects a non-PDF regulationUrl on create', async () => {
    await request(app)
      .post('/api/events')
      .set('Authorization', auth)
      .send({ ...baseBody, regulationUrl: 'https://example.com/regulation.docx' })
      .expect(400);
  });

  it('updates and clears consentLetterUrl, and rejects a non-PDF value', async () => {
    const created = await request(app)
      .post('/api/events')
      .set('Authorization', auth)
      .send(baseBody)
      .expect(201);
    const { id } = created.body.data;

    // Non-PDF is rejected
    await request(app)
      .put(`/api/events/${id}`)
      .set('Authorization', auth)
      .send({ consentLetterUrl: 'https://example.com/consent.docx' })
      .expect(400);

    // Valid PDF round-trips through GET
    await request(app)
      .put(`/api/events/${id}`)
      .set('Authorization', auth)
      .send({ consentLetterUrl: 'https://example.com/consent-v2.pdf' })
      .expect(200);
    let getRes = await request(app).get(`/api/events/${id}`).expect(200);
    expect(getRes.body.data.consentLetterUrl).toBe('https://example.com/consent-v2.pdf');

    // Empty string clears it
    await request(app)
      .put(`/api/events/${id}`)
      .set('Authorization', auth)
      .send({ consentLetterUrl: '' })
      .expect(200);
    getRes = await request(app).get(`/api/events/${id}`).expect(200);
    expect(getRes.body.data.consentLetterUrl).toBeUndefined();
  });

  it('clears regulationUrl when an empty string is sent on update', async () => {
    const created = await request(app)
      .post('/api/events')
      .set('Authorization', auth)
      .send(baseBody)
      .expect(201);

    const { id } = created.body.data;

    await request(app)
      .put(`/api/events/${id}`)
      .set('Authorization', auth)
      .send({ regulationUrl: '' })
      .expect(200);

    const getRes = await request(app).get(`/api/events/${id}`).expect(200);
    expect(getRes.body.data.regulationUrl).toBeUndefined();
  });
});
