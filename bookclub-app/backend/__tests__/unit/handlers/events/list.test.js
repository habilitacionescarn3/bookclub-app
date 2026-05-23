jest.mock('../../../../src/lib/middleware', () => ({
  withUser: (handler) => handler,
}));

jest.mock('../../../../src/models/event');
jest.mock('../../../../src/models/bookclub');

const { handler } = require('../../../../src/handlers/events/list');
const Event = require('../../../../src/models/event');
const BookClub = require('../../../../src/models/bookclub');

describe('events.list handler', () => {
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
    expect(JSON.parse(res.body)).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: {
          message: 'Club ID is required',
        },
      },
    });
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
    expect(JSON.parse(res.body).error.message).toBe('You must be a member of the club to view events');
  });

  it('returns 200 and list of events when user is a member', async () => {
    const event = {
      pathParameters: { clubId: 'club-1' },
      userId: 'user-2',
      currentUser: { userId: 'user-2', name: 'Bob' },
    };

    const mockEvents = [
      { eventId: 'e1', title: 'Event 1', dateTime: '2026-06-01T18:00:00Z' },
      { eventId: 'e2', title: 'Event 2', dateTime: '2026-06-15T18:00:00Z' },
    ];

    BookClub.isClubMember.mockResolvedValue(true);
    BookClub.getById.mockResolvedValue({ clubId: 'club-1', createdBy: 'user-1' });
    Event.listByClub.mockResolvedValue(mockEvents);

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toEqual(mockEvents);
    expect(Event.listByClub).toHaveBeenCalledWith('club-1');
  });

  it('returns 200 and list of events when user is not a member but is the creator', async () => {
    const event = {
      pathParameters: { clubId: 'club-1' },
      userId: 'user-1',
      currentUser: { userId: 'user-1', name: 'Alice' },
    };

    const mockEvents = [
      { eventId: 'e1', title: 'Event 1', dateTime: '2026-06-01T18:00:00Z' },
    ];

    BookClub.isClubMember.mockResolvedValue(false);
    BookClub.getById.mockResolvedValue({ clubId: 'club-1', createdBy: 'user-1' });
    Event.listByClub.mockResolvedValue(mockEvents);

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toEqual(mockEvents);
  });
});
