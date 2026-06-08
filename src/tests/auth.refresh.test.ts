import request from 'supertest';
import app from '../app';
import { RefreshToken } from '../models/RefreshToken';
import { User } from '../models/User';
import { sha256Hex } from '../services/auth/auth.crypto';

const LOGIN_URL = '/api/auth/login';
const REFRESH_URL = '/api/auth/refresh';
const LOGOUT_URL = '/api/auth/logout';

async function loginAndGetTokens(
  email: string,
  password: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await request(app).post(LOGIN_URL).send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data as { accessToken: string; refreshToken: string };
}

describe('refresh token hashing and rotation', () => {
  const EMAIL = 'refresh-test@example.com';
  const PASSWORD = 'test-password-abc123';

  beforeEach(async () => {
    await User.create({
      name: 'Refresh Test',
      firstName: 'Refresh',
      lastName: 'Test',
      email: EMAIL,
      password: PASSWORD,
      provider: 'credentials' as const,
    });
  });

  it('stores the token as a sha256 hash, not the raw JWT', async () => {
    const { refreshToken } = await loginAndGetTokens(EMAIL, PASSWORD);

    const user = await User.findOne({ email: EMAIL });
    const stored = await RefreshToken.findOne({ userId: user!._id });

    expect(stored).not.toBeNull();
    // Hash must be a 64-char hex string (sha256 output)
    expect(stored!.token).toMatch(/^[0-9a-f]{64}$/);
    // Stored value must NOT be the raw JWT
    expect(stored!.token).not.toBe(refreshToken);
    // But it must equal sha256 of the JWT
    expect(stored!.token).toBe(sha256Hex(refreshToken));
  });

  it('returns new tokens on a valid refresh', async () => {
    const { refreshToken: token1 } = await loginAndGetTokens(EMAIL, PASSWORD);

    const res = await request(app).post(REFRESH_URL).send({ refreshToken: token1 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    // The new refresh token must be different from the old one
    expect(res.body.data.refreshToken).not.toBe(token1);
  });

  it('rotates the stored hash on refresh', async () => {
    const user = await User.findOne({ email: EMAIL });
    const { refreshToken: token1 } = await loginAndGetTokens(EMAIL, PASSWORD);

    await request(app).post(REFRESH_URL).send({ refreshToken: token1 }).expect(200);

    // Old hash must no longer exist
    const oldRecord = await RefreshToken.findOne({ token: sha256Hex(token1) });
    expect(oldRecord).toBeNull();

    // A new hash for this user must exist
    const newRecord = await RefreshToken.findOne({ userId: user!._id });
    expect(newRecord).not.toBeNull();
  });

  it('rejects a refresh token that has already been used', async () => {
    const { refreshToken: token1 } = await loginAndGetTokens(EMAIL, PASSWORD);

    // Use token1 to get token2
    await request(app).post(REFRESH_URL).send({ refreshToken: token1 }).expect(200);

    // Presenting token1 again must fail
    const res = await request(app).post(REFRESH_URL).send({ refreshToken: token1 });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ERROR_AUTH_REFRESH_TOKEN_INVALID');
  });

  it('revokes all user sessions when a reused token is detected', async () => {
    const user = await User.findOne({ email: EMAIL });
    const { refreshToken: token1 } = await loginAndGetTokens(EMAIL, PASSWORD);

    // Rotate token1 → token2 (simulates normal use)
    await request(app).post(REFRESH_URL).send({ refreshToken: token1 }).expect(200);

    // Attacker (or stale client) presents the old token1 again
    await request(app).post(REFRESH_URL).send({ refreshToken: token1 }).expect(401);

    // All sessions for this user must be gone
    const remaining = await RefreshToken.countDocuments({ userId: user!._id });
    expect(remaining).toBe(0);
  });

  it('logout deletes the token by hash', async () => {
    const user = await User.findOne({ email: EMAIL });
    const { accessToken, refreshToken } = await loginAndGetTokens(EMAIL, PASSWORD);

    const res = await request(app)
      .post(LOGOUT_URL)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(res.status).toBe(200);

    const remaining = await RefreshToken.countDocuments({ userId: user!._id });
    expect(remaining).toBe(0);
  });

  it('logout returns 404 for an unknown token', async () => {
    const { accessToken: accessToken1, refreshToken: realToken } = await loginAndGetTokens(
      EMAIL,
      PASSWORD
    );

    // Rotate realToken so it's gone from the DB; get new tokens
    const { body } = await request(app)
      .post(REFRESH_URL)
      .send({ refreshToken: realToken })
      .expect(200);
    const newToken = (body.data as { refreshToken: string }).refreshToken;

    // Try to logout with the old (now invalid) token — must 404
    const res = await request(app)
      .post(LOGOUT_URL)
      .set('Authorization', `Bearer ${accessToken1}`)
      .send({ refreshToken: realToken });
    expect(res.status).toBe(404);

    // The new (valid) token must still be in the DB
    const user = await User.findOne({ email: EMAIL });
    const stillValid = await RefreshToken.findOne({
      userId: user!._id,
      token: sha256Hex(newToken),
    });
    expect(stillValid).not.toBeNull();
  });
});
