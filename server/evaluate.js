import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { rankCandidateMatches, getEmbeddingPipeline } from './aiMatcher.js';
import { getClipPipeline } from './clipMatcher.js';
import {
  computeAggregateMetrics,
} from './metrics.js';
import {
  DATASET_METADATA,
  BENCHMARK_CANDIDATE_POOL,
  BENCHMARK_QUERIES,
  SYNTHETIC_IMAGE_STORE,
} from './benchmarkDataset.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Tokenizes text into lowercase alphanumeric words
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Method A: Keyword-Based Baseline Matcher
 * Uses token overlap (Jaccard similarity) over all text and metadata fields plus exact category bonus.
 */
export function rankCandidatesKeywordBaseline(targetItem, candidates) {
  const targetTokens = tokenize(
    `${targetItem.title} ${targetItem.description} ${targetItem.category || ''} ${targetItem.color || ''} ${targetItem.location_description || ''}`
  );
  const targetSet = new Set(targetTokens);

  const scored = candidates.map((cand) => {
    const candTokens = tokenize(
      `${cand.title} ${cand.description} ${cand.category || ''} ${cand.color || ''} ${cand.location_description || ''}`
    );
    const candSet = new Set(candTokens);

    let intersection = 0;
    for (const t of targetSet) {
      if (candSet.has(t)) intersection++;
    }

    const union = new Set([...targetSet, ...candSet]).size;
    const jaccard = union > 0 ? intersection / union : 0;
    const catBonus = cand.category === targetItem.category ? 0.35 : 0.0;
    const score = jaccard * 0.65 + catBonus;

    return {
      id: cand.id,
      score,
    };
  });

  // Sort descending by score; break ties deterministically by ID
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return scored;
}

/**
 * Creates a mock Supabase storage client for synthetic image fixtures
 */
function createMockStorageClient(imageStore) {
  return {
    storage: {
      from: () => ({
        download: async (imagePath) => {
          const raw = imageStore[imagePath];
          if (!raw) {
            return { data: null, error: { message: `Synthetic image fixture "${imagePath}" not found.` } };
          }
          return { data: raw, error: null };
        },
      }),
    },
  };
}

/**
 * Runs evaluation for a specific matching method over the benchmark queries
 */
async function evaluateMethod(methodName, queries, candidatePool, executeMatchFn) {
  const queryEvaluations = [];
  const warmLatencies = [];
  let coldStartLatencyMs = null;

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const startTime = performance.now();

    const rankedCandidates = await executeMatchFn(q.targetItem, candidatePool);

    const endTime = performance.now();
    const elapsedMs = Math.round((endTime - startTime) * 10) / 10;

    if (i === 0) {
      coldStartLatencyMs = elapsedMs;
    } else {
      warmLatencies.push(elapsedMs);
    }

    queryEvaluations.push({
      queryId: q.id,
      description: q.description,
      rankedIds: (rankedCandidates || []).map((c) => c.id),
      relevantIds: q.relevantCandidateIds,
      latencyMs: elapsedMs,
    });
  }

  const aggregate = computeAggregateMetrics(queryEvaluations);

  return {
    methodName,
    metrics: aggregate,
    coldStartLatencyMs,
    warmLatenciesMs: warmLatencies,
    queryDetails: queryEvaluations,
  };
}

/**
 * Formats a single metric value as percentage string or float
 */
function fmtPct(val) {
  return `${(val * 100).toFixed(1)}%`;
}

/**
 * Main benchmark runner
 */
