import { 
  getEmbeddingPipeline, 
  generateTextEmbedding, 
  cosineSimilarity, 
  computeColorSimilarity, 
  computeDateSimilarity, 
  computeLocationSimilarity, 
  sanitizeLocation, 
  rankCandidateMatches, 
  DEFAULT_WEIGHTS 
} from './aiMatcher.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('--- FIND-AI BACKEND & AI MATCHER TEST SUITE ---');
  console.log('============================================================\n');

  // 1. Color Similarity Tests
  console.log('[Test Group 1] Color Similarity Tests:');
  assert(computeColorSimilarity('Black', 'Matte Black') === 1.0, 'Matching colors return 1.0');
  assert(computeColorSimilarity('Red', 'Blue') < 0.3, 'Distinctly different colors return penalty');
  assert(computeColorSimilarity(null, 'Silver') === 0.5, 'Missing color returns neutral 0.5');
  assert(computeColorSimilarity(null, null) === 0.5, 'Both null colors return neutral 0.5');

  // 2. Date Similarity Tests
  console.log('\n[Test Group 2] Date Proximity & Temporal Logic Tests:');
  const sameDay = computeDateSimilarity('2026-10-15', '2026-10-15', 'lost');
  assert(sameDay > 0.99, 'Same-day incident returns score ~1.0');
  
  const sevenDays = computeDateSimilarity('2026-10-10', '2026-10-17', 'lost');
  assert(sevenDays > 0.5 && sevenDays < 0.7, '7 days apart returns exponential decay (~0.6)');

  const invalidTimeOrder = computeDateSimilarity('2026-10-20', '2026-10-10', 'lost');
  assert(invalidTimeOrder < 0.3, 'Lost after found date by 10 days receives penalty');

  assert(computeDateSimilarity(null, '2026-10-15', 'lost') === 0.5, 'Missing date returns neutral 0.5');

  // 3. Location & Privacy Redaction Tests
  console.log('\n[Test Group 3] Location Overlap & Privacy Redaction:');
  const locOverlap = computeLocationSimilarity('Central Campus Library Floor 3', 'Library 3rd floor quiet zone');
  assert(locOverlap > 0.2, 'Overlapping location tokens generate similarity');

  const locWithPhone = 'Left at desk, call 555-123-4567 for return';
  const redactedLoc = sanitizeLocation(locWithPhone);
  assert(!redactedLoc.includes('555-123-4567'), 'Phone number is sanitized and redacted');
  assert(redactedLoc.includes('[Phone Redacted]'), 'Phone replacement tag is placed');

  const locWithEmail = 'Inquire at security officer: guard@campus.edu';
  const redactedEmail = sanitizeLocation(locWithEmail);
  assert(!redactedEmail.includes('guard@campus.edu'), 'Email address is sanitized and redacted');
  assert(redactedEmail.includes('[Email Redacted]'), 'Email replacement tag is placed');

  // 4. Vector Cosine Similarity Tests
  console.log('\n[Test Group 4] Vector Cosine Similarity:');
  assert(cosineSimilarity([1, 0, 0], [1, 0, 0]) === 1.0, 'Identical vectors return 1.0');
  assert(cosineSimilarity([1, 0, 0], [0, 1, 0]) === 0.0, 'Orthogonal vectors return 0.0');
  assert(cosineSimilarity(null, [1, 0]) === 0, 'Null vector returns 0');

  // 5. Semantic Embedding & Ranking Tests
  console.log('\n[Test Group 5] AI Semantic Matching (all-MiniLM-L6-v2):');
  const targetLostItem = {
    id: 'lost-101',
    user_id: 'user-aaa',
    item_type: 'lost',
    title: 'Sony WH-1000XM5 wireless noise-canceling headphones',
    description: 'Matte black over-ear bluetooth headphones left in the black zippered hard case on 3rd floor study desk.',
    category: 'electronics',
    color: 'Black',
    location_description: 'Central Library 3rd Floor quiet study room',
    incident_date: '2026-10-16',
    status: 'open',
  };

  const candidatePool = [
    {
      id: 'found-201',
      user_id: 'user-bbb',
      item_type: 'found',
      title: 'Dark audio headset with zippered protective pouch',
      description: 'Found a pair of black wireless audio headphones left on the desk near the bookshelves on level 3.',
      category: 'electronics',
      color: 'Black',
      location_description: 'Library level 3 bookshelf area',
      incident_date: '2026-10-16',
      status: 'open',
    },
    {
      id: 'found-202',
      user_id: 'user-ccc',
      item_type: 'found',
      title: 'Brown leather bi-fold wallet',
      description: 'Found brown wallet with student ID and transit card near the campus dining hall.',
      category: 'keys-wallets',
      color: 'Brown',
      location_description: 'Campus Dining Hall south entrance',
      incident_date: '2026-10-14',
      status: 'open',
    },
    {
      id: 'found-203',
      user_id: 'user-ddd',
      item_type: 'found',
      title: 'White USB-C phone charger adapter and cable',
      description: 'Apple style wall charger brick plugged into wall socket.',
      category: 'electronics',
      color: 'White',
      location_description: 'Science Hall room 102',
      incident_date: '2026-10-15',
      status: 'open',
    },
  ];

  const results = await rankCandidateMatches(targetLostItem, candidatePool, DEFAULT_WEIGHTS);

  assert(results.length === 3, 'All candidates are processed and returned');
  assert(results[0].id === 'found-201', 'True semantic match (found-201) ranks #1');
  assert(results[0].score > results[1].score, 'Top semantic candidate score is strictly higher than distractors');
  assert(results[0].score > 70, `Top semantic candidate score is high (${results[0].score}%)`);
  assert(results[0].breakdown.categoryMatch === true, 'Top candidate category matches');
  assert(results[0].breakdown.textSimilarityPct > 65, 'Semantic text similarity is detected (> 65%)');
  assert(typeof results[0].explanation === 'string' && results[0].explanation.length > 0, 'Explanation summary is provided');
  assert(results[0].disclaimer.includes('not constitute verified proof'), 'Safety disclaimer is attached');

  // 6. Edge Case: Empty Candidate List
  console.log('\n[Test Group 6] Empty Candidate Pool & Missing Fields:');
  const emptyResults = await rankCandidateMatches(targetLostItem, []);
  assert(Array.isArray(emptyResults) && emptyResults.length === 0, 'Empty candidate list returns empty array safely');

  // Candidate with missing/null optional fields
  const candidateWithMissingFields = [
    {
      id: 'found-sparse',
      user_id: 'user-eee',
      item_type: 'found',
      title: 'Black headphones',
      description: 'Left on table.',
      category: 'electronics',
      color: null,
      location_description: '',
      incident_date: null,
      status: 'open',
    },
  ];

  const sparseResults = await rankCandidateMatches(targetLostItem, candidateWithMissingFields);
  assert(sparseResults.length === 1, 'Candidate with null color/date/location is handled without errors');
  assert(sparseResults[0].score > 0, 'Sparse candidate still receives a computed score');

  // Summary
  console.log('\n============================================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
