import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { rankCandidateMatches, DEFAULT_WEIGHTS, getEmbeddingPipeline } from './aiMatcher.js';
import { getClipPipeline, getClipStatus } from './clipMatcher.js';
import { claimRoutes } from './claimRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase Configuration from environment
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = 
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
  process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const serviceSupabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn('[Server Warning] VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is not set in environment.');
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[Server Warning] SUPABASE_SERVICE_ROLE_KEY not configured. Admin review queue queries will run under standard client RLS.');
}

// Middleware
app.use(express.json({ limit: '64kb' }));

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// In-Memory Rate Limiter: max 40 requests per minute per user/IP to protect AI CPU inference
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
async function authenticateUser(req, res, next) {
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
}

/**
 * GET /api/health
 * Health check endpoint indicating service and model status
 */
app.get('/api/health', (req, res) => {
  const clip = getClipStatus();
  res.json({
    status: 'ok',
    service: 'FindAI Semantic Matching API',
    models: {
      text: 'Xenova/all-MiniLM-L6-v2',
      image: clip.modelId,
      imageEnabled: clip.enabled,
      imageLoaded: clip.isLoaded,
    },
    timestamp: new Date().toISOString(),
  });
});

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST /api/matches
 * Finds, scores, and ranks candidate matches for a specified target report.
 * Lost reports are matched against Found reports, and vice versa.
 */
app.post('/api/matches', authenticateUser, rateLimiter, async (req, res) => {
  const { targetItemId, limit = 10, weights = DEFAULT_WEIGHTS } = req.body;

  // 1. Strict Input & UUID Validation
  if (!targetItemId || typeof targetItemId !== 'string' || !UUID_V4_REGEX.test(targetItemId.trim())) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Field "targetItemId" is required and must be a valid UUID v4 format.',
    });
  }

  const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);

  // Validate custom weights if provided
  let safeWeights = DEFAULT_WEIGHTS;
  if (weights && typeof weights === 'object' && !Array.isArray(weights)) {
    safeWeights = {};
    for (const [key, val] of Object.entries(weights)) {
      if (typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 1) {
        safeWeights[key] = val;
      }
    }
    if (Object.keys(safeWeights).length === 0) {
      safeWeights = DEFAULT_WEIGHTS;
    }
  }

  try {
    const userSupabase = req.userSupabase;

    // 2. Fetch target item using the user's authenticated Supabase client (RLS enforced)
    const { data: targetItem, error: targetError } = await userSupabase
      .from('items')
      .select('*')
      .eq('id', targetItemId.trim())
      .single();

    if (targetError || !targetItem) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Target report not found or you are not authorized to access it.',
      });
    }

    // 3. IDOR Prevention: User MUST own the target report to trigger matching
    if (targetItem.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not authorized to run matching searches for a report you do not own.',
      });
    }

    // 4. Status eligibility check
    if (targetItem.status !== 'open') {
      return res.status(400).json({
        error: 'Ineligible Status',
        message: `Target report is currently "${targetItem.status}". Matching is only performed on active "open" reports.`,
      });
    }

    // 4. Determine opposite candidate item_type (Lost <-> Found only)
    const oppositeType = targetItem.item_type === 'lost' ? 'found' : 'lost';

    // 5. Query candidate pool from items table under user RLS
    // Only fetch open items of the opposite type
    const { data: rawCandidates, error: candidateError } = await userSupabase
      .from('items')
      .select('*')
      .eq('item_type', oppositeType)
      .eq('status', 'open')
      .neq('id', targetItem.id);

    if (candidateError) {
      console.error('[Database Error] Failed to fetch candidate pool:', candidateError.message);
      return res.status(500).json({
        error: 'Internal Error',
        message: 'Failed to retrieve candidate reports from database.',
      });
    }

    // 6. Exclude reports owned by the same user and prevent matching against self
    const candidates = (rawCandidates || []).filter(
      (c) => c.id !== targetItem.id && c.user_id !== req.user.id
    );

    // 7. Handle empty candidate pool safely
    if (candidates.length === 0) {
      return res.json({
        targetItem: {
          id: targetItem.id,
          title: targetItem.title,
          item_type: targetItem.item_type,
          category: targetItem.category,
        },
        matches: [],
        totalCandidates: 0,
        message: `No active open ${oppositeType} reports found to compare against at this time.`,
        disclaimer: 'Suggested matches are algorithmic estimates and do not constitute verified proof of ownership.',
      });
    }

    // 8. Run AI Semantic & Multi-factor Ranking (including CLIP image comparison under RLS)
    const rankedMatches = await rankCandidateMatches(targetItem, candidates, {
      weights: safeWeights,
      userSupabase,
    });
    const topMatches = rankedMatches.slice(0, safeLimit);

    return res.json({
      targetItem: {
        id: targetItem.id,
        title: targetItem.title,
        item_type: targetItem.item_type,
        category: targetItem.category,
      },
      matches: topMatches,
      totalCandidates: candidates.length,
      returnedCount: topMatches.length,
      disclaimer: 'Suggested matches are algorithmic estimates based on text, visual, and metadata similarity. They do not constitute verified proof of ownership.',
    });
  } catch (err) {
    console.error('[Matching Error] Processing failed:', err);
    return res.status(500).json({
      error: 'Matching Error',
      message: 'An unexpected error occurred during AI match calculation.',
    });
  }
});

// Mount Hybrid Claim & Return System routes (protected by authentication & rate limiting)
app.use('/api', authenticateUser, rateLimiter, claimRoutes);

// Serve static frontend files when built (single combined server mode)
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// Warm up models in background on startup
Promise.allSettled([
  getEmbeddingPipeline()
    .then(() => console.log('[AI Server] all-MiniLM-L6-v2 text embedding model loaded and ready.')),
  getClipPipeline()
    .then(() => console.log('[AI Server] CLIP ViT-B/32 image embedding model loaded and ready.')),
]).catch((err) => console.warn('[AI Server] Model background pre-warming deferred:', err.message));

app.listen(PORT, () => {
  console.log(`[AI Server] FindAI Matching Engine running on http://localhost:${PORT}`);
});

export default app;
