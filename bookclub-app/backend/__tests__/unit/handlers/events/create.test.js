jest.mock('../../../../src/lib/middleware', () => {
  const original = jest.requireActual('../../../../src/lib/middleware');
  return {
    ...original,
    withUser: (handler) => original.withErrorHandler(handler),
  };
});

jest.mock('../../../../src/models/event');
jest.mock('../../../../src/models/bookclub');

const { handler } = require('../../../../src/handlers/events/create');
const Event = require('../../../../src/models/event');
const BookClub = require('../../../../src/models/bookclub');

describe('events.create handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when clubId is missing', async () => {
    const event = {
      pathParameters: {},
      userId: 'user-1',
      currentUser: { userId: 'user-1', name: 'Alice' },
    };

    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.errors.message).toBe('Club ID is required');
  });

  it('returns 404 when club is not found', async () => {
    const event = {
      pathParameters: { clubId: 'club-x' },
      userId: 'user-1',
      currentUser: { userId: 'user-1', name: 'Alice' },
    };

    BookClub.isClubMember.mockResolvedValue(false);
    BookClub.getById.mockResolvedValue(null);

    const res = await handler(event);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.message).toBe('Club not found');
  });

  it('returns 403 when user is not a member and not the club creator', async () => {
    const event = {
      pathParameters: { clubId: 'club-1' },
      userId: 'user-2',
      currentUser: { userId: 'user-2', name: 'Bob' },
    };

    BookClub.isClubMember.mockResolvedValue(false);
    BookClub.getById.mockResolvedValue({ clubId: 'club-1', createdBy: 'user-1' });

    const res = await handler(event);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error.message).toBe('You must be a member of the club to create events');
  });

  it('returns 400 when title is missing or invalid', async () => {
    const event = {
      pathParameters: { clubId: 'club-1' },
      userId: 'user-1',
      currentUser: { userId: 'user-1', name: 'Alice' },
      body: JSON.stringify({
        description: 'No title given',
        dateTime: '2026-06-01T18:00:00Z',
      }),
    };

    BookClub.isClubMember.mockResolvedValue(true);
    BookClub.getById.mockResolvedValue({ clubId: 'club-1', createdBy: 'user-1' });

    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.errors.title).toBeDefined();
  });

  it('returns 400 when dateTime is invalid ISO format', async () => {
    const event = {
      pathParameters: { clubId: 'club-1' },
      userId: 'user-1',
      currentUser: { userId: 'user-1', name: 'Alice' },
      body: JSON.stringify({
        title: 'Book club meeting',
        dateTime: 'tomorrow at 5pm',
      }),
    };

    BookClub.isClubMember.mockResolvedValue(true);
    BookClub.getById.mockResolvedValue({ clubId: 'club-1', createdBy: 'user-1' });

    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.errors.dateTime).toBeDefined();
  });

  it('returns 200 and the created event details on success', async () => {
    const event = {
      pathParameters: { clubId: 'club-1' },
      userId: 'user-1',
      currentUser: { userId: 'user-1', name: 'Alice' },
      body: JSON.stringify({
        title: 'Meeting 1',
        description: 'Read first 3 chapters',
        dateTime: '2026-06-01T18:00:00Z',
        volunteerTasks: ['Bring snacks'],
        location: 'Room 202',
      }),
    };

    const mockCreated = {
      eventId: 'e1',
      clubId: 'club-1',
      title: 'Meeting 1',
      description: 'Read first 3 chapters',
      dateTime: '2026-06-01T18:00:00Z',
      volunteerTasks: ['Bring snacks'],
      location: 'Room 202',
      createdBy: 'user-1',
      creatorName: 'Alice',
    };

    BookClub.isClubMember.mockResolvedValue(true);
    BookClub.getById.mockResolvedValue({ clubId: 'club-1', createdBy: 'user-1' });
    Event.create.mockResolvedValue(mockCreated);

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toEqual(mockCreated);
    expect(Event.create).toHaveBeenCalledWith({
      clubId: 'club-1',
      title: 'Meeting 1',
      description: 'Read first 3 chapters',
      dateTime: '2026-06-01T18:00:00Z',
      volunteerTasks: ['Bring snacks'],
      location: 'Room 202',
    }, 'user-1', 'Alice');
  });
});