export async function runBenchmark(options = {}) {
  const silent = Boolean(options.silent);

  if (!silent) {
    console.log('\n============================================================');
    console.log('   FIND-AI MATCHING EVALUATION BENCHMARK (STEP 10)         ');
    console.log('============================================================');
    console.log(`Dataset Name:       ${DATASET_METADATA.name}`);
    console.log(`Dataset Type:       ${DATASET_METADATA.type.toUpperCase()} (Controlled Evaluation)`);
    console.log(`Evaluated Queries:  ${BENCHMARK_QUERIES.length} queries`);
    console.log(`Candidate Pool:     ${BENCHMARK_CANDIDATE_POOL.length} candidate reports`);
    console.log(`Categories Covered: ${DATASET_METADATA.categoriesCovered.join(', ')}`);
    console.log('------------------------------------------------------------');
    console.log('Pre-warming AI models in memory to measure true cold vs warm latency...');
  }

  // Measure initial model load latency explicitly
  const prewarmStart = performance.now();
  await Promise.all([getEmbeddingPipeline(), getClipPipeline()]);
  const prewarmDurationMs = Math.round((performance.now() - prewarmStart) * 10) / 10;

  if (!silent) {
    console.log(`Models pre-warmed in ${prewarmDurationMs} ms (Text: all-MiniLM-L6-v2, Vision: CLIP ViT-B/32)`);
    console.log('\nExecuting comparative evaluations across 3 matching paradigms:\n');
  }

  // 1. Method A: Keyword-based baseline
  const resultMethodA = await evaluateMethod(
    'A. Keyword Baseline (Lexical + Exact Category)',
    BENCHMARK_QUERIES,
    BENCHMARK_CANDIDATE_POOL,
    async (target, pool) => rankCandidatesKeywordBaseline(target, pool)
  );

  // 2. Method B: Text and Metadata AI Matcher (Text embeddings + Category + Color + Date + Location)
  const resultMethodB = await evaluateMethod(
    'B. Text + Metadata AI Matcher (all-MiniLM-L6-v2)',
    BENCHMARK_QUERIES,
    BENCHMARK_CANDIDATE_POOL,
    async (target, pool) => {
      // Do not provide userSupabase so image matching is excluded and weights normalize across text/metadata
      return await rankCandidateMatches(target, pool);
    }
  );

  // 3. Method C: Full Multi-Factor + CLIP Visual Matcher
  const mockStorage = createMockStorageClient(SYNTHETIC_IMAGE_STORE);
  const resultMethodC = await evaluateMethod(
    'C. Full Multimodal AI Matcher (Text + CLIP ViT-B/32 + Metadata)',
    BENCHMARK_QUERIES,
    BENCHMARK_CANDIDATE_POOL,
    async (target, pool) => {
      // Pass mock Supabase storage resolving synthetic images
      return await rankCandidateMatches(target, pool, { userSupabase: mockStorage });
    }
  );

  const report = {
    benchmarkMetadata: {
      timestamp: new Date().toISOString(),
      dataset: DATASET_METADATA,
      prewarmDurationMs,
      limitations: [
        'Evaluated on synthetic test queries and candidates created for algorithmic benchmarking.',
        'Does not measure user submission errors, heavily corrupted photos, or multi-lingual texts.',
        'Scores reflect relative algorithmic ranking performance under controlled conditions.',
      ],
    },
    methods: [
      {
        id: 'keyword-baseline',
        name: resultMethodA.methodName,
        metrics: resultMethodA.metrics,
        coldStartLatencyMs: resultMethodA.coldStartLatencyMs,
      },
      {
        id: 'ai-text-metadata',
        name: resultMethodB.methodName,
        metrics: resultMethodB.metrics,
        coldStartLatencyMs: resultMethodB.coldStartLatencyMs,
      },
      {
        id: 'ai-multimodal-full',
        name: resultMethodC.methodName,
        metrics: resultMethodC.metrics,
        coldStartLatencyMs: resultMethodC.coldStartLatencyMs,
      },
    ],
  };

  // Write machine-readable JSON artifact
  const outputPath = path.resolve(__dirname, 'benchmark_results.json');
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');

  if (!silent) {
    // Print human-readable terminal table
    console.log('---------------------------------------------------------------------------------------------------------');
    console.log(
      'Method'.padEnd(46) +
      'P@1'.padStart(9) +
      'P@3'.padStart(9) +
      'R@1'.padStart(9) +
      'R@3'.padStart(9) +
      'MRR'.padStart(9) +
      'Avg Latency'.padStart(14)
    );
    console.log('---------------------------------------------------------------------------------------------------------');

    for (const m of report.methods) {
      console.log(
        m.name.padEnd(46) +
        fmtPct(m.metrics.precisionAt1).padStart(9) +
        fmtPct(m.metrics.precisionAt3).padStart(9) +
        fmtPct(m.metrics.recallAt1).padStart(9) +
        fmtPct(m.metrics.recallAt3).padStart(9) +
        m.metrics.meanReciprocalRank.toFixed(3).padStart(9) +
        `${m.metrics.latency.meanMs} ms`.padStart(14)
      );
    }
    console.log('---------------------------------------------------------------------------------------------------------');

    console.log('\nKey Metric Highlights:');
    console.log(`• Method A (Keyword):  P@1 = ${fmtPct(resultMethodA.metrics.precisionAt1)}, MRR = ${resultMethodA.metrics.meanReciprocalRank.toFixed(3)}`);
    console.log(`• Method B (Text AI):  P@1 = ${fmtPct(resultMethodB.metrics.precisionAt1)}, MRR = ${resultMethodB.metrics.meanReciprocalRank.toFixed(3)} (Handles synonyms and paraphrasing)`);
    console.log(`• Method C (Full AI):  P@1 = ${fmtPct(resultMethodC.metrics.precisionAt1)}, MRR = ${resultMethodC.metrics.meanReciprocalRank.toFixed(3)} (Incorporates CLIP visual similarity)`);

    console.log('\nLatency Profile (Warm Inference):');
    console.log(`• Keyword Baseline:      Mean: ${resultMethodA.metrics.latency.meanMs} ms | Median: ${resultMethodA.metrics.latency.medianMs} ms`);
    console.log(`• Text AI Matcher:       Mean: ${resultMethodB.metrics.latency.meanMs} ms | Median: ${resultMethodB.metrics.latency.medianMs} ms`);
    console.log(`• Multimodal Full AI:    Mean: ${resultMethodC.metrics.latency.meanMs} ms | Median: ${resultMethodC.metrics.latency.medianMs} ms`);

    console.log(`\nMachine-readable benchmark report saved to: server/benchmark_results.json`);
    console.log('============================================================\n');
  }

  return report;
}

// Auto-run if executed directly via node server/evaluate.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runBenchmark()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\nBenchmark execution failed:', err);
      process.exit(1);
    });
}
