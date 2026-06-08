import request from 'supertest';
import app from '../app';
import { User } from '../models/User';

const LOGIN_URL = '/api/auth/login';

describe('account lockout after repeated failed logins', () => {
  const EMAIL = 'lockout-test@example.com';
  const PASSWORD = 'correct-password-123';
  const WRONG = 'wrong-password-xyz';

  beforeEach(async () => {
    // Create the user directly to avoid issuing a refresh token during setup,
    // which would collide with the token issued by the login call in the same second.
    await User.create({
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      email: EMAIL,
      password: PASSWORD, // hashed by pre-save hook
      provider: 'credentials' as const,
    });
  });

  it('allows login with correct credentials', async () => {
    const res = await request(app).post(LOGIN_URL).send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('returns 401 with ERROR_AUTH_INVALID_CREDENTIALS on wrong password', async () => {
    const res = await request(app).post(LOGIN_URL).send({ email: EMAIL, password: WRONG });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ERROR_AUTH_INVALID_CREDENTIALS');
  });

  it('increments failedLoginAttempts on each failed attempt', async () => {
    await request(app).post(LOGIN_URL).send({ email: EMAIL, password: WRONG });
    await request(app).post(LOGIN_URL).send({ email: EMAIL, password: WRONG });

    const user = await User.findOne({ email: EMAIL });
    expect(user?.failedLoginAttempts).toBe(2);
    expect(user?.lockedUntil).toBeFalsy();
  });

  it('locks the account after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post(LOGIN_URL).send({ email: EMAIL, password: WRONG });
    }

    const user = await User.findOne({ email: EMAIL });
    expect(user?.failedLoginAttempts).toBe(5);
    expect(user?.lockedUntil).toBeTruthy();
    expect(user!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns ERROR_AUTH_ACCOUNT_LOCKED once locked, even with correct password', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post(LOGIN_URL).send({ email: EMAIL, password: WRONG });
    }

    const res = await request(app).post(LOGIN_URL).send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ERROR_AUTH_ACCOUNT_LOCKED');
  });

  it('resets failedLoginAttempts and lockedUntil after a successful login', async () => {
    // Manually pre-set the lockout state to an expired lock so the next successful
    // login clears it (simulating an account that was locked and the time has passed)
    await User.updateOne(
      { email: EMAIL },
      {
        $set: {
          failedLoginAttempts: 3,
          lockedUntil: new Date(Date.now() - 1000), // already expired
        },
      }
    );

    const res = await request(app).post(LOGIN_URL).send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);

    const user = await User.findOne({ email: EMAIL });
    expect(user?.failedLoginAttempts).toBe(0);
    expect(user?.lockedUntil).toBeFalsy();
  });
});
