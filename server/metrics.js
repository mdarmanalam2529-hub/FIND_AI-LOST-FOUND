/**
 * Information Retrieval (IR) Evaluation Metrics for FindAI.
 * 
 * Provides safe, division-by-zero protected implementations of:
 * - Precision@K (P@1, P@3, P@5)
 * - Recall@K (R@1, R@3, R@5)
 * - Mean Reciprocal Rank (MRR)
 * - Latency statistics (mean, median, P90, min, max)
 * 
 * Metric Definitions & Limitations:
 * - Precision@K: Fraction of the top-K retrieved candidates that are relevant.
 *   Limitation: Penalizes queries that have fewer than K total relevant items in existence.
 * - Recall@K: Fraction of total relevant candidates that are retrieved within top-K.
 *   Limitation: Undefined when a query has 0 relevant items; such queries are safely excluded from the recall denominator.
 * - MRR: Average of the reciprocal ranks of the first relevant candidate.
 *   Limitation: Focuses entirely on the rank of the single top relevant hit; does not reward retrieving multiple relevant items.
 */

/**
 * Calculates Precision@K for a single query.
 * P@K = (number of relevant candidates in top K) / K
 * 
 * @param {string[]} rankedCandidateIds - Ordered candidate IDs returned by matcher
 * @param {string[]|Set<string>} relevantIds - Set of ground-truth relevant candidate IDs
 * @param {number} k - Cutoff rank (e.g., 1, 3, 5)
 * @returns {number} Value between 0.0 and 1.0
 */
export function calculatePrecisionAtK(rankedCandidateIds, relevantIds, k) {
  if (!k || k <= 0) return 0;
  if (!Array.isArray(rankedCandidateIds) || rankedCandidateIds.length === 0) return 0;

  const relevantSet = relevantIds instanceof Set ? relevantIds : new Set(relevantIds || []);
  if (relevantSet.size === 0) return 0;

  const topK = rankedCandidateIds.slice(0, k);
  let relevantCount = 0;
  for (const id of topK) {
    if (relevantSet.has(id)) {
      relevantCount++;
    }
  }

  return relevantCount / k;
}

/**
 * Calculates Recall@K for a single query.
 * R@K = (number of relevant candidates in top K) / (total relevant candidates)
 * 
 * @param {string[]} rankedCandidateIds - Ordered candidate IDs returned by matcher
 * @param {string[]|Set<string>} relevantIds - Set of ground-truth relevant candidate IDs
 * @param {number} k - Cutoff rank (e.g., 1, 3, 5)
 * @returns {number|null} Value between 0.0 and 1.0, or null if total relevant is 0
 */
export function calculateRecallAtK(rankedCandidateIds, relevantIds, k) {
  if (!k || k <= 0) return 0;
  const relevantSet = relevantIds instanceof Set ? relevantIds : new Set(relevantIds || []);
  if (relevantSet.size === 0) {
    return null; // Undefined when ground truth has 0 relevant items
  }

  if (!Array.isArray(rankedCandidateIds) || rankedCandidateIds.length === 0) {
    return 0;
  }

  const topK = rankedCandidateIds.slice(0, k);
  let relevantCount = 0;
  for (const id of topK) {
    if (relevantSet.has(id)) {
      relevantCount++;
    }
  }

  return relevantCount / relevantSet.size;
}

/**
 * Calculates Reciprocal Rank (RR) for a single query.
 * RR = 1 / rank of first relevant item (1-indexed), or 0 if none found.
 * 
 * @param {string[]} rankedCandidateIds - Ordered candidate IDs returned by matcher
 * @param {string[]|Set<string>} relevantIds - Set of ground-truth relevant candidate IDs
 * @returns {number} Value between 0.0 and 1.0
 */
export function calculateReciprocalRank(rankedCandidateIds, relevantIds) {
  if (!Array.isArray(rankedCandidateIds) || rankedCandidateIds.length === 0) return 0;
  const relevantSet = relevantIds instanceof Set ? relevantIds : new Set(relevantIds || []);
  if (relevantSet.size === 0) return 0;

  for (let rank = 0; rank < rankedCandidateIds.length; rank++) {
    if (relevantSet.has(rankedCandidateIds[rank])) {
      return 1 / (rank + 1);
    }
  }

  return 0;
}

/**
 * Calculates summary statistics for an array of numeric latency measurements (in ms).
 */
