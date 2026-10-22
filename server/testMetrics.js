import assert from 'node:assert/strict';
import {
  calculatePrecisionAtK,
  calculateRecallAtK,
  calculateReciprocalRank,
  calculateLatencyStats,
  computeAggregateMetrics,
} from './metrics.js';

console.log('--- FindAI Evaluation Metrics Test Suite ---');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    throw err;
  }
}

// 1. Precision@K tests
test('calculatePrecisionAtK computes exact ratios for top-K cutoffs', () => {
  const ranked = ['item-1', 'item-2', 'item-3', 'item-4', 'item-5'];
  const relevant = ['item-1', 'item-3']; // 2 relevant items

  // P@1: item-1 is relevant -> 1/1 = 1.0
  assert.equal(calculatePrecisionAtK(ranked, relevant, 1), 1.0);

  // P@2: item-1 is relevant, item-2 is not -> 1/2 = 0.5
  assert.equal(calculatePrecisionAtK(ranked, relevant, 2), 0.5);

  // P@3: item-1 and item-3 are relevant, item-2 is not -> 2/3 ~ 0.6667
  assert.ok(Math.abs(calculatePrecisionAtK(ranked, relevant, 3) - 2 / 3) < 1e-6);

  // P@5: item-1 and item-3 relevant -> 2/5 = 0.4
  assert.equal(calculatePrecisionAtK(ranked, relevant, 5), 0.4);
});

test('calculatePrecisionAtK handles edge cases: empty list, zero k, no relevant items', () => {
  assert.equal(calculatePrecisionAtK([], ['item-1'], 1), 0);
  assert.equal(calculatePrecisionAtK(['item-1'], [], 1), 0);
  assert.equal(calculatePrecisionAtK(['item-1'], ['item-1'], 0), 0);
  assert.equal(calculatePrecisionAtK(['item-1'], ['item-1'], -1), 0);
  assert.equal(calculatePrecisionAtK(['item-1'], null, 1), 0);
});

// 2. Recall@K tests
test('calculateRecallAtK computes exact fraction of total relevant items retrieved', () => {
  const ranked = ['item-1', 'item-2', 'item-3', 'item-4', 'item-5'];
  const relevant = ['item-1', 'item-3', 'item-9']; // 3 total relevant items

  // R@1: 1 of 3 relevant retrieved -> 1/3
  assert.ok(Math.abs(calculateRecallAtK(ranked, relevant, 1) - 1 / 3) < 1e-6);

  // R@3: 2 of 3 relevant retrieved (item-1, item-3) -> 2/3
  assert.ok(Math.abs(calculateRecallAtK(ranked, relevant, 3) - 2 / 3) < 1e-6);

  // R@5: 2 of 3 relevant retrieved -> 2/3
  assert.ok(Math.abs(calculateRecallAtK(ranked, relevant, 5) - 2 / 3) < 1e-6);
});

test('calculateRecallAtK returns null when query has zero relevant items (avoids division by zero)', () => {
  const ranked = ['item-1', 'item-2'];
  assert.equal(calculateRecallAtK(ranked, [], 1), null);
  assert.equal(calculateRecallAtK(ranked, null, 1), null);
});

// 3. Reciprocal Rank tests
test('calculateReciprocalRank computes 1 / rank of first relevant match', () => {
  const relevant = ['target-item'];

  // Rank 1: 1/1 = 1.0
  assert.equal(calculateReciprocalRank(['target-item', 'distractor'], relevant), 1.0);

  // Rank 2: 1/2 = 0.5
  assert.equal(calculateReciprocalRank(['distractor', 'target-item'], relevant), 0.5);

  // Rank 3: 1/3
  assert.ok(Math.abs(calculateReciprocalRank(['d1', 'd2', 'target-item'], relevant) - 1 / 3) < 1e-6);

  // No relevant match in top list -> 0.0
  assert.equal(calculateReciprocalRank(['d1', 'd2', 'd3'], relevant), 0.0);
  assert.equal(calculateReciprocalRank([], relevant), 0.0);
  assert.equal(calculateReciprocalRank(['d1'], []), 0.0);
});

// 4. Latency stats tests
test('calculateLatencyStats computes mean, median, min, max, and P90 correctly', () => {
  const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const stats = calculateLatencyStats(latencies);

  assert.equal(stats.count, 10);
  assert.equal(stats.minMs, 10);
  assert.equal(stats.maxMs, 100);
  assert.equal(stats.meanMs, 55);
  assert.equal(stats.medianMs, 55);
  assert.equal(stats.p90Ms, 100);

  // Odd count for median
  const oddStats = calculateLatencyStats([5, 15, 25]);
  assert.equal(oddStats.medianMs, 15);
  assert.equal(oddStats.meanMs, 15);

  // Empty latencies
  const emptyStats = calculateLatencyStats([]);
  assert.equal(emptyStats.count, 0);
  assert.equal(emptyStats.meanMs, 0);
});

// 5. Aggregate metrics tests (including zero-relevant queries)
test('computeAggregateMetrics computes macro averages across multiple queries including zero-relevant', () => {
  const queries = [
    // Query 1: Relevant item at rank 1
    { rankedIds: ['r1', 'd1', 'd2'], relevantIds: ['r1'], latencyMs: 20 },
    // Query 2: Relevant item at rank 2
    { rankedIds: ['d2', 'r2', 'd3'], relevantIds: ['r2'], latencyMs: 30 },
    // Query 3: No relevant match query (relevant set is empty)
    { rankedIds: ['d4', 'd5'], relevantIds: [], latencyMs: 25 },
  ];

  const agg = computeAggregateMetrics(queries);
  assert.equal(agg.queryCount, 3);
  assert.equal(agg.queriesWithRelevant, 2);
  assert.equal(agg.queriesWithoutRelevant, 1);

  // P@1: (1 + 0 + 0) / 3 = 1/3 ~ 0.333
  assert.ok(Math.abs(agg.precisionAt1 - 0.333) < 1e-3);

  // MRR: (1/1 + 1/2 + 0) / 3 = 1.5 / 3 = 0.500
  assert.equal(agg.meanReciprocalRank, 0.500);

  // Recall@1 is only averaged over the 2 queries with relevant items:
  // Q1 recall@1 = 1/1 = 1.0; Q2 recall@1 = 0/1 = 0.0 -> average = 0.500
  assert.equal(agg.recallAt1, 0.500);

  assert.equal(agg.latency.count, 3);
  assert.equal(agg.latency.meanMs, 25);
});

test('computeAggregateMetrics safely handles empty query set without crashing', () => {
  const agg = computeAggregateMetrics([]);
  assert.equal(agg.queryCount, 0);
  assert.equal(agg.precisionAt1, 0);
  assert.equal(agg.recallAt1, 0);
  assert.equal(agg.meanReciprocalRank, 0);
});

console.log(`\nAll ${passed}/${total} Metrics tests passed successfully!`);
