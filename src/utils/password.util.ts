import bcrypt from 'bcrypt';
import { bcryptConfig } from '../config/env';

/**
 * Hash a password using bcrypt with configured salt rounds
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, bcryptConfig.saltRounds);
};

/**
 * Compare a plain text password with a hashed password
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};
