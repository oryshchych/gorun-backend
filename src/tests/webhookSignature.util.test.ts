import crypto from 'crypto';
import { verifyWithKey } from '../controllers/webhooks.controller';

/**
 * Monobank signs the raw webhook body with ECDSA/SHA256 and sends the DER
 * signature (base64) in the X-Sign header; the merchant public key is provided
 * base64-encoded (PEM). These tests exercise that exact shape.
 */
describe('verifyWithKey (Monobank webhook signature)', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const keyBase64 = Buffer.from(publicPem, 'utf-8').toString('base64');

  const body = JSON.stringify({ invoiceId: 'inv_123', status: 'success', amount: 139900 });

  const sign = (payload: string): string => {
    const signer = crypto.createSign('SHA256');
    signer.write(payload);
    signer.end();
    return signer.sign(privateKey).toString('base64');
  };

  it('accepts a valid signature over the raw body', () => {
    expect(verifyWithKey(body, sign(body), keyBase64)).toBe(true);
  });

  it('rejects when the body was tampered with', () => {
    const signature = sign(body);
    const tampered = JSON.stringify({ invoiceId: 'inv_123', status: 'success', amount: 1 });
    expect(verifyWithKey(tampered, signature, keyBase64)).toBe(false);
  });

  it('rejects a signature from a different key', () => {
    const other = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const otherSigner = crypto.createSign('SHA256');
    otherSigner.write(body);
    otherSigner.end();
    const foreignSignature = otherSigner.sign(other.privateKey).toString('base64');
    expect(verifyWithKey(body, foreignSignature, keyBase64)).toBe(false);
  });

  it('returns false (never throws) on malformed input', () => {
    expect(verifyWithKey(body, 'not-base64-sig!!', keyBase64)).toBe(false);
    expect(verifyWithKey(body, sign(body), 'not-a-key')).toBe(false);
  });
});
