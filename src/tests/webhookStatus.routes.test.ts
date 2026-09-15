import crypto from 'crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app';
import { paymentConfig } from '../config/env';
import { Event } from '../models/Event';
import paymentsService from '../services/payments/payments.service';
import registrationsService from '../services/registrations/registrations.service';
import emailService from '../services/email/email.service';

jest.mock('../services/payments/payments.service', () => ({
  __esModule: true,
  default: { findByInvoiceId: jest.fn() },
}));

jest.mock('../services/monobank/monobank.service', () => ({
  __esModule: true,
  default: { getPublicKey: jest.fn().mockResolvedValue(null) },
}));

jest.mock('../services/registrations/registrations.service', () => ({
  __esModule: true,
  default: { markPaymentCompleted: jest.fn(), markPaymentFailed: jest.fn() },
}));

jest.mock('../services/email/email.service', () => ({
  __esModule: true,
  default: {
    sendRegistrationConfirmation: jest.fn(),
    sendPaymentFailed: jest.fn(),
  },
}));

const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const TEST_PUBLIC_KEY_BASE64 = Buffer.from(publicKey as string).toString('base64');

const signBody = (body: string): string =>
  crypto
    .createSign('SHA256')
    .update(body)
    .sign(privateKey as string, 'base64');

const mockFindByInvoiceId = paymentsService.findByInvoiceId as jest.MockedFunction<
  typeof paymentsService.findByInvoiceId
>;
const mockMarkCompleted = registrationsService.markPaymentCompleted as jest.MockedFunction<
  typeof registrationsService.markPaymentCompleted
>;
const mockMarkFailed = registrationsService.markPaymentFailed as jest.MockedFunction<
  typeof registrationsService.markPaymentFailed
>;
const mockSendConfirmation = emailService.sendRegistrationConfirmation as jest.MockedFunction<
  typeof emailService.sendRegistrationConfirmation
>;
const mockSendFailed = emailService.sendPaymentFailed as jest.MockedFunction<
  typeof emailService.sendPaymentFailed
>;

function pendingPayment() {
  return {
    _id: { toString: () => 'pay-1' },
    status: 'pending',
    registrationId: 'reg-1',
    currency: 'UAH',
    amount: 1100,
  } as unknown as Awaited<ReturnType<typeof paymentsService.findByInvoiceId>>;
}

async function post(status: string) {
  const body = JSON.stringify({ invoiceId: 'inv-1', status });
  return request(app)
    .post('/api/webhooks/plata-mono')
    .set('Content-Type', 'application/json')
    .set('x-sign', signBody(body))
    .send(body);
}

describe('POST /api/webhooks/plata-mono — status handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentConfig.plataWebhookPublicKey = TEST_PUBLIC_KEY_BASE64;
    mockFindByInvoiceId.mockResolvedValue(pendingPayment());
  });

  it('acknowledges an intermediate "processing" status without failing or e-mailing', async () => {
    const res = await post('processing');

    expect(res.status).toBe(200);
    expect(mockMarkFailed).not.toHaveBeenCalled();
    expect(mockMarkCompleted).not.toHaveBeenCalled();
    expect(mockSendFailed).not.toHaveBeenCalled();
    expect(mockSendConfirmation).not.toHaveBeenCalled();
  });

  it('does not fail or e-mail on "created" or "hold" either', async () => {
    for (const status of ['created', 'hold']) {
      await post(status);
    }
    expect(mockMarkFailed).not.toHaveBeenCalled();
    expect(mockSendFailed).not.toHaveBeenCalled();
  });

  it('completes and sends the confirmation e-mail on "success"', async () => {
    const event = await Event.create({
      title: 'Webhook Run',
      description: 'An event for webhook tests',
      translations: { title: { en: 'Webhook Run', uk: 'Забіг' } },
      date: new Date('2099-05-01'),
      location: 'Kyiv',
      capacity: 100,
      organizerId: new mongoose.Types.ObjectId(),
    });
    mockMarkCompleted.mockResolvedValue({
      id: 'reg-1',
      email: 'runner@example.com',
      eventId: event._id.toString(),
      name: 'Yurii',
      surname: 'O',
      finalPrice: 1100,
    } as unknown as Awaited<ReturnType<typeof registrationsService.markPaymentCompleted>>);

    const res = await post('success');

    expect(res.status).toBe(200);
    expect(mockMarkCompleted).toHaveBeenCalledTimes(1);
    expect(mockSendConfirmation).toHaveBeenCalledTimes(1);
    expect(mockSendFailed).not.toHaveBeenCalled();
  });

  it('fails and sends the failure e-mail on a terminal "failure" status', async () => {
    const event = await Event.create({
      title: 'Webhook Run 2',
      description: 'An event for webhook tests',
      translations: { title: { en: 'Webhook Run 2', uk: 'Забіг' } },
      date: new Date('2099-05-01'),
      location: 'Kyiv',
      capacity: 100,
      organizerId: new mongoose.Types.ObjectId(),
    });
    mockMarkFailed.mockResolvedValue({
      id: 'reg-1',
      email: 'runner@example.com',
      eventId: event._id.toString(),
      name: 'Yurii',
      surname: 'O',
    } as unknown as Awaited<ReturnType<typeof registrationsService.markPaymentFailed>>);

    const res = await post('failure');

    expect(res.status).toBe(200);
    expect(mockMarkFailed).toHaveBeenCalledTimes(1);
    expect(mockSendFailed).toHaveBeenCalledTimes(1);
    expect(mockSendConfirmation).not.toHaveBeenCalled();
  });
});
