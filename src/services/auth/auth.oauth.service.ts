import {
  authFlowConfig,
  frontendConfig,
  getFrontendOAuthRedirectOrigins,
  googleOAuthConfig,
  jwtConfig,
} from '../../config/env';
import { logger } from '../../config/logger';
import { OAuthExchangeCode } from '../../models/OAuthExchangeCode';
import { OAuthState } from '../../models/OAuthState';
import { IUser, User } from '../../models/User';
import type { ErrorCode } from '../../types/codes';
import { AppError } from '../../types/errors';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt.util';
import { randomUrlSafeToken, sha256Hex } from './auth.crypto';
import { formatUserResponse, persistRefreshToken } from './auth.helpers';
import type { AuthResponse } from './auth.types';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';

function assertGoogleConfigured(): void {
  if (
    !googleOAuthConfig.clientId ||
    !googleOAuthConfig.clientSecret ||
    !googleOAuthConfig.redirectUri
  ) {
    throw new AppError('Google OAuth is not configured', 503, 'ERROR_INTERNAL_SERVER' as ErrorCode);
  }
}

function isAllowedRedirectTarget(redirectUri: string): boolean {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return false;
  }
  const origin = url.origin;
  const allowed = getFrontendOAuthRedirectOrigins();
  return allowed.some(
    a => origin === a || redirectUri.startsWith(`${a}/`) || redirectUri.startsWith(`${a}?`)
  );
}

/**
 * Build Google authorization URL and persist CSRF state.
 */
