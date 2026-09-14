import { frontendConfig } from '../config/env';
import { buildPaymentReturnUrl } from '../services/payments/payments.service';

describe('buildPaymentReturnUrl', () => {
  const base = frontendConfig.url;

  it('prefixes a supported locale so the return page matches it', () => {
    expect(buildPaymentReturnUrl('reg1', 'uk')).toBe(
      `${base}/uk/payment/return?registrationId=reg1`
    );
    expect(buildPaymentReturnUrl('reg1', 'en')).toBe(
      `${base}/en/payment/return?registrationId=reg1`
    );
  });

  it('omits the prefix when no locale is given', () => {
    expect(buildPaymentReturnUrl('reg1')).toBe(`${base}/payment/return?registrationId=reg1`);
  });

  it('drops an unsupported/malicious locale rather than injecting it into the path', () => {
    expect(buildPaymentReturnUrl('reg1', 'fr')).toBe(`${base}/payment/return?registrationId=reg1`);
    expect(buildPaymentReturnUrl('reg1', '../../evil')).toBe(
      `${base}/payment/return?registrationId=reg1`
    );
  });
});
