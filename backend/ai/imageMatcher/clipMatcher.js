import { pipeline, RawImage } from '@xenova/transformers';

/**
 * CLIP ViT-B/32 Image Matching Module for FindAI.
 * 
 * Provides:
 * - Lazy loading of Xenova/clip-vit-base-patch32 with graceful fallback if model fails to load
 * - Secure fetching of private report images using authenticated Supabase client (RLS enforced)
 * - 512-dimensional L2-normalized image embeddings
 * - Cosine similarity calculation between image pairs
 * - Safe error handling: missing images, invalid formats, network timeouts, and model failures
 */

export const CLIP_MODEL_ID = 'Xenova/clip-vit-base-patch32';
export const STORAGE_BUCKET = 'item-images';
export const DEFAULT_TIMEOUT_MS = 6000;

let clipPipelinePromise = null;
let clipPipeline = null;
let clipLoadError = null;
let isClipDisabled = false;

/**
 * Check if path is a safe, valid storage path (prevents path traversal)
 */
export function isValidStoragePath(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return false;
  const clean = imagePath.trim();
  if (clean.length === 0 || clean.length > 512) return false;
  // Disallow directory traversal or root escape
  if (clean.includes('..') || clean.startsWith('/') || clean.startsWith('\\')) return false;
  // Disallow illegal characters (allow uuid/id/timestamp.ext)
  return /^[a-zA-Z0-9_\-./]+\.(jpe?g|png|webp)$/i.test(clean);
}

/**
 * Disable CLIP matching manually (useful for testing fallback or low-resource environments)
 */
export function setClipDisabled(disabled) {
  isClipDisabled = Boolean(disabled);
}

/**
 * Reset internal CLIP state (primarily for isolated test fixtures)
 */
export function resetClipState() {
  clipPipelinePromise = null;
  clipPipeline = null;
  clipLoadError = null;
  isClipDisabled = false;
}

/**
 * Get current CLIP availability status
 */
export function getClipStatus() {
  return {
    enabled: !isClipDisabled,
    isLoaded: Boolean(clipPipeline),
    loadError: clipLoadError ? clipLoadError.message : null,
    modelId: CLIP_MODEL_ID,
  };
}

/**
 * Lazily loads and caches the CLIP image feature extraction pipeline in memory
 */
export async function getClipPipeline() {
  if (isClipDisabled) {
    return null;
  }
  if (clipPipeline) {
    return clipPipeline;
  }
  if (clipLoadError) {
    return null;
  }

  if (!clipPipelinePromise) {
    clipPipelinePromise = (async () => {
      try {
        const pipe = await pipeline('image-feature-extraction', CLIP_MODEL_ID, {
          quantized: true,
        });
        clipPipeline = pipe;
        return pipe;
      } catch (err) {
        clipLoadError = err;
        console.warn(`[CLIP Matcher] Failed to load model "${CLIP_MODEL_ID}":`, err.message);
        return null;
      } finally {
        clipPipelinePromise = null;
      }
    })();
  }

  return clipPipelinePromise;
}

/**
 * Extracts a 512-dimensional L2-normalized embedding for an image input.
 * Supports RawImage, Blob, Buffer, or data URI.
 */
export async function generateImageEmbedding(imageInput, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  if (!imageInput) return null;

  const pipe = await getClipPipeline();
  if (!pipe) return null;

  try {
    let rawImg = null;

    if (imageInput instanceof RawImage) {
      rawImg = imageInput;
    } else if (typeof Blob !== 'undefined' && imageInput instanceof Blob) {
      rawImg = await RawImage.fromBlob(imageInput);
    } else if (Buffer.isBuffer(imageInput)) {
      rawImg = await RawImage.read(imageInput);
    } else if (typeof imageInput === 'string') {
      rawImg = await RawImage.read(imageInput);
    } else {
      console.warn('[CLIP Matcher] Unsupported image input type.');
      return null;
    }

    if (!rawImg || !rawImg.data || rawImg.width <= 0 || rawImg.height <= 0) {
      return null;
    }

    // Run inference with timeout protection
    const inferencePromise = pipe(rawImg);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('CLIP inference timed out')), timeoutMs)
    );

    const output = await Promise.race([inferencePromise, timeoutPromise]);
    const rawVector = Array.from(output.data);

    // Compute L2 norm and normalize vector to unit length
    let sumSq = 0;
    for (let i = 0; i < rawVector.length; i++) {
      sumSq += rawVector[i] * rawVector[i];
    }
    const norm = Math.sqrt(sumSq);
    if (norm === 0 || isNaN(norm)) return null;

    const normalizedVector = rawVector.map((val) => val / norm);
    return normalizedVector;
  } catch (err) {
    console.warn('[CLIP Matcher] Error generating image embedding:', err.message);
    return null;
  }
}