export function calculateLatencyStats(latenciesMs) {
  if (!Array.isArray(latenciesMs) || latenciesMs.length === 0) {
    return {
      count: 0,
      meanMs: 0,
      medianMs: 0,
      p90Ms: 0,
      minMs: 0,
      maxMs: 0,
    };
  }

  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const meanMs = Math.round((sum / count) * 10) / 10;
  const minMs = Math.round(sorted[0] * 10) / 10;
  const maxMs = Math.round(sorted[count - 1] * 10) / 10;

  // Median (50th percentile)
  let medianMs;
  const mid = Math.floor(count / 2);
  if (count % 2 === 0) {
    medianMs = Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
  } else {
    medianMs = Math.round(sorted[mid] * 10) / 10;
  }

  // 90th percentile
  const p90Index = Math.min(Math.floor(count * 0.9), count - 1);
  const p90Ms = Math.round(sorted[p90Index] * 10) / 10;

  return {
    count,
    meanMs,
    medianMs,
    p90Ms,
    minMs,
    maxMs,
  };
}

/**
 * Computes aggregate IR metrics across a collection of evaluated queries.
 * 
 * @param {Array<{ rankedIds: string[], relevantIds: string[], latencyMs?: number }>} queryEvaluations
 * @returns {object} Aggregate metrics object
 */
export function computeAggregateMetrics(queryEvaluations) {
  if (!Array.isArray(queryEvaluations) || queryEvaluations.length === 0) {
    return {
      queryCount: 0,
      queriesWithRelevant: 0,
      queriesWithoutRelevant: 0,
      precisionAt1: 0,
      precisionAt3: 0,
      precisionAt5: 0,
      recallAt1: 0,
      recallAt3: 0,
      recallAt5: 0,
      meanReciprocalRank: 0,
      latency: calculateLatencyStats([]),
    };
  }

  let totalP1 = 0;
  let totalP3 = 0;
  let totalP5 = 0;
  let totalRR = 0;

  let totalR1 = 0;
  let totalR3 = 0;
  let totalR5 = 0;
  let recallCount = 0;

  let queriesWithRelevant = 0;
  let queriesWithoutRelevant = 0;

  const latencies = [];

  for (const q of queryEvaluations) {
    const ranked = q.rankedIds || [];
    const rel = q.relevantIds || [];
    const relCount = Array.isArray(rel) ? rel.length : (rel instanceof Set ? rel.size : 0);

    if (relCount > 0) {
      queriesWithRelevant++;
    } else {
      queriesWithoutRelevant++;
    }

    if (typeof q.latencyMs === 'number') {
      latencies.push(q.latencyMs);
    }

    // Precision & MRR are evaluated across ALL queries
    totalP1 += calculatePrecisionAtK(ranked, rel, 1);
    totalP3 += calculatePrecisionAtK(ranked, rel, 3);
    totalP5 += calculatePrecisionAtK(ranked, rel, 5);
    totalRR += calculateReciprocalRank(ranked, rel);

    // Recall is evaluated only over queries that have >= 1 relevant item
    const r1 = calculateRecallAtK(ranked, rel, 1);
    const r3 = calculateRecallAtK(ranked, rel, 3);
    const r5 = calculateRecallAtK(ranked, rel, 5);

    if (r1 !== null) {
      totalR1 += r1;
      totalR3 += r3;
      totalR5 += r5;
      recallCount++;
    }
  }

  const queryCount = queryEvaluations.length;

  return {
    queryCount,
    queriesWithRelevant,
    queriesWithoutRelevant,
    precisionAt1: Math.round((totalP1 / queryCount) * 1000) / 1000,
    precisionAt3: Math.round((totalP3 / queryCount) * 1000) / 1000,
    precisionAt5: Math.round((totalP5 / queryCount) * 1000) / 1000,
    recallAt1: recallCount > 0 ? Math.round((totalR1 / recallCount) * 1000) / 1000 : 0,
    recallAt3: recallCount > 0 ? Math.round((totalR3 / recallCount) * 1000) / 1000 : 0,
    recallAt5: recallCount > 0 ? Math.round((totalR5 / recallCount) * 1000) / 1000 : 0,
    meanReciprocalRank: Math.round((totalRR / queryCount) * 1000) / 1000,
    latency: calculateLatencyStats(latencies),
  };
}
