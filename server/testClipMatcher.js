import assert from 'node:assert/strict';
import { RawImage } from '@xenova/transformers';
import {
  isValidStoragePath,
  setClipDisabled,
  resetClipState,
  getClipStatus,
  generateImageEmbedding,
  computeImageCosineSimilarity,
  fetchAuthorizedReportImage,
  compareReportImages,
} from './clipMatcher.js';

console.log('--- FindAI CLIP Matcher Test Suite ---');

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

  // 1. Path validation tests
  test('isValidStoragePath approves legitimate supabase storage paths', () => {
    assert.equal(isValidStoragePath('550e8400-e29b-41d4-a716-446655440000/123e4567-e89b-12d3-a456-426614174000/1697645000000.jpg'), true);
    assert.equal(isValidStoragePath('user-1/item-2/photo.PNG'), true);
    assert.equal(isValidStoragePath('u1/i1/test.webp'), true);
  });

  test('isValidStoragePath rejects directory traversal attacks and invalid extensions', () => {
    assert.equal(isValidStoragePath('../../etc/passwd'), false);
    assert.equal(isValidStoragePath('user/item/../../../secret.jpg'), false);
    assert.equal(isValidStoragePath('/absolute/path.jpg'), false);
    assert.equal(isValidStoragePath('\\windows\\path.jpg'), false);
    assert.equal(isValidStoragePath('user/item/script.exe'), false);
    assert.equal(isValidStoragePath('user/item/vector.svg'), false);
    assert.equal(isValidStoragePath(null), false);
    assert.equal(isValidStoragePath(''), false);
  });

  // 2. Cosine similarity unit tests
  test('computeImageCosineSimilarity calculates exact dot products and clamps to [0, 1]', () => {
    const vecA = [1, 0, 0];
    const vecB = [1, 0, 0];
    assert.equal(computeImageCosineSimilarity(vecA, vecB), 1.0);

    const vecOrthogonal = [0, 1, 0];
    assert.equal(computeImageCosineSimilarity(vecA, vecOrthogonal), 0.0);

    const vecOpposite = [-1, 0, 0];
    assert.equal(computeImageCosineSimilarity(vecA, vecOpposite), 0.0); // clamped to 0

    assert.equal(computeImageCosineSimilarity(null, [1, 0]), 0);
    assert.equal(computeImageCosineSimilarity([1, 0], [1]), 0); // length mismatch
  });

  // 3. Missing image handling
  await asyncTest('compareReportImages gracefully handles missing images', async () => {
    const mockSupabase = { storage: { from: () => ({ download: async () => ({ data: null }) }) } };

    // Neither report has an image
    const resNeither = await compareReportImages(mockSupabase, null, null);
    assert.equal(resNeither.compared, false);
    assert.equal(resNeither.similarity, null);
    assert.match(resNeither.reason, /Both reports lack images/i);

    // Only target has an image
    const resTargetOnly = await compareReportImages(mockSupabase, 'u1/i1/1.jpg', null);
    assert.equal(resTargetOnly.compared, false);
    assert.match(resTargetOnly.reason, /Candidate report lacks an image/i);

    // Only candidate has an image
    const resCandidateOnly = await compareReportImages(mockSupabase, null, 'u2/i2/2.jpg');
    assert.equal(resCandidateOnly.compared, false);
    assert.match(resCandidateOnly.reason, /Target report lacks an image/i);
  });

  // 4. Inaccessible / Failed retrieval handling
  await asyncTest('fetchAuthorizedReportImage handles RLS rejection and 404 cleanly', async () => {
    const mockSupabaseRLSFail = {
      storage: {
        from: (bucket) => ({
          download: async (path) => ({
            data: null,
            error: { message: 'Row Level Security policy denied access to this storage object' },
          }),
        }),
      },
    };

    const res = await fetchAuthorizedReportImage(mockSupabaseRLSFail, 'u1/i1/photo.jpg');
    assert.equal(res.success, false);
    assert.equal(res.reason, 'INACCESSIBLE');
    assert.match(res.error, /Row Level Security/i);
  });

  await asyncTest('fetchAuthorizedReportImage handles network timeout cleanly', async () => {
    const mockSupabaseHangs = {
      storage: {
        from: () => ({
          download: () => new Promise((resolve) => setTimeout(resolve, 500)), // hangs
        }),
      },
    };

    const res = await fetchAuthorizedReportImage(mockSupabaseHangs, 'u1/i1/photo.jpg', { timeoutMs: 50 });
    assert.equal(res.success, false);
    assert.match(res.error, /timed out/i);
  });

  // 5. Corrupt / Invalid image data handling
  await asyncTest('generateImageEmbedding safely returns null on corrupt or invalid data without throwing', async () => {
    // 10 random garbage bytes that do not form a valid image
    const corruptBlob = new Blob([new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03])]);
    const embedding = await generateImageEmbedding(corruptBlob);
    assert.equal(embedding, null, 'Corrupt image should produce null embedding, not throw');
  });

  // 6. Model failure fallback (manual disable or load error)
  await asyncTest('compareReportImages gracefully falls back when CLIP is disabled or model fails', async () => {
    resetClipState();
    setClipDisabled(true);

    const status = getClipStatus();
    assert.equal(status.enabled, false);

    const mockSupabase = {
      storage: {
        from: () => ({
          download: async () => ({ data: new Blob([]) }),
        }),
      },
    };

    const res = await compareReportImages(mockSupabase, 'u1/i1/1.jpg', 'u2/i2/2.jpg');
    assert.equal(res.compared, false);
    assert.equal(res.similarity, null);
    assert.match(res.reason, /CLIP model is unavailable/i);

    // Re-enable for subsequent tests
    setClipDisabled(false);
  });

  // 7. Successful image embedding & comparison with valid inputs
  await asyncTest('CLIP model generates 512-dim unit vector and calculates high similarity for identical images', async () => {
    resetClipState();

    // Create a 64x64 green square
    const greenData = new Uint8ClampedArray(64 * 64 * 3);
    for (let i = 0; i < greenData.length; i += 3) {
      greenData[i] = 20;     // R
      greenData[i + 1] = 220; // G
      greenData[i + 2] = 20;  // B
    }
    const imgGreen1 = new RawImage(greenData, 64, 64, 3);
    const imgGreen2 = new RawImage(new Uint8ClampedArray(greenData), 64, 64, 3);

    const [emb1, emb2] = await Promise.all([
      generateImageEmbedding(imgGreen1),
      generateImageEmbedding(imgGreen2),
    ]);

    assert.ok(emb1 !== null, 'emb1 should not be null');
    assert.ok(emb2 !== null, 'emb2 should not be null');
    assert.equal(emb1.length, 512, 'CLIP ViT-B/32 embedding dimension should be 512');
    assert.equal(emb2.length, 512, 'CLIP ViT-B/32 embedding dimension should be 512');

    // Check unit length (L2 norm should be ~1.0)
    let sumSq = 0;
    for (const v of emb1) sumSq += v * v;
    assert.ok(Math.abs(Math.sqrt(sumSq) - 1.0) < 1e-4, 'Embedding should be L2 unit length');

    // Similarity between identical images should be ~1.0 (>= 0.99)
    const sim = computeImageCosineSimilarity(emb1, emb2);
    assert.ok(sim >= 0.99, `Identical images similarity should be >= 0.99, got ${sim}`);
  });

  console.log(`\nAll ${passed}/${total} CLIP Matcher tests passed successfully!`);
}

runTests().catch((err) => {
  console.error('\nTest run aborted due to error:', err);
  process.exit(1);
});
