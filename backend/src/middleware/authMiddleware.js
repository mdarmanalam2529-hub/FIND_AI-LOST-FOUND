import { createClient } from '@supabase/supabase-js';
import { isAuthorizedAdmin } from '../services/claimWorkflow.js';

// Rate Limiter Storage: In-memory sliding window counters keyed by user ID or IP
export const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 40;

// Periodic cleanup of stale rate-limit buckets every 5 minutes
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);
if (cleanupInterval.unref) cleanupInterval.unref();

export function rateLimiter(req, res, next) {
  const key = req.user?.id || req.ip || 'anonymous';
  const now = Date.now();
  let record = rateLimitMap.get(key);

  if (!record || (now - record.windowStart) > RATE_LIMIT_WINDOW_MS) {
    record = { windowStart: now, count: 1 };
    rateLimitMap.set(key, record);
    return next();
  }

  record.count++;
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((record.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);
    res.setHeader('Retry-After', retryAfterSeconds);
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Please wait ${retryAfterSeconds} seconds before requesting more AI matches.`,
    });
  }

  next();
}

/**
 * Authentication Middleware:
 * Verifies Supabase JWT from the Authorization: Bearer <token> header.
 * Derives user identity strictly from the verified token.
 */
export function createAuthMiddleware({ SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, serviceSupabase }) {
  return async function authenticateUser(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or malformed Authorization header. Expected Bearer <token>.',
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.trim() === '') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Empty authentication token provided.',
      });
    }

    try {
      // Instantiate a user-scoped Supabase client that carries the caller's JWT
      const userSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });

      // Verify token with Supabase Auth
      const { data: { user }, error } = await userSupabase.auth.getUser(token);
      if (error || !user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid, expired, or revoked authentication token.',
        });
      }

      // Attach verified user and authenticated client to request
      req.user = user;
      req.userSupabase = userSupabase;
      req.serviceSupabase = serviceSupabase;
      next();
    } catch (err) {
      console.error('[Auth Error] Token verification failed:', err.message);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication verification encountered an unexpected error.',
      });
    }
  };
}

export function requireAdmin(req, res, next) {
  if (!req.user || !isAuthorizedAdmin(req.user)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access restricted to authorized institutional administrators only.',
    });
  }
  next();
}

