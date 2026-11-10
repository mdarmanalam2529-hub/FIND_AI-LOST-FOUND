import { RawImage } from '@xenova/transformers';

/**
 * Synthetic Benchmark Dataset for FindAI Evaluation.
 * 
 * IMPORTANT DISCLAIMER:
 * This dataset consists 100% of SYNTHETIC examples generated specifically for algorithmic
 * benchmarking, regression testing, and comparing retrieval methods.
 * It contains NO real user reports, NO personal data, NO real locations, and NO private storage URLs.
 * Results measured against this synthetic dataset provide controlled comparative evidence
 * of algorithmic behavior, but DO NOT establish real-world user accuracy in wild environments.
 */

export const DATASET_METADATA = {
  name: 'FindAI Synthetic Lost-and-Found Benchmark v1',
  type: 'synthetic',
  version: '1.0.0',
  description: 'Controlled synthetic lost-and-found report pairs with ground-truth relevance labels',
  categoriesCovered: [
    'Electronics',
    'Bags',
    'Accessories',
    'Keys',
    'Jewelry',
    'Eyewear',
    'Musical Instruments',
  ],
  candidatePoolSize: 16,
  queryCount: 10,
  disclaimer: 'SYNTHETIC BENCHMARK DATASET: Does not contain private user records or real-world evidence.',
};

/**
 * Helper to generate synthetic RawImages for visual benchmark testing
 */
export function createSyntheticImage(r, g, b, size = 48) {
  const data = new Uint8ClampedArray(size * size * 3);
  for (let i = 0; i < data.length; i += 3) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  return new RawImage(data, size, size, 3);
}

// Pre-create synthetic image fixtures
export const SYNTHETIC_IMAGE_STORE = {
  'synthetic-images/blue-bottle-target.jpg': createSyntheticImage(25, 40, 210),
  'synthetic-images/blue-bottle-candidate.jpg': createSyntheticImage(30, 45, 205),
  'synthetic-images/yellow-bottle-distractor.jpg': createSyntheticImage(225, 215, 20),
  'synthetic-images/red-backpack-target.jpg': createSyntheticImage(220, 30, 30),
  'synthetic-images/red-backpack-candidate.jpg': createSyntheticImage(215, 25, 35),
  'synthetic-images/black-backpack-distractor.jpg': createSyntheticImage(20, 20, 25),
};

/**
 * 16 Diverse Candidate Found Reports
 */