export async function startGoogleOAuth(params: {
  redirectUri: string;
  locale?: string;
  rememberMe?: boolean;
}): Promise<string> {
  assertGoogleConfigured();
  if (!isAllowedRedirectTarget(params.redirectUri)) {
    throw new AppError('redirect_uri is not allowed', 400, 'ERROR_BAD_REQUEST' as ErrorCode);
  }

  const state = randomUrlSafeToken(24);
  const expiresAt = new Date(Date.now() + authFlowConfig.oauthStateTtlMin * 60_000);

  await OAuthState.create({
    state,
    redirectUri: params.redirectUri,
    locale: params.locale,
    rememberMe: Boolean(params.rememberMe),
    expiresAt,
  });

  const u = new URL(GOOGLE_AUTH);
  u.searchParams.set('client_id', googleOAuthConfig.clientId);
  u.searchParams.set('redirect_uri', googleOAuthConfig.redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid email profile');
  u.searchParams.set('state', state);
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('prompt', 'consent');
  return u.toString();
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

async function exchangeGoogleCode(
  code: string
): Promise<{ accessToken: string; userInfo: GoogleUserInfo }> {
  const body = new URLSearchParams({
    code,
    client_id: googleOAuthConfig.clientId,
    client_secret: googleOAuthConfig.clientSecret,
    redirect_uri: googleOAuthConfig.redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !data.access_token) {
    logger.warn('Google token exchange failed', { status: res.status, error: data.error });
    throw new AppError('Google authentication failed', 502, 'ERROR_INTERNAL_SERVER' as ErrorCode);
  }

  const uiRes = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const userInfo = (await uiRes.json()) as GoogleUserInfo;
  if (!uiRes.ok || !userInfo.sub) {
    logger.warn('Google userinfo failed', { status: uiRes.status });
    throw new AppError('Google authentication failed', 502, 'ERROR_INTERNAL_SERVER' as ErrorCode);
  }
  if (!userInfo.email || !userInfo.email_verified) {
    throw new AppError(
      'Google account email is not verified',
      400,
      'ERROR_BAD_REQUEST' as ErrorCode
    );
  }

  return { accessToken: data.access_token, userInfo };
}

async function findOrCreateGoogleUser(info: GoogleUserInfo): Promise<IUser> {
  let user = await User.findOne({ provider: 'google', providerId: info.sub });
  if (user) {
    if (info.picture && user.image !== info.picture) {
      user.image = info.picture;
      await user.save();
    }
    return user;
  }

  user = await User.findOne({ email: info.email!.toLowerCase() });
  if (user) {
    if (user.provider === 'credentials') {
      user.provider = 'google';
      user.providerId = info.sub;
      if (info.picture) user.image = info.picture;
      if (info.given_name) user.firstName = info.given_name;
      if (info.family_name) user.lastName = info.family_name;
      await user.save();
      return user;
    }
  }

  const randomPassword = randomUrlSafeToken(48);
  const firstName = info.given_name ?? info.name?.split(/\s+/)[0] ?? 'User';
  const lastName = info.family_name ?? (info.name?.split(/\s+/).slice(1).join(' ').trim() || '—');

  user = new User({
    name: `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    email: info.email!.toLowerCase(),
    password: randomPassword,
    image: info.picture,
    provider: 'google',
    providerId: info.sub,
  });
  await user.save();
  return user;
}

/**
 * Handle Google redirect: validate state, create user/session, redirect to frontend with one-time code.
 */
export async function handleGoogleCallback(
  code: string | undefined,
  state: string | undefined
): Promise<{ redirectUrl: string }> {
  assertGoogleConfigured();
  if (!code || !state) {
    return {
      redirectUrl: `${frontendConfig.url}?oauth_error=missing_params`,
    };
  }

  const stateDoc = await OAuthState.findOne({ state });
  if (!stateDoc || stateDoc.expiresAt < new Date()) {
    if (stateDoc) await OAuthState.deleteOne({ _id: stateDoc._id });
    return {
      redirectUrl: `${frontendConfig.url}?oauth_error=invalid_state`,
    };
  }

  await OAuthState.deleteOne({ _id: stateDoc._id });

  try {
    const { userInfo } = await exchangeGoogleCode(code);
    const user = await findOrCreateGoogleUser(userInfo);

    const longLived = stateDoc.rememberMe;

    const oneTime = randomUrlSafeToken(32);
    const codeHash = sha256Hex(oneTime);
    const exchangeExpires = new Date(Date.now() + authFlowConfig.oauthExchangeCodeTtlSec * 1000);

    await OAuthExchangeCode.create({
      codeHash,
      userId: user._id,
      longLived,
      expiresAt: exchangeExpires,
    });

    const target = new URL(stateDoc.redirectUri);
    target.searchParams.set('code', oneTime);
    if (stateDoc.locale) {
      target.searchParams.set('locale', stateDoc.locale);
    }

    return { redirectUrl: target.toString() };
  } catch (err) {
    logger.error('Google OAuth callback error', {
      message: err instanceof Error ? err.message : String(err),
    });
    return {
      redirectUrl: `${frontendConfig.url}?oauth_error=auth_failed`,
    };
  }
}

/**
 * Exchange one-time OAuth code for JWT pair (same shape as login).
 */
export async function exchangeOAuthCode(code: string): Promise<AuthResponse> {
  const codeHash = sha256Hex(code);
  const doc = await OAuthExchangeCode.findOne({ codeHash });
  if (!doc || doc.expiresAt < new Date()) {
    if (doc) await OAuthExchangeCode.deleteOne({ _id: doc._id });
    throw new AppError('Invalid or expired code', 400, 'ERROR_BAD_REQUEST' as ErrorCode);
  }

  await OAuthExchangeCode.deleteOne({ _id: doc._id });

  const user = await User.findById(doc.userId);
  if (!user) {
    throw new AppError('User not found', 404, 'ERROR_NOT_FOUND' as ErrorCode);
  }

  const accessToken = generateAccessToken(user._id.toString());
  const refreshToken = generateRefreshToken(
    user._id.toString(),
    doc.longLived ? jwtConfig.refreshExpiryLong : jwtConfig.refreshExpiry
  );

  await persistRefreshToken(user._id, refreshToken, doc.longLived);

  return {
    user: formatUserResponse(user),
    accessToken,
    refreshToken,
  };
}
