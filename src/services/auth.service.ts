import { RefreshToken } from '../models/RefreshToken';
import { IUser, User } from '../models/User';
import { ConflictError, NotFoundError, UnauthorizedError } from '../types/errors';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.util';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  image?: string | undefined;
  provider: string;
  providerId?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
}

class AuthService {
  /**
   * Register a new user
   * Creates user, hashes password, generates tokens, and stores refresh token
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await User.findOne({ email: input.email.toLowerCase() });
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Create user (password will be hashed by pre-save hook)
    const user = await User.create({
      name: input.name,
      email: input.email.toLowerCase(),
      password: input.password,
      provider: 'credentials',
    });

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt,
    });

    // Convert user to response format
    const userResponse = this.formatUserResponse(user);

    return {
      user: userResponse,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Login an existing user
   * Verifies credentials, generates tokens, and stores refresh token
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    // Find user by email
    const user = await User.findOne({ email: input.email.toLowerCase() });
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(input.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt,
    });

    // Convert user to response format
    const userResponse = this.formatUserResponse(user);

    return {
      user: userResponse,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token using refresh token
   * Verifies refresh token, generates new tokens, and invalidates old token
   */
  async refreshAccessToken(refreshTokenString: string): Promise<AuthResponse> {
    // Verify refresh token
    let payload;
    try {
      payload = verifyRefreshToken(refreshTokenString);
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Check if refresh token exists in database
    const storedToken = await RefreshToken.findOne({ token: refreshTokenString });
    if (!storedToken) {
      throw new UnauthorizedError('Refresh token not found or has been revoked');
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      await RefreshToken.deleteOne({ _id: storedToken._id });
      throw new UnauthorizedError('Refresh token has expired');
    }

    // Get user
    const user = await User.findById(payload.userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user._id.toString());
    const newRefreshToken = generateRefreshToken(user._id.toString());

    // Invalidate old refresh token and store new one
    await RefreshToken.deleteOne({ _id: storedToken._id });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await RefreshToken.create({
      userId: user._id,
      token: newRefreshToken,
      expiresAt,
    });

    // Convert user to response format
    const userResponse = this.formatUserResponse(user);

    return {
      user: userResponse,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Logout user by removing refresh token from database
   */
  async logout(refreshTokenString: string): Promise<void> {
    // Remove refresh token from database
    const result = await RefreshToken.deleteOne({ token: refreshTokenString });

    if (result.deletedCount === 0) {
      throw new NotFoundError('Refresh token not found');
    }
  }

  /**
   * Get current user by ID
   */
  async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return this.formatUserResponse(user);
  }

  /**
   * Format user document to response format
   */
  private formatUserResponse(user: IUser): UserResponse {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      image: user.image,
      provider: user.provider,
      providerId: user.providerId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

export default new AuthService();