export const BENCHMARK_CANDIDATE_POOL = [
  {
    id: 'cand-iphone-01',
    item_type: 'found',
    title: 'Found Apple iPhone smartphone',
    description: 'Black iPhone 14 Pro in black silicone protective case found on study table',
    category: 'Electronics',
    color: 'Black',
    incident_date: '2026-10-15',
    location_description: 'University Library 2nd floor desk',
    image_path: null,
  },
  {
    id: 'cand-samsung-02',
    item_type: 'found',
    title: 'Found Samsung Galaxy phone',
    description: 'Gray Samsung Galaxy Android mobile phone with clear bumper',
    category: 'Electronics',
    color: 'Gray',
    incident_date: '2026-10-14',
    location_description: 'Student Center food court',
    image_path: null,
  },
  {
    id: 'cand-dell-03',
    item_type: 'found',
    title: 'Found Dell XPS laptop',
    description: 'Silver 15 inch Dell laptop with USB-C charger left behind',
    category: 'Electronics',
    color: 'Silver',
    incident_date: '2026-10-16',
    location_description: 'Engineering Building Lab 304',
    image_path: null,
  },
  {
    id: 'cand-lenovo-04',
    item_type: 'found',
    title: 'Found Lenovo ThinkPad',
    description: 'Black matte business notebook computer with red trackpoint',
    category: 'Electronics',
    color: 'Black',
    incident_date: '2026-10-12',
    location_description: 'Science Hall 101',
    image_path: null,
  },
  {
    id: 'cand-airpods-05',
    item_type: 'found',
    title: 'Found Apple AirPods in white pod',
    description: 'Pair of wireless bluetooth earphones inside white charging capsule',
    category: 'Electronics',
    color: 'White',
    incident_date: '2026-10-16',
    location_description: 'Gym treadmill area',
    image_path: null,
  },
  {
    id: 'cand-wallet-06',
    item_type: 'found',
    title: 'Found brown bifold wallet',
    description: 'Men brown leather pocket wallet containing membership cards and receipt',
    category: 'Accessories',
    color: 'Brown',
    incident_date: '2026-10-15',
    location_description: 'Campus cafeteria seating',
    image_path: null,
  },
  {
    id: 'cand-wallet-07',
    item_type: 'found',
    title: 'Found black velcro nylon wallet',
    description: 'Black fabric sports wallet with zippered coin pouch',
    category: 'Accessories',
    color: 'Black',
    incident_date: '2026-10-11',
    location_description: 'Athletic track bleachers',
    image_path: null,
  },
  {
    id: 'cand-bottle-blue-08',
    item_type: 'found',
    title: 'Found blue metal thermal drink bottle',
    description: 'Stainless steel insulated blue HydroFlask with wide mouth straw lid',
    category: 'Accessories',
    color: 'Blue',
    incident_date: '2026-10-17',
    location_description: 'Gym cardio room floor',
    image_path: 'synthetic-images/blue-bottle-candidate.jpg',
  },
  {
    id: 'cand-bottle-yellow-09',
    item_type: 'found',
    title: 'Found yellow plastic water bottle',
    description: 'Bright yellow lightweight squeeze water tumbler',
    category: 'Accessories',
    color: 'Yellow',
    incident_date: '2026-10-13',
    location_description: 'Soccer field bench',
    image_path: 'synthetic-images/yellow-bottle-distractor.jpg',
  },
  {
    id: 'cand-bottle-blue-distractor-16',
    item_type: 'found',
    title: 'Found blue metal thermal drink bottle',
    description: 'Stainless steel insulated blue HydroFlask with wide mouth straw lid',
    category: 'Accessories',
    color: 'Blue',
    incident_date: '2026-10-17',
    location_description: 'Gym cardio room floor',
    image_path: 'synthetic-images/yellow-bottle-distractor.jpg', // Visual distractor with yellow photo
  },
  {
    id: 'cand-keys-10',
    item_type: 'found',
    title: 'Found car key fob with blue carabiner',
    description: 'Honda electronic remote key fob attached to blue aluminum clip',
    category: 'Keys',
    color: 'Black',
    incident_date: '2026-10-17',
    location_description: 'North Parking Lot near row B',
    image_path: null,
  },
  {
    id: 'cand-keys-11',
    item_type: 'found',
    title: 'Found brass house keys',
    description: 'Set of three brass door keys on yellow smiley keychain',
    category: 'Keys',
    color: 'Gold',
    incident_date: '2026-10-10',
    location_description: 'Dormitory entrance foyer',
    image_path: null,
  },
  {
    id: 'cand-backpack-red-12',
    item_type: 'found',
    title: 'Found crimson daypack canvas bag',
    description: 'Red casual school backpack with double zippers and side mesh',
    category: 'Bags',
    color: 'Red',
    incident_date: '2026-10-16',
    location_description: 'Main Quad picnic table',
    image_path: 'synthetic-images/red-backpack-candidate.jpg',
  },
  {
    id: 'cand-backpack-black-13',
    item_type: 'found',
    title: 'Found dark black utility backpack',
    description: 'Waterproof black computer bag with padded shoulder straps',
    category: 'Bags',
    color: 'Black',
    incident_date: '2026-10-14',
    location_description: 'Computer center row 4',
    image_path: 'synthetic-images/black-backpack-distractor.jpg',
  },
  {
    id: 'cand-ring-14',
    item_type: 'found',
    title: 'Found simple gold band ring',
    description: 'Polished yellow gold wedding ring band with subtle interior engraving',
    category: 'Jewelry',
    color: 'Gold',
    incident_date: '2026-10-15',
    location_description: 'Restroom sink counter in student union',
    image_path: null,
  },
  {
    id: 'cand-sunglasses-15',
    item_type: 'found',
    title: 'Found tortoiseshell sunglasses',
    description: 'Classic brown patterned dark shade sunglasses in protective case',
    category: 'Eyewear',
    color: 'Brown',
    incident_date: '2026-10-16',
    location_description: 'Campus bookstore checkout counter',
    image_path: null,
  },
];

/**
 * 10 Evaluated Test Queries with Ground-Truth Relevance Labels
 */
