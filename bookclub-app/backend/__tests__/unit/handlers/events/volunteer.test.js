jest.mock('../../../../src/lib/middleware', () => {
  const original = jest.requireActual('../../../../src/lib/middleware');
  return {
    ...original,
    withUser: (handler) => original.withErrorHandler(handler),
  };
});

jest.mock('../../../../src/models/event');
jest.mock('../../../../src/models/bookclub');

const { handler } = require('../../../../src/handlers/events/volunteer');
const Event = require('../../../../src/models/event');
const BookClub = require('../../../../src/models/bookclub');

describe('events.volunteer handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when clubId or eventId is missing', async () => {
    const event = {
      pathParameters: { clubId: 'club-1' },
      userId: 'user-1',
      currentUser: { userId: 'user-1', name: 'Alice' },
    };

    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when club is not found', async () => {
    const event = {
      pathParameters: { clubId: 'club-x', eventId: 'event-1' },
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
      pathParameters: { clubId: 'club-1', eventId: 'event-1' },
      userId: 'user-2',
      currentUser: { userId: 'user-2', name: 'Bob' },
    };

    BookClub.isClubMember.mockResolvedValue(false);
    BookClub.getById.mockResolvedValue({ clubId: 'club-1', createdBy: 'user-1' });

    const res = await handler(event);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error.message).toBe('You must be a member of the club to volunteer');
  });

  it('returns 404 when event is not found', async () => {
    const event = {
      pathParameters: { clubId: 'club-1', eventId: 'event-x' },
      userId: 'user-1',
      currentUser: { userId: 'user-1', name: 'Alice' },
    };

    BookClub.isClubMember.mockResolvedValue(true);
    BookClub.getById.mockResolvedValue({ clubId: 'club-1', createdBy: 'user-1' });
    Event.getById.mockResolvedValue(null);

    const res = await handler(event);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.message).toBe('Event not found');
  });

  it('returns 400 when claiming a task that is not defined in the event', async () => {
    const event = {
      pathParameters: { clubId: 'club-1', eventId: 'event-1' },
      userId: 'user-1',
      currentUser: { userId: 'user-1', name: 'Alice' },
      body: JSON.stringify({
        task: 'Bring coffee', // Not in volunteerTasks
      }),
    };

    BookClub.isClubMember.mockResolvedValue(true);
    BookClub.getById.mockResolvedValue({ clubId: 'club-1', createdBy: 'user-1' });
    Event.getById.mockResolvedValue({
      eventId: 'event-1',
      clubId: 'club-1',
      volunteerTasks: ['Bring cookies'],
    });

    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.errors.message).toBe('The volunteer task "Bring coffee" is not defined for this event');
  });

  it('returns 400 when claiming a task that is already taken by someone else', async () => {
    const event = {
      pathParameters: { clubId: 'club-1', eventId: 'event-1' },
      userId: 'user-1',
      currentUser: { userId: 'user-1', name: 'Alice' },
      body: JSON.stringify({
        task: 'Bring cookies',
      }),
    };

    BookClub.isClubMember.mockResolvedValue(true);
    BookClub.getById.mockResolvedValue({ clubId: 'club-1', createdBy: 'user-1' });
    Event.getById.mockResolvedValue({
      eventId: 'event-1',
      clubId: 'club-1',
      volunteerTasks: ['Bring cookies'],
      volunteers: {
        'user-2': { name: 'Bob', task: 'Bring cookies' },
      },
    });

    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.errors.message).toBe('This volunteer task is already filled');
  });

  it('allows user to claim a task that is defined and free', async () => {
    const event = {
      pathParameters: { clubId: 'club-1', eventId: 'event-1' },
      userId: 'user-1',
      currentUser: { userId: 'user-1', name: 'Alice' },
      body: JSON.stringify({
        task: 'Bring cookies',
      }),
    };

    const mockUpdated = {
      eventId: 'event-1',
      clubId: 'club-1',
      volunteers: {
        'user-1': { name: 'Alice', task: 'Bring cookies' },
      },
    };

    BookClub.isClubMember.mockResolvedValue(true);
    BookClub.getById.mockResolvedValue({ clubId: 'club-1', createdBy: 'user-1' });
    Event.getById.mockResolvedValue({
      eventId: 'event-1',
      clubId: 'club-1',
      volunteerTasks: ['Bring cookies'],
      volunteers: {},
    });
    Event.volunteer.mockResolvedValue(mockUpdated);

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toEqual(mockUpdated);
    expect(Event.volunteer).toHaveBeenCalledWith('event-1', 'user-1', 'Alice', 'Bring cookies');
  });

  it('allows user to release a task by passing null', async () => {
    const event = {
      pathParameters: { clubId: 'club-1', eventId: 'event-1' },
      userId: 'user-1',
      currentUser: { userId: 'user-1', name: 'Alice' },
      body: JSON.stringify({
        task: null,
      }),
    };

    const mockUpdated = {
      eventId: 'event-1',
      clubId: 'club-1',
      volunteers: {},
    };

    BookClub.isClubMember.mockResolvedValue(true);
    BookClub.getById.mockResolvedValue({ clubId: 'club-1', createdBy: 'user-1' });
    Event.getById.mockResolvedValue({
      eventId: 'event-1',
      clubId: 'club-1',
      volunteerTasks: ['Bring cookies'],
      volunteers: {
        'user-1': { name: 'Alice', task: 'Bring cookies' },
      },
    });
    Event.volunteer.mockResolvedValue(mockUpdated);

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toEqual(mockUpdated);
    expect(Event.volunteer).toHaveBeenCalledWith('event-1', 'user-1', 'Alice', null);
  });
});
