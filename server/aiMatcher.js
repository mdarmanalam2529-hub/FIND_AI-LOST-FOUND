import { pipeline } from '@xenova/transformers';
import {
  fetchAuthorizedReportImage,
  generateImageEmbedding,
  computeImageCosineSimilarity,
  isValidStoragePath,
} from './clipMatcher.js';

/**
 * AI Matching Engine for FindAI.
 * Uses local pretrained all-MiniLM-L6-v2 text embeddings and CLIP ViT-B/32 image embeddings
 * combined with multi-factor metadata scoring (category, color, date, location).
 */

let featureExtractor = null;

/**
 * Lazily loads and caches the text embedding model in memory
 */
export async function getEmbeddingPipeline() {
  if (!featureExtractor) {
    featureExtractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true,
    });
  }
  return featureExtractor;
}

/**
 * Computes mean-pooled, L2-normalized 384-dimensional embedding for a text string
 */
export async function generateTextEmbedding(text) {
  if (!text || typeof text !== 'string') return null;
  const cleanText = text.trim();
  if (cleanText.length === 0) return null;

  const extractor = await getEmbeddingPipeline();
  const output = await extractor(cleanText, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Computes cosine similarity between two normalized vectors
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  // Clamp between 0 and 1 (for normalized vectors, semantic similarity is positive)
  return Math.max(0, Math.min(1, dotProduct));
}

/**
 * Compares two color strings using token overlap
 */
export function computeColorSimilarity(colorA, colorB) {
  if (!colorA || !colorB) return 0.5; // neutral when either is unknown
  const cleanA = colorA.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const cleanB = colorB.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  
  if (cleanA.length === 0 || cleanB.length === 0) return 0.5;

  const common = cleanA.filter((c) => cleanB.includes(c));
  if (common.length > 0) return 1.0;
  return 0.15; // different distinct colors
}

/**
 * Computes temporal proximity score with exponential decay
 */
export function computeDateSimilarity(targetDateStr, candidateDateStr, targetType) {
  if (!targetDateStr || !candidateDateStr) return 0.5;

  const targetDate = new Date(targetDateStr);
  const candidateDate = new Date(candidateDateStr);
  if (isNaN(targetDate.getTime()) || isNaN(candidateDate.getTime())) return 0.5;

  const diffMs = candidateDate.getTime() - targetDate.getTime();
  const diffDays = Math.abs(diffMs) / (1000 * 60 * 60 * 24);

  // Exponential decay with half-life of 14 days
  let score = Math.exp(-diffDays / 14);

  // If lost report occurred after found report by more than 2 days, apply temporal inconsistency penalty
  if (targetType === 'lost' && diffMs < -2 * (1000 * 60 * 60 * 24)) {
    score *= 0.5;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Computes approximate location similarity using Jaccard token overlap
 */
export function computeLocationSimilarity(locA, locB) {
  if (!locA || !locB) return 0.3;
  const setA = new Set(locA.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2));
  const setB = new Set(locB.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2));

  if (setA.size === 0 || setB.size === 0) return 0.3;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0.3 : Math.min(1, Math.max(0.1, intersection / union));
}

/**
 * Sanitizes location description to mask sensitive numbers (phone numbers, private room numbers)
 */
export function sanitizeLocation(loc) {
  if (!loc) return 'Location not specified';
  // Redact phone numbers
  let sanitized = loc.replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[Phone Redacted]');
  // Redact email addresses
  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[Email Redacted]');
  // Redact long sensitive numeric IDs (e.g., student IDs, account numbers, card digits 7-19 length)
  sanitized = sanitized.replace(/\b\d{7,19}\b/g, '[ID/Number Redacted]');
  return sanitized;
}

/**
 * Default configurable scoring weights (including visual CLIP image similarity)
 */
export const DEFAULT_WEIGHTS = {
  text: 0.35,
  image: 0.25,
  category: 0.15,
  color: 0.10,
  date: 0.08,
  location: 0.07,
};

/**
 * Proportional weight normalization.
 * If image matching is not applicable (e.g. missing image, failure), the image weight is dropped
 * and remaining weights are proportionally normalized so they sum to 1.0.
 */
export function normalizeWeights(baseWeights, { includeImage = true } = {}) {
  const active = { ...(baseWeights || DEFAULT_WEIGHTS) };
  if (!includeImage) {
    delete active.image;
  }
  const sum = Object.values(active).reduce((acc, w) => acc + (typeof w === 'number' && w > 0 ? w : 0), 0);
  if (sum === 0) {
    return { text: 1.0 };
  }
  const normalized = {};
  for (const [key, val] of Object.entries(active)) {
    normalized[key] = (val || 0) / sum;
  }
  return normalized;
}

/**
 * Core matching function: Ranks candidates against a target item.
 * Supports backward-compatible signatures:
 *   rankCandidateMatches(targetItem, candidates, weights)
 *   rankCandidateMatches(targetItem, candidates, { weights, userSupabase })
 */
export async function rankCandidateMatches(targetItem, candidates, optionsOrWeights = DEFAULT_WEIGHTS) {
  if (!targetItem || !Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  // Parse options or weights backward-compatibly
  let rawWeights = DEFAULT_WEIGHTS;
  let userSupabase = null;

  if (optionsOrWeights && typeof optionsOrWeights === 'object') {
    if ('weights' in optionsOrWeights || 'userSupabase' in optionsOrWeights) {
      rawWeights = optionsOrWeights.weights || DEFAULT_WEIGHTS;
      userSupabase = optionsOrWeights.userSupabase || null;
    } else {
      rawWeights = optionsOrWeights;
    }
  }

  // 1. Prepare target text & embedding
  const targetText = `${targetItem.title} - ${targetItem.description}`.trim();
  const targetEmbedding = await generateTextEmbedding(targetText);

  // 2. Pre-generate embeddings for candidates in parallel
  const candidateEmbeddings = await Promise.all(
    candidates.map((c) => {
      const cText = `${c.title} - ${c.description}`.trim();
      return generateTextEmbedding(cText);
    })
  );

  // 3. Pre-fetch and generate target image embedding ONCE (if authorized client and image path exist)
  let targetImageEmbedding = null;
  if (userSupabase && targetItem.image_path && isValidStoragePath(targetItem.image_path)) {
    try {
      const targetFetch = await fetchAuthorizedReportImage(userSupabase, targetItem.image_path);
      if (targetFetch.success && targetFetch.blob) {
        targetImageEmbedding = await generateImageEmbedding(targetFetch.blob);
      }
    } catch (err) {
      console.warn('[AI Matcher] Failed to process target report image:', err.message);
      targetImageEmbedding = null;
    }
  }

  // 4. Fetch candidate image embeddings in parallel (only if target image embedding was successfully extracted)
  const candidateImageEmbeddings = await Promise.all(
    candidates.map(async (c) => {
      if (!targetImageEmbedding || !userSupabase || !c.image_path || !isValidStoragePath(c.image_path)) {
        return null;
      }
      try {
        const fetchRes = await fetchAuthorizedReportImage(userSupabase, c.image_path);
        if (fetchRes.success && fetchRes.blob) {
          return await generateImageEmbedding(fetchRes.blob);
        }
      } catch (err) {
        console.warn(`[AI Matcher] Failed to process candidate image for item ${c.id}:`, err.message);
      }
      return null;
    })
  );

  // 5. Score each candidate
  const scoredResults = candidates.map((candidate, idx) => {
    const cEmbedding = candidateEmbeddings[idx];
    const cImageEmbedding = candidateImageEmbeddings[idx];

    // Text & metadata sub-scores
    const textSim = targetEmbedding && cEmbedding ? cosineSimilarity(targetEmbedding, cEmbedding) : 0;
    const catSim = candidate.category === targetItem.category ? 1.0 : 0.0;
    const colorSim = computeColorSimilarity(targetItem.color, candidate.color);
    const dateSim = computeDateSimilarity(targetItem.incident_date, candidate.incident_date, targetItem.item_type);
    const locSim = computeLocationSimilarity(targetItem.location_description, candidate.location_description);

    // Image sub-score (only evaluated when both target and candidate image embeddings are present)
    let imageSim = null;
    if (targetImageEmbedding && cImageEmbedding) {
      imageSim = computeImageCosineSimilarity(targetImageEmbedding, cImageEmbedding);
    }

    const imageEvaluated = imageSim !== null;

    // Dynamically normalize weights: if image is not evaluated, redistribute weight across remaining signals
    const effectiveWeights = normalizeWeights(rawWeights, { includeImage: imageEvaluated });

    // Composite weighted score [0, 1]
    let rawScore =
      (effectiveWeights.text * textSim) +
      (effectiveWeights.category * catSim) +
      (effectiveWeights.color * colorSim) +
      (effectiveWeights.date * dateSim) +
      (effectiveWeights.location * locSim);

    if (imageEvaluated && typeof effectiveWeights.image === 'number') {
      rawScore += effectiveWeights.image * imageSim;
    }

    // Ensure score stays strictly within [0, 1]
    rawScore = Math.max(0, Math.min(1, rawScore));
    const scorePct = Math.round(rawScore * 1000) / 10; // e.g. 84.5%

    // Explanations breakdown
    const breakdown = {
      textSimilarityPct: Math.round(textSim * 100),
      imageSimilarityPct: imageEvaluated ? Math.round(imageSim * 100) : null,
      imageEvaluated,
      categoryMatch: catSim === 1.0,
      colorScorePct: Math.round(colorSim * 100),
      dateProximityPct: Math.round(dateSim * 100),
      locationSimilarityPct: Math.round(locSim * 100),
      weightsUsed: effectiveWeights,
    };

    // Human-readable summary
    const summaryParts = [];
    if (catSim === 1.0) summaryParts.push('Matching category');
    if (imageEvaluated) {
      if (imageSim >= 0.85) summaryParts.push('High visual/photo match');
      else if (imageSim >= 0.60) summaryParts.push('Moderate visual similarity');
    }
    if (textSim >= 0.70) summaryParts.push('High semantic description match');
    else if (textSim >= 0.50) summaryParts.push('Moderate description overlap');
    if (colorSim === 1.0) summaryParts.push('Compatible color');
    if (dateSim >= 0.75) summaryParts.push('Close incident date');

    const summary = summaryParts.length > 0 
      ? summaryParts.join(' • ') 
      : 'Low overall attribute correlation';

    return {
      id: candidate.id,
      item_type: candidate.item_type,
      title: candidate.title,
      description: candidate.description,
      category: candidate.category,
      color: candidate.color || null,
      incident_date: candidate.incident_date,
      location_description: sanitizeLocation(candidate.location_description),
      has_image: Boolean(candidate.image_path),
      created_at: candidate.created_at,
      score: scorePct,
      breakdown,
      explanation: summary,
      disclaimer: 'Suggested matches are algorithmic estimates based on text, visual, and metadata similarity. They do not constitute verified proof of ownership.',
    };
  });

  // 6. Sort descending by score
  scoredResults.sort((a, b) => b.score - a.score);

  return scoredResults;
}