export const BENCHMARK_QUERIES = [
  {
    id: 'query-01-iphone',
    targetItem: {
      id: 'target-iphone',
      item_type: 'lost',
      title: 'Lost Black iPhone 14 Pro Max',
      description: 'Lost my black Apple iPhone with protective case during afternoon study session',
      category: 'Electronics',
      color: 'Black',
      incident_date: '2026-10-15',
      location_description: 'Library 2nd floor silent area',
      image_path: null,
    },
    relevantCandidateIds: ['cand-iphone-01'],
    hasImageFixture: false,
    description: 'Exact semantic match for iPhone phone',
  },
  {
    id: 'query-02-dell-laptop',
    targetItem: {
      id: 'target-dell',
      item_type: 'lost',
      title: 'Lost Silver Dell XPS 15 inch Laptop',
      description: 'Silver aluminum Dell XPS laptop computer left behind after class',
      category: 'Electronics',
      color: 'Silver',
      incident_date: '2026-10-16',
      location_description: 'Engineering Building Room 304',
      image_path: null,
    },
    relevantCandidateIds: ['cand-dell-03'],
    hasImageFixture: false,
    description: 'Exact match for Dell XPS notebook',
  },
  {
    id: 'query-03-airpods-synonym',
    targetItem: {
      id: 'target-airpods',
      item_type: 'lost',
      title: 'Lost cordless hearing buds in dock',
      description: 'Pair of personal cordless earpieces misplaced during fitness workout',
      category: 'Electronics',
      color: 'White',
      incident_date: '2026-10-16',
      location_description: 'Gym fitness center',
      image_path: null,
    },
    relevantCandidateIds: ['cand-airpods-05'],
    hasImageFixture: false,
    description: 'Vocabulary mismatch challenge: "cordless hearing buds in dock" vs "AirPods earphones in pod"',
  },
  {
    id: 'query-04-wallet',
    targetItem: {
      id: 'target-wallet',
      item_type: 'lost',
      title: 'Lost Men Brown Leather Bifold Wallet',
      description: 'Brown leather wallet with driver license and student cards',
      category: 'Accessories',
      color: 'Brown',
      incident_date: '2026-10-15',
      location_description: 'Cafeteria lunchtime tables',
      image_path: null,
    },
    relevantCandidateIds: ['cand-wallet-06'],
    hasImageFixture: false,
    description: 'Matching brown leather wallet vs black nylon wallet distractor',
  },
  {
    id: 'query-05-car-keys',
    targetItem: {
      id: 'target-keys',
      item_type: 'lost',
      title: 'Lost Honda car key on blue carabiner clip',
      description: 'Keyless entry Honda vehicle key fob with blue metal carabiner hook',
      category: 'Keys',
      color: 'Black',
      incident_date: '2026-10-17',
      location_description: 'North Parking Lot',
      image_path: null,
    },
    relevantCandidateIds: ['cand-keys-10'],
    hasImageFixture: false,
    description: 'Vehicle key fob with carabiner color match',
  },
  {
    id: 'query-06-gold-ring',
    targetItem: {
      id: 'target-ring',
      item_type: 'lost',
      title: 'Lost Gold Wedding Ring Band',
      description: 'Engraved yellow gold wedding band misplaced when washing hands',
      category: 'Jewelry',
      color: 'Gold',
      incident_date: '2026-10-15',
      location_description: 'Student union restroom sink area',
      image_path: null,
    },
    relevantCandidateIds: ['cand-ring-14'],
    hasImageFixture: false,
    description: 'Gold wedding band with location overlap',
  },
  {
    id: 'query-07-sunglasses',
    targetItem: {
      id: 'target-sunglasses',
      item_type: 'lost',
      title: 'Lost Brown Tortoiseshell Sunglasses',
      description: 'Prescription dark sunglasses with tortoiseshell brown frame in hard case',
      category: 'Eyewear',
      color: 'Brown',
      incident_date: '2026-10-16',
      location_description: 'Bookstore register',
      image_path: null,
    },
    relevantCandidateIds: ['cand-sunglasses-15'],
    hasImageFixture: false,
    description: 'Eyewear category match with tortoiseshell color overlap',
  },
  {
    id: 'query-08-hydroflask-with-photo',
    targetItem: {
      id: 'target-bottle',
      item_type: 'lost',
      title: 'Lost Blue HydroFlask Water Bottle',
      description: 'Blue insulated water bottle flask left on gym floor with attached photo',
      category: 'Accessories',
      color: 'Blue',
      incident_date: '2026-10-17',
      location_description: 'Gym workout room',
      image_path: 'synthetic-images/blue-bottle-target.jpg',
    },
    relevantCandidateIds: ['cand-bottle-blue-08'],
    hasImageFixture: true,
    description: 'Visual matching query: matching blue photo vs text-identical yellow photo distractor',
  },
  {
    id: 'query-09-red-backpack-with-photo',
    targetItem: {
      id: 'target-backpack',
      item_type: 'lost',
      title: 'Lost Red Canvas School Backpack',
      description: 'Bright red daypack bookbag lost outside on picnic bench',
      category: 'Bags',
      color: 'Red',
      incident_date: '2026-10-16',
      location_description: 'Main Quad lawn',
      image_path: 'synthetic-images/red-backpack-target.jpg',
    },
    relevantCandidateIds: ['cand-backpack-red-12'],
    hasImageFixture: true,
    description: 'Visual matching query: red backpack photo vs black backpack photo distractor',
  },
  {
    id: 'query-10-zero-match-negative',
    targetItem: {
      id: 'target-ukulele',
      item_type: 'lost',
      title: 'Lost Purple Soprano Ukulele in Floral Gig Bag',
      description: 'Small four-string purple wooden ukulele instrument with custom painted flowers',
      category: 'Musical Instruments',
      color: 'Purple',
      incident_date: '2026-10-18',
      location_description: 'Music department auditorium stage',
      image_path: null,
    },
    relevantCandidateIds: [], // True negative test: NO relevant candidates in candidate pool!
    hasImageFixture: false,
    description: 'Zero-relevant negative query to test false positive resistance and edge-case handling',
  },
];
