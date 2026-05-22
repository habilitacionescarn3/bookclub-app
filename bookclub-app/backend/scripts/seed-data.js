const LocalStorage = require('../src/lib/local-storage');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * Seed script to populate local development environment with test data
 * This creates sample users and books for testing
 */

/**
 * Simple password hashing for development seed data
 * Using SHA-256 with salt for better security than plain text
 * Note: In production, use bcrypt or similar proper password hashing libraries
 */
function hashPassword(password) {
  const salt = 'dev-seed-salt'; // Fixed salt for consistent development data (generic, not year-specific)
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

const SAMPLE_USERS = [
  {
    userId: 'user-1',
    email: 'alice@example.com',
    name: 'Alice Johnson',
    password: 'password123', // Plain password for development
    createdAt: new Date().toISOString()
  },
  {
    userId: 'user-2',
    email: 'bob@example.com',
    name: 'Bob Smith',
    password: 'password123', // Plain password for development
    createdAt: new Date().toISOString()
  },
  {
    userId: 'user-3',
    email: 'carol@example.com',
    name: 'Carol Davis',
    password: 'password123', // Plain password for development
    createdAt: new Date().toISOString()
  }
];

const SAMPLE_CLUBS = [
  {
    clubId: 'club-fiction-001',
    name: 'Fiction Lovers',
    slug: 'fiction-lovers',
    description: 'A club for people who love reading fiction.',
    location: 'New York, NY',
    createdBy: 'user-1',
    inviteCode: 'FICT1234',
    isPrivate: false,
    memberLimit: 50,
    memberCount: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    clubId: 'club-scifi-002',
    name: 'Sci-Fi Enthusiasts',
    slug: 'sci-fi-enthusiasts',
    description: 'Exploring the universe through science fiction.',
    location: 'San Francisco, CA',
    createdBy: 'user-2',
    inviteCode: 'SCFI1234',
    isPrivate: false,
    memberLimit: 20,
    memberCount: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const SAMPLE_MEMBERSHIPS = [
  { clubId: 'club-fiction-001', userId: 'user-1', role: 'admin', status: 'active', joinedAt: new Date().toISOString() },
  { clubId: 'club-fiction-001', userId: 'user-2', role: 'member', status: 'active', joinedAt: new Date().toISOString() },
  { clubId: 'club-fiction-001', userId: 'user-3', role: 'member', status: 'active', joinedAt: new Date().toISOString() },
  { clubId: 'club-scifi-002', userId: 'user-2', role: 'admin', status: 'active', joinedAt: new Date().toISOString() },
  { clubId: 'club-scifi-002', userId: 'user-3', role: 'member', status: 'active', joinedAt: new Date().toISOString() },
  
  // Explicitly add 'local-user' to clubs so the default local login can see the gated items
  { clubId: 'club-fiction-001', userId: 'local-user', role: 'admin', status: 'active', joinedAt: new Date().toISOString() },
  { clubId: 'club-scifi-002', userId: 'local-user', role: 'member', status: 'active', joinedAt: new Date().toISOString() }
];

const SAMPLE_BOOKS = [
  {
    bookId: uuidv4(),
    userId: 'user-1',
    title: 'The Pragmatic Programmer',
    author: 'David Thomas, Andrew Hunt',
    category: 'book',
    clubId: null, // Global item
    description: 'A classic book on software craftsmanship.',
    status: 'available',
    createdAt: new Date().toISOString()
  },
  {
    bookId: uuidv4(),
    userId: 'local-user',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    category: 'book',
    clubId: 'club-fiction-001',
    description: 'A classic American novel set in the Jazz Age.',
    status: 'available',
    createdAt: new Date().toISOString()
  },
  {
    bookId: uuidv4(),
    userId: 'local-user',
    title: 'To Kill a Mockingbird',
    author: 'Harper Lee',
    category: 'book',
    clubId: 'club-fiction-001',
    description: 'A gripping tale of racial injustice.',
    status: 'available',
    createdAt: new Date().toISOString()
  },
  {
    bookId: uuidv4(),
    userId: 'user-2',
    title: 'Dune',

    author: 'Frank Herbert',
    category: 'book',
    clubId: 'club-scifi-002',
    description: 'Epic science fiction novel.',
    status: 'available',
    createdAt: new Date().toISOString()
  },
  {
    bookId: uuidv4(),
    userId: 'user-2',
    title: 'LEGO Star Wars X-Wing',
    category: 'toy',
    clubId: 'club-scifi-002',
    description: 'Building set for Star Wars fans.',
    status: 'available',
    createdAt: new Date().toISOString()
  },
  {
    bookId: uuidv4(),
    userId: 'user-3',
    title: 'Cordless Power Drill',
    category: 'tool',
    clubId: 'club-fiction-001',
    description: 'High performance 18V drill.',
    status: 'available',
    createdAt: new Date().toISOString()
  },
  {
    bookId: uuidv4(),
    userId: 'user-2',
    title: 'Settlers of Catan',
    category: 'game',
    clubId: 'club-scifi-002',
    description: 'The classic board game.',
    status: 'available',
    createdAt: new Date().toISOString()
  },
  {
    bookId: uuidv4(),
    userId: 'user-1',
    title: 'Professional Tripod',
    category: 'other',
    clubId: 'club-fiction-001',
    description: 'Sturdy aluminum tripod.',
    status: 'available',
    createdAt: new Date().toISOString()
  }
];

const SAMPLE_LOST_FOUND_ITEMS = [
  {
    lostFoundId: uuidv4(),
    reporterId: 'user-3',
    title: 'Found Keys at Park',
    type: 'found',
    clubId: 'club-fiction-001',
    description: 'Found a set of keys near the swing set.',
    status: 'active',
    createdAt: new Date().toISOString()
  },
  {
    lostFoundId: uuidv4(),
    reporterId: 'user-1',
    title: 'Lost Golden Retriever',
    type: 'lost',
    clubId: 'club-fiction-001',
    description: 'Missing dog answers to Buddy. Has a blue collar.',
    status: 'active',
    createdAt: new Date().toISOString()
  }
];

const SAMPLE_EVENTS = [
  {
    eventId: 'event-fiction-1',
    clubId: 'club-fiction-001',
    title: 'The Great Gatsby Discussion',
    description: 'We will discuss the first 3 chapters of The Great Gatsby. Please bring your notes!',
    location: 'Fiction Lovers Hub, Room 12',
    dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
    createdBy: 'user-1',
    creatorName: 'Alice Johnson',
    volunteerTasks: ['Bring snacks', 'Prepare questions', 'Tidy up'],
    volunteers: {
      'user-2': {
        name: 'Bob Smith',
        task: 'Bring snacks',
        signedUpAt: new Date().toISOString()
      }
    },
    rsvps: {
      'user-1': {
        name: 'Alice Johnson',
        status: 'yes',
        updatedAt: new Date().toISOString()
      },
      'user-2': {
        name: 'Bob Smith',
        status: 'yes',
        updatedAt: new Date().toISOString()
      },
      'user-3': {
        name: 'Carol Davis',
        status: 'maybe',
        updatedAt: new Date().toISOString()
      }
    },
    discussions: [
      {
        commentId: 'comment-1',
        userId: 'user-2',
        name: 'Bob Smith',
        content: 'I will buy some chocolate chip cookies and chips.',
        createdAt: new Date().toISOString()
      },
      {
        commentId: 'comment-2',
        userId: 'user-1',
        name: 'Alice Johnson',
        content: 'Sounds perfect, thanks Bob!',
        createdAt: new Date().toISOString()
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    eventId: 'event-fiction-2',
    clubId: 'club-fiction-001',
    title: 'To Kill a Mockingbird Discussion',
    description: 'A deep dive into the themes of justice and prejudice in Harper Lee\'s masterpiece.',
    location: 'Community Center Room 102',
    dateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    createdBy: 'user-1',
    creatorName: 'Alice Johnson',
    volunteerTasks: ['Bring drinks', 'Take minutes'],
    volunteers: {},
    rsvps: {
      'user-1': { name: 'Alice Johnson', status: 'yes', updatedAt: new Date().toISOString() }
    },
    discussions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    eventId: 'event-fiction-3',
    clubId: 'club-fiction-001',
    title: 'Fiction Lovers Summer Picnic',
    description: 'Outdoor social gathering. Bring your favorite summer read to discuss in the sunshine!',
    location: 'Central Park Lawn East',
    dateTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
    createdBy: 'user-1',
    creatorName: 'Alice Johnson',
    volunteerTasks: ['Bring blankets', 'Bring lemonade', 'Setup lawn games'],
    volunteers: {},
    rsvps: {},
    discussions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    eventId: 'event-fiction-4',
    clubId: 'club-fiction-001',
    title: 'Fiction Lovers Introductory Meeting',
    description: 'Welcoming new members, going over expectations, and voting on the book of the month.',
    location: 'Fiction Lovers Online Zoom',
    dateTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    createdBy: 'user-1',
    creatorName: 'Alice Johnson',
    volunteerTasks: [],
    volunteers: {},
    rsvps: {},
    discussions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    eventId: 'event-scifi-1',
    clubId: 'club-scifi-002',
    title: 'Dune Movie & Book Comparison Night',
    description: 'A friendly debate comparing the Frank Herbert classic book to the Villeneuve film adaptation.',
    location: 'Bob\'s Home Theater Room',
    dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
    createdBy: 'user-2',
    creatorName: 'Bob Smith',
    volunteerTasks: ['Host venue', 'Bring popcorn', 'Setup projector'],
    volunteers: {
      'user-3': {
        name: 'Carol Davis',
        task: 'Bring popcorn',
        signedUpAt: new Date().toISOString()
      }
    },
    rsvps: {
      'user-2': {
        name: 'Bob Smith',
        status: 'yes',
        updatedAt: new Date().toISOString()
      },
      'user-3': {
        name: 'Carol Davis',
        status: 'yes',
        updatedAt: new Date().toISOString()
      }
    },
    discussions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    eventId: 'event-scifi-2',
    clubId: 'club-scifi-002',
    title: 'Foundation Series Book Discussion',
    description: 'Discussing the psychological and political impacts of psychohistory in Isaac Asimov\'s universe.',
    location: 'Science Museum Planetarium',
    dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    createdBy: 'user-2',
    creatorName: 'Bob Smith',
    volunteerTasks: ['Prepare discussion guide'],
    volunteers: {},
    rsvps: {
      'user-2': { name: 'Bob Smith', status: 'yes', updatedAt: new Date().toISOString() }
    },
    discussions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    eventId: 'event-scifi-3',
    clubId: 'club-scifi-002',
    title: 'Neuromancer Cyberspace Chat',
    description: 'Analyzing William Gibson\'s vision of the matrix, artificial intelligence, and cyberpunk tropes.',
    location: 'Metropolis Cyber Cafe',
    dateTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now
    createdBy: 'user-2',
    creatorName: 'Bob Smith',
    volunteerTasks: ['Buy cyber caffeine shots'],
    volunteers: {},
    rsvps: {},
    discussions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    eventId: 'event-fiction-5',
    clubId: 'club-fiction-001',
    title: 'Fiction Writing Craft & Character Development',
    description: 'Bring a short writing piece (up to 500 words) focusing on character development. We will read them aloud and share constructive feedback.',
    location: 'The Cozy Nook Bookstore Cafe',
    dateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days from now
    createdBy: 'user-1',
    creatorName: 'Alice Johnson',
    volunteerTasks: ['Provide printouts', 'Bring name tags'],
    volunteers: {},
    rsvps: {
      'user-1': { name: 'Alice Johnson', status: 'yes', updatedAt: new Date().toISOString() },
      'user-3': { name: 'Carol Davis', status: 'maybe', updatedAt: new Date().toISOString() }
    },
    discussions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    eventId: 'event-fiction-6',
    clubId: 'club-fiction-001',
    title: 'Classic Novels & Literary Trivia Night',
    description: 'Form teams of up to 4 and test your knowledge of 19th and 20th-century literature. Prizes for the winning team!',
    location: 'The Hemingway Tavern, Back Room',
    dateTime: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(), // 9 days from now
    createdBy: 'user-3',
    creatorName: 'Carol Davis',
    volunteerTasks: ['Keep score', 'Set up sound system'],
    volunteers: {},
    rsvps: {
      'user-3': { name: 'Carol Davis', status: 'yes', updatedAt: new Date().toISOString() },
      'user-2': { name: 'Bob Smith', status: 'yes', updatedAt: new Date().toISOString() }
    },
    discussions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    eventId: 'event-fiction-7',
    clubId: 'club-fiction-001',
    title: 'Book Swap & Afternoon Tea',
    description: 'Bring up to 3 books you\'ve already read and swap them with fellow book lovers while enjoying premium English breakfast tea and scones.',
    location: 'St. James Tea Garden',
    dateTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
    createdBy: 'user-1',
    creatorName: 'Alice Johnson',
    volunteerTasks: ['Bring tablecloths', 'Help organize books by genre'],
    volunteers: {},
    rsvps: {
      'user-1': { name: 'Alice Johnson', status: 'yes', updatedAt: new Date().toISOString() },
      'user-2': { name: 'Bob Smith', status: 'maybe', updatedAt: new Date().toISOString() }
    },
    discussions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    eventId: 'event-scifi-4',
    clubId: 'club-scifi-002',
    title: 'Hyperion Cantos Deep Dive: The Shrike Legend',
    description: 'Discussing Dan Simmons\' masterpiece. We will debate the true nature of the Shrike and the Pilgrims\' motivations.',
    location: 'Nebula Lounge & Observatory',
    dateTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days from now
    createdBy: 'user-2',
    creatorName: 'Bob Smith',
    volunteerTasks: ['Prepare discussion prompts', 'Bring interstellar snacks'],
    volunteers: {},
    rsvps: {
      'user-2': { name: 'Bob Smith', status: 'yes', updatedAt: new Date().toISOString() },
      'user-3': { name: 'Carol Davis', status: 'yes', updatedAt: new Date().toISOString() }
    },
    discussions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    eventId: 'event-scifi-5',
    clubId: 'club-scifi-002',
    title: 'Space Opera Writing Circle',
    description: 'A workshop for budding sci-fi authors. Share your world-building ideas, starship designs, and alien languages!',
    location: 'Sci-Fi Enthusiasts Online Jitsi',
    dateTime: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(), // 12 days from now
    createdBy: 'user-2',
    creatorName: 'Bob Smith',
    volunteerTasks: ['Moderate virtual meeting queue'],
    volunteers: {},
    rsvps: {
      'user-2': { name: 'Bob Smith', status: 'yes', updatedAt: new Date().toISOString() }
    },
    discussions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    eventId: 'event-scifi-6',
    clubId: 'club-scifi-002',
    title: 'Blade Runner (1982) Film Screening & Panel',
    description: 'Watch the Final Cut of Blade Runner, followed by a panel discussion on cyberpunk aesthetics, artificial consciousness, and Vangelis\' soundtrack.',
    location: 'Retro Cinema 4K, Screen 3',
    dateTime: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days from now
    createdBy: 'user-3',
    creatorName: 'Carol Davis',
    volunteerTasks: ['Operate projector', 'Hand out tickets'],
    volunteers: {},
    rsvps: {
      'user-3': { name: 'Carol Davis', status: 'yes', updatedAt: new Date().toISOString() },
      'user-2': { name: 'Bob Smith', status: 'maybe', updatedAt: new Date().toISOString() }
    },
    discussions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];


async function seedData() {
  console.log('🌱 Seeding development data...');
  
  try {
    // Seed users
    console.log('Creating sample users...');
    for (const user of SAMPLE_USERS) {
      await LocalStorage.createUser(user);
    }
    
    // Seed clubs
    console.log('Creating sample clubs...');
    for (const club of SAMPLE_CLUBS) {
      await LocalStorage.createClub(club);
    }
    
    // Seed memberships
    console.log('Creating sample memberships...');
    for (const membership of SAMPLE_MEMBERSHIPS) {
      await LocalStorage.createClubMember(membership);
    }
    
    // Seed items
    console.log('Creating sample items...');
    for (const book of SAMPLE_BOOKS) {
      await LocalStorage.createBook(book);
    }
    
    // Seed lost and found
    console.log('Creating sample lost & found items...');
    for (const item of SAMPLE_LOST_FOUND_ITEMS) {
      await LocalStorage.createLostFoundItem(item);
    }

    // Seed events
    console.log('Creating sample events...');
    for (const event of SAMPLE_EVENTS) {
      await LocalStorage.createEvent(event);
    }
    
    console.log('\n🎉 Sample data seeded successfully!');
    console.log('Available items: Books, Toys, Tools, Games, Other');
    console.log('Available lost & found: Keys, Dog');
    console.log('Available clubs: Fiction Lovers, Sci-Fi Enthusiasts');
    console.log(`Available events: ${SAMPLE_EVENTS.map(e => e.title).join(', ')}`);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedData();
}

module.exports = { seedData, SAMPLE_USERS, SAMPLE_BOOKS };