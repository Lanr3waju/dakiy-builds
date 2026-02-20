import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { pool } from '../config/database';
import { AuthenticationError, ValidationError, DatabaseError } from '../utils/errors';
import logger from '../utils/logger';

const SALT_ROUNDS = 10;
const SESSION_EXPIRY_HOURS = 24;

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  lastAccessedAt: Date;
}

export interface AuthResult {
  session: Session;
  user: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  };
}

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters long');
  }
  
  try {
    return await bcrypt.hash(password, SALT_ROUNDS);
  } catch (error) {
    logger.error('Password hashing failed', { error });
    throw new DatabaseError('Failed to hash password');
  }
}

/**
 * Verify a password against a hash
 * @param password - Plain text password
 * @param hash - Hashed password
 * @returns True if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    logger.error('Password verification failed', { error });
    return false;
  }
}

/**
 * Generate a secure random session token
 * @returns Random token string
 */
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate session expiration date
 * @returns Expiration date
 */
function calculateExpiryDate(): Date {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + SESSION_EXPIRY_HOURS);
  return expiryDate;
}

/**
 * Authenticate user with email and password, create session
 * @param credentials - User login credentials
 * @returns Authentication result with session and user info
 * @throws AuthenticationError if credentials are invalid
 * @throws ValidationError if input is invalid
 */
export async function login(credentials: LoginCredentials): Promise<AuthResult> {
  const { email, password } = credentials;

  // Validate input
  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }

  if (!email.includes('@')) {
    throw new ValidationError('Invalid email format');
  }

  const client = await pool.connect();
  
  try {
    // Fetch user by email
    const userQuery = `
      SELECT id, email, password_hash, role, first_name, last_name, is_active
      FROM users
      WHERE email = $1
    `;
    
    const userResult = await client.query(userQuery, [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      logger.warn('Login attempt with non-existent email', { email });
      throw new AuthenticationError('Invalid email or password');
    }

    const user = userResult.rows[0];

    // Check if user is active
    if (!user.is_active) {
      logger.warn('Login attempt for inactive user', { userId: user.id, email });
      throw new AuthenticationError('Account is inactive');
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    
    if (!isPasswordValid) {
      logger.warn('Login attempt with invalid password', { email });
      throw new AuthenticationError('Invalid email or password');
    }

    // Create session
    const token = generateSessionToken();
    const expiresAt = calculateExpiryDate();

    const sessionQuery = `
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, token, expires_at, created_at, last_accessed_at
    `;

    const sessionResult = await client.query(sessionQuery, [user.id, token, expiresAt]);
    const session = sessionResult.rows[0];

    logger.info('User logged in successfully', { userId: user.id, email });

    return {
      session: {
        id: session.id,
        userId: session.user_id,
        token: session.token,
        expiresAt: session.expires_at,
        createdAt: session.created_at,
        lastAccessedAt: session.last_accessed_at,
      },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    };
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ValidationError) {
      throw error;
    }
    logger.error('Login failed', { error, email });
    throw new DatabaseError('Login failed due to server error');
  } finally {
    client.release();
  }
}

/**
 * Validate a session token and return session info
 * @param token - Session token
 * @returns Session and user info if valid
 * @throws AuthenticationError if session is invalid or expired
 */
export async function validateSession(token: string): Promise<AuthResult> {
  if (!token) {
    throw new AuthenticationError('Session token is required');
  }

  const client = await pool.connect();

  try {
    const query = `
      SELECT 
        s.id, s.user_id, s.token, s.expires_at, s.created_at, s.last_accessed_at,
        u.email, u.role, u.first_name, u.last_name, u.is_active
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = $1
    `;

    const result = await client.query(query, [token]);

    if (result.rows.length === 0) {
      throw new AuthenticationError('Invalid session token');
    }

    const row = result.rows[0];

    // Check if session is expired
    if (new Date(row.expires_at) < new Date()) {
      // Clean up expired session
      await client.query('DELETE FROM sessions WHERE id = $1', [row.id]);
      throw new AuthenticationError('Session has expired');
    }

    // Check if user is still active
    if (!row.is_active) {
      throw new AuthenticationError('Account is inactive');
    }

    // Update last accessed time
    await client.query(
      'UPDATE sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1',
      [row.id]
    );

    return {
      session: {
        id: row.id,
        userId: row.user_id,
        token: row.token,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        lastAccessedAt: new Date(),
      },
      user: {
        id: row.user_id,
        email: row.email,
        role: row.role,
        firstName: row.first_name,
        lastName: row.last_name,
      },
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    logger.error('Session validation failed', { error });
    throw new DatabaseError('Session validation failed');
  } finally {
    client.release();
  }
}

/**
 * Logout user by destroying their session
 * @param token - Session token to destroy
 * @throws AuthenticationError if session doesn't exist
 */
export async function logout(token: string): Promise<void> {
  if (!token) {
    throw new ValidationError('Session token is required');
  }

  const client = await pool.connect();

  try {
    const result = await client.query(
      'DELETE FROM sessions WHERE token = $1 RETURNING user_id',
      [token]
    );

    if (result.rows.length === 0) {
      throw new AuthenticationError('Invalid session token');
    }

    logger.info('User logged out successfully', { userId: result.rows[0].user_id });
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ValidationError) {
      throw error;
    }
    logger.error('Logout failed', { error });
    throw new DatabaseError('Logout failed');
  } finally {
    client.release();
  }
}

/**
 * Clean up expired sessions from the database
 * This should be called periodically (e.g., via cron job)
 * @returns Number of sessions cleaned up
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP RETURNING id'
    );

    const count = result.rowCount || 0;
    
    if (count > 0) {
      logger.info('Cleaned up expired sessions', { count });
    }

    return count;
  } catch (error) {
    logger.error('Session cleanup failed', { error });
    throw new DatabaseError('Session cleanup failed');
  } finally {
    client.release();
  }
}

/**
 * Destroy all sessions for a specific user
 * Useful for security purposes (e.g., password reset, account compromise)
 * @param userId - User ID
 * @returns Number of sessions destroyed
 */
export async function destroyAllUserSessions(userId: string): Promise<number> {
  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  const client = await pool.connect();

  try {
    const result = await client.query(
      'DELETE FROM sessions WHERE user_id = $1 RETURNING id',
      [userId]
    );

    const count = result.rowCount || 0;
    logger.info('Destroyed all user sessions', { userId, count });

    return count;
  } catch (error) {
    logger.error('Failed to destroy user sessions', { error, userId });
    throw new DatabaseError('Failed to destroy user sessions');
  } finally {
    client.release();
  }
}