/**
 * Computes cosine similarity between two unit-normalized vectors.
 * Clamped to [0, 1].
 */
export function computeImageCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return Math.max(0, Math.min(1, dot));
}

/**
 * Downloads a private image securely via the requesting user's Supabase client.
 * Enforces RLS: callers cannot download images they are not authorized to view.
 */
export async function fetchAuthorizedReportImage(userSupabase, imagePath, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  if (!userSupabase || !userSupabase.storage) {
    return { success: false, reason: 'INVALID_CLIENT', error: 'User Supabase client not provided.' };
  }

  if (!isValidStoragePath(imagePath)) {
    return { success: false, reason: 'INVALID_PATH', error: 'Storage image path is missing or malformed.' };
  }

  try {
    const downloadPromise = userSupabase.storage
      .from(STORAGE_BUCKET)
      .download(imagePath);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Storage download timed out')), timeoutMs)
    );

    const result = await Promise.race([downloadPromise, timeoutPromise]);
    const { data, error } = result;

    if (error || !data) {
      return {
        success: false,
        reason: 'INACCESSIBLE',
        error: error ? error.message : 'No data returned from storage.',
      };
    }

    return {
      success: true,
      blob: data,
    };
  } catch (err) {
    return {
      success: false,
      reason: 'FETCH_ERROR',
      error: err.message,
    };
  }
}

/**
 * High-level comparator for two report images.
 * Returns { compared: boolean, similarity: number | null, similarityPct: number | null, reason?: string }
 */
export async function compareReportImages(userSupabase, targetImagePath, candidateImagePath, options = {}) {
  // 1. Check for missing images
  if (!targetImagePath || !candidateImagePath) {
    return {
      compared: false,
      similarity: null,
      similarityPct: null,
      reason: !targetImagePath && !candidateImagePath 
        ? 'Both reports lack images' 
        : !targetImagePath 
        ? 'Target report lacks an image' 
        : 'Candidate report lacks an image',
    };
  }

  // 2. Validate paths
  if (!isValidStoragePath(targetImagePath) || !isValidStoragePath(candidateImagePath)) {
    return {
      compared: false,
      similarity: null,
      similarityPct: null,
      reason: 'One or more image paths are invalid',
    };
  }

  // 3. Check if CLIP is available
  const pipe = await getClipPipeline();
  if (!pipe) {
    return {
      compared: false,
      similarity: null,
      similarityPct: null,
      reason: clipLoadError ? `CLIP model failed to load: ${clipLoadError.message}` : 'CLIP model is unavailable',
    };
  }

  // 4. Fetch target image
  const targetFetch = await fetchAuthorizedReportImage(userSupabase, targetImagePath, options);
  if (!targetFetch.success) {
    return {
      compared: false,
      similarity: null,
      similarityPct: null,
      reason: `Failed to retrieve target report image: ${targetFetch.error || targetFetch.reason}`,
    };
  }

  // 5. Fetch candidate image
  const candidateFetch = await fetchAuthorizedReportImage(userSupabase, candidateImagePath, options);
  if (!candidateFetch.success) {
    return {
      compared: false,
      similarity: null,
      similarityPct: null,
      reason: `Failed to retrieve candidate report image: ${candidateFetch.error || candidateFetch.reason}`,
    };
  }

  // 6. Generate embeddings
  const [targetEmbedding, candidateEmbedding] = await Promise.all([
    generateImageEmbedding(targetFetch.blob, options),
    generateImageEmbedding(candidateFetch.blob, options),
  ]);

  if (!targetEmbedding || !candidateEmbedding) {
    return {
      compared: false,
      similarity: null,
      similarityPct: null,
      reason: 'Image decoding or embedding generation failed for one or both photos',
    };
  }

  // 7. Compute Cosine Similarity
  const similarity = computeImageCosineSimilarity(targetEmbedding, candidateEmbedding);
  const similarityPct = Math.round(similarity * 1000) / 10; // e.g. 84.5%

  return {
    compared: true,
    similarity,
    similarityPct,
  };
}
