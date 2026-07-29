import crypto from 'crypto';
import request from 'supertest';
import app from '../app';
import { paymentConfig } from '../config/env';
import paymentsService from '../services/payments/payments.service';

jest.mock('../services/payments/payments.service', () => ({
  __esModule: true,
  default: {
    findByInvoiceId: jest.fn(),
  },
}));

// Signature verification consults Monobank for the merchant public key; stub it
// to null so these tests deterministically fall back to the configured env key
// (no network call).
jest.mock('../services/monobank/monobank.service', () => ({
  __esModule: true,
  default: {
    getPublicKey: jest.fn().mockResolvedValue(null),
  },
}));

// Generate a real EC key pair for signature tests (done once, reused across tests)
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// The controller expects base64(pem_string)
const TEST_PUBLIC_KEY_BASE64 = Buffer.from(publicKey as string).toString('base64');

function signBody(bodyStr: string): string {
  const sign = crypto.createSign('SHA256');
  sign.update(bodyStr);
  return sign.sign(privateKey as string, 'base64');
}

const mockFindByInvoiceId = paymentsService.findByInvoiceId as jest.MockedFunction<
  typeof paymentsService.findByInvoiceId
>;

describe('POST /api/webhooks/plata-mono — signature verification', () => {
  let savedKey: string;

  beforeEach(() => {
    savedKey = paymentConfig.plataWebhookPublicKey;
  });

  afterEach(() => {
    paymentConfig.plataWebhookPublicKey = savedKey;
  });

  it('fails closed (400) when no webhook key is configured', async () => {
    paymentConfig.plataWebhookPublicKey = '';
    const res = await request(app)
      .post('/api/webhooks/plata-mono')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ invoiceId: 'inv-001', status: 'success' }));

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, message: 'Invalid webhook signature' });
  });

  it('rejects request missing the x-sign header when key is configured', async () => {
    paymentConfig.plataWebhookPublicKey = TEST_PUBLIC_KEY_BASE64;
    const res = await request(app)
      .post('/api/webhooks/plata-mono')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ invoiceId: 'inv-002' }));

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, message: 'Invalid webhook signature' });
  });

  it('rejects request with an invalid x-sign signature', async () => {
    paymentConfig.plataWebhookPublicKey = TEST_PUBLIC_KEY_BASE64;
    const res = await request(app)
      .post('/api/webhooks/plata-mono')
      .set('Content-Type', 'application/json')
      .set('x-sign', Buffer.from('not-a-real-signature').toString('base64'))
      .send(JSON.stringify({ invoiceId: 'inv-003' }));

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, message: 'Invalid webhook signature' });
  });

  it('rejects a signature produced by a different key', async () => {
    paymentConfig.plataWebhookPublicKey = TEST_PUBLIC_KEY_BASE64;
    const { privateKey: wrongKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const bodyStr = JSON.stringify({ invoiceId: 'inv-004' });
    const sign = crypto.createSign('SHA256');
    sign.update(bodyStr);
    const wrongSig = sign.sign(wrongKey, 'base64');

    const res = await request(app)
      .post('/api/webhooks/plata-mono')
      .set('Content-Type', 'application/json')
      .set('x-sign', wrongSig)
      .send(bodyStr);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, message: 'Invalid webhook signature' });
  });

  it('accepts a validly-signed webhook and proceeds to payment lookup (not found → 404)', async () => {
    paymentConfig.plataWebhookPublicKey = TEST_PUBLIC_KEY_BASE64;
    mockFindByInvoiceId.mockResolvedValueOnce(null);

    const bodyStr = JSON.stringify({ invoiceId: 'inv-005', status: 'success' });
    const sig = signBody(bodyStr);

    const res = await request(app)
      .post('/api/webhooks/plata-mono')
      .set('Content-Type', 'application/json')
      .set('x-sign', sig)
      .send(bodyStr);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, message: 'Payment not found' });
    expect(mockFindByInvoiceId).toHaveBeenCalledWith('inv-005');
  });

  it('returns 200 for a valid signed webhook when payment is already completed (idempotency)', async () => {
    paymentConfig.plataWebhookPublicKey = TEST_PUBLIC_KEY_BASE64;
    mockFindByInvoiceId.mockResolvedValueOnce({
      _id: { toString: () => 'pay-id-001' },
      status: 'completed',
      registrationId: 'reg-001',
    } as unknown as Awaited<ReturnType<typeof paymentsService.findByInvoiceId>>);

    const bodyStr = JSON.stringify({ invoiceId: 'inv-006', status: 'success' });
    const sig = signBody(bodyStr);

    const res = await request(app)
      .post('/api/webhooks/plata-mono')
      .set('Content-Type', 'application/json')
      .set('x-sign', sig)
      .send(bodyStr);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});
