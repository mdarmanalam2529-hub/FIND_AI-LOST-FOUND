import assert from 'node:assert/strict';
import { RawImage } from '@xenova/transformers';
import {
  rankCandidateMatches,
  normalizeWeights,
  DEFAULT_WEIGHTS,
} from './aiMatcher.js';
import {
  setClipDisabled,
  resetClipState,
} from './clipMatcher.js';

console.log('--- FindAI Image Matching Integration Test Suite ---');

// Helper to generate a solid color RawImage as an ArrayBuffer/Blob
function createSolidColorBlob(r, g, b, size = 32) {
  // Simple uncompressed PPM or raw buffer; or RawImage converted
  // For Supabase storage download simulation, a Blob with an image format or RawImage directly
  // Transformers RawImage.fromBlob supports png/jpeg/webp or RawImage
  // Since we can mock download returning a RawImage or a mock Blob:
  const data = new Uint8ClampedArray(size * size * 3);
  for (let i = 0; i < data.length; i += 3) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  return new RawImage(data, size, size, 3);
}

async function runTests() {
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

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`[PASS] ${name}`);
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  // 1. Weight Normalization Tests
  test('normalizeWeights properly scales remaining weights when image is excluded', () => {
    const base = { text: 0.35, image: 0.25, category: 0.15, color: 0.10, date: 0.08, location: 0.07 };
    
    // With image
    const normWithImage = normalizeWeights(base, { includeImage: true });
    const sumWithImage = Object.values(normWithImage).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sumWithImage - 1.0) < 1e-6, `Sum with image should be 1.0, got ${sumWithImage}`);
    assert.equal(normWithImage.image, 0.25);

    // Without image
    const normNoImage = normalizeWeights(base, { includeImage: false });
    const sumNoImage = Object.values(normNoImage).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sumNoImage - 1.0) < 1e-6, `Sum without image should be 1.0, got ${sumNoImage}`);
    assert.equal(normNoImage.image, undefined, 'Image weight must be removed when image is excluded');

    // Expected proportional scaling: 0.35 / 0.75 ~ 0.4667
    assert.ok(Math.abs(normNoImage.text - (0.35 / 0.75)) < 1e-4);
    assert.ok(Math.abs(normNoImage.category - (0.15 / 0.75)) < 1e-4);
  });

  // 2. Integration: When no images are attached to reports
  await asyncTest('rankCandidateMatches scores text and metadata cleanly when reports have no images', async () => {
    const target = {
      id: 'target-01',
      item_type: 'lost',
      title: 'Lost Silver Dell XPS Laptop',
      description: '15 inch Dell XPS silver laptop left in library',
      category: 'Electronics',
      color: 'Silver',
      incident_date: '2026-10-18',
      location_description: 'Library 3rd floor',
      image_path: null, // No image
    };

    const candidates = [
      {
        id: 'cand-01',
        item_type: 'found',
        title: 'Found Dell XPS laptop',
        description: 'Silver 15 inch Dell laptop with charger found in library',
        category: 'Electronics',
        color: 'Silver',
        incident_date: '2026-10-18',
        location_description: 'Library reading room',
        image_path: null, // No image
      },
    ];

    const results = await rankCandidateMatches(target, candidates);
    assert.equal(results.length, 1);
    const top = results[0];

    assert.equal(top.id, 'cand-01');
    assert.equal(top.breakdown.imageEvaluated, false);
    assert.equal(top.breakdown.imageSimilarityPct, null);
    assert.ok(top.score > 70, `Expected high score for matching laptop, got ${top.score}`);
    assert.equal(top.has_image, false);
    assert.equal(top.image_path, undefined, 'image_path must never be exposed');
  });

  // 3. Integration: Mock Supabase client providing images for CLIP comparison
  await asyncTest('rankCandidateMatches integrates CLIP image similarity when both reports have photos', async () => {
    resetClipState();

    // Create two mock images: Target is blue, Candidate A is blue (matching), Candidate B is yellow (non-matching)
    const blueImg = createSolidColorBlob(20, 30, 220);
    const blueImg2 = createSolidColorBlob(25, 35, 215);
    const yellowImg = createSolidColorBlob(220, 220, 20);

    const imageStore = {
      'user-1/item-1/target.jpg': blueImg,
      'user-2/item-2/cand-blue.jpg': blueImg2,
      'user-3/item-3/cand-yellow.jpg': yellowImg,
    };

    const mockSupabase = {
      storage: {
        from: (bucket) => ({
          download: async (path) => {
            const raw = imageStore[path];
            if (!raw) return { data: null, error: { message: 'Object not found' } };
            return { data: raw, error: null };
          },
        }),
      },
    };

    const target = {
      id: 'target-waterbottle',
      item_type: 'lost',
      title: 'Blue HydroFlask Water Bottle',
      description: 'Insulated stainless steel blue bottle with black sport cap',
      category: 'Accessories',
      color: 'Blue',
      incident_date: '2026-10-18',
      location_description: 'Gym locker room',
      image_path: 'user-1/item-1/target.jpg',
    };

    const candidates = [
      {
        id: 'cand-yellow-bottle',
        item_type: 'found',
        title: 'Yellow drink flask',
        description: 'Insulated water bottle found on bench',
        category: 'Accessories',
        color: 'Yellow',
        incident_date: '2026-10-18',
        location_description: 'Gym lobby',
        image_path: 'user-3/item-3/cand-yellow.jpg',
      },
      {
        id: 'cand-blue-bottle',
        item_type: 'found',
        title: 'Blue Hydro Flask water bottle',
        description: 'Stainless steel blue thermal water flask with sport cap',
        category: 'Accessories',
        color: 'Blue',
        incident_date: '2026-10-18',
        location_description: 'Gym locker area',
        image_path: 'user-2/item-2/cand-blue.jpg',
      },
    ];

    const results = await rankCandidateMatches(target, candidates, {
      userSupabase: mockSupabase,
    });

    assert.equal(results.length, 2);
    const topMatch = results[0];
    const secondMatch = results[1];

    // The blue bottle should rank #1 with high image similarity and high text similarity
    assert.equal(topMatch.id, 'cand-blue-bottle');
    assert.equal(topMatch.breakdown.imageEvaluated, true);
    assert.ok(topMatch.breakdown.imageSimilarityPct !== null);
    assert.ok(topMatch.breakdown.imageSimilarityPct >= 90, `Blue vs blue image similarity should be >= 90%, got ${topMatch.breakdown.imageSimilarityPct}%`);
    assert.match(topMatch.explanation, /visual/i);

    // Both should have has_image = true, but no private paths exposed
    assert.equal(topMatch.has_image, true);
    assert.equal(topMatch.image_path, undefined);
    assert.equal(topMatch.user_id, undefined);
  });

  // 4. Inaccessible Image / Storage Failure Fallback
  await asyncTest('rankCandidateMatches gracefully falls back when storage download fails on candidate image', async () => {
    const mockSupabaseFailing = {
      storage: {
        from: () => ({
          download: async () => ({
            data: null,
            error: { message: 'Storage object 404 not found' },
          }),
        }),
      },
    };

    const target = {
      id: 'target-02',
      item_type: 'lost',
      title: 'Black Backpack',
      description: 'North Face black backpack with laptop sleeve',
      category: 'Bags',
      color: 'Black',
      incident_date: '2026-10-18',
      location_description: 'Bus stop #4',
      image_path: 'user-1/item-2/backpack.jpg',
    };

    const candidates = [
      {
        id: 'cand-02',
        item_type: 'found',
        title: 'Found black backpack',
        description: 'Black North Face backpack left at bus terminal',
        category: 'Bags',
        color: 'Black',
        incident_date: '2026-10-18',
        location_description: 'Bus terminal',
        image_path: 'user-2/item-2/deleted_backpack.jpg', // will fail to download
      },
    ];

    const results = await rankCandidateMatches(target, candidates, {
      userSupabase: mockSupabaseFailing,
    });

    assert.equal(results.length, 1);
    const res = results[0];

    // Image evaluation failed, but text and metadata matching succeeded seamlessly!
    assert.equal(res.breakdown.imageEvaluated, false);
    assert.equal(res.breakdown.imageSimilarityPct, null);
    assert.ok(res.score > 60, `Score should still be high based on text & metadata, got ${res.score}`);
    assert.ok(res.breakdown.weightsUsed.image === undefined, 'Image weight must be omitted from effective weights');
  });

  // 5. Model Disabled Fallback
  await asyncTest('rankCandidateMatches gracefully functions when CLIP model is disabled', async () => {
    resetClipState();
    setClipDisabled(true);

    const target = {
      id: 'target-03',
      item_type: 'lost',
      title: 'Gold Ring',
      description: '18k gold band with small diamond',
      category: 'Jewelry',
      color: 'Gold',
      incident_date: '2026-10-18',
      location_description: 'Cafeteria table 5',
      image_path: 'user-1/item-3/ring.jpg',
    };

    const candidates = [
      {
        id: 'cand-03',
        item_type: 'found',
        title: 'Found Gold Ring',
        description: 'Gold band found under cafeteria seat',
        category: 'Jewelry',
        color: 'Gold',
        incident_date: '2026-10-18',
        location_description: 'Cafeteria',
        image_path: 'user-2/item-3/ring.jpg',
      },
    ];

    const mockSupabase = {
      storage: {
        from: () => ({ download: async () => ({ data: new Blob([]) }) }),
      },
    };

    const results = await rankCandidateMatches(target, candidates, {
      userSupabase: mockSupabase,
    });

    assert.equal(results.length, 1);
    assert.equal(results[0].breakdown.imageEvaluated, false);
    assert.ok(results[0].score > 60, 'Text and metadata scoring should remain operational');

    // Re-enable CLIP
    setClipDisabled(false);
  });

  console.log(`\nAll ${passed}/${total} Image Matching Integration tests passed successfully!`);
}

runTests().catch((err) => {
  console.error('\nTest run aborted due to error:', err);
  process.exit(1);
});
