jest.mock('../../../../src/lib/middleware', () => {
  const original = jest.requireActual('../../../../src/lib/middleware');
  return {
    ...original,
    withUser: (handler) => original.withErrorHandler(handler),
  };
});

jest.mock('../../../../src/models/event');
jest.mock('../../../../src/models/bookclub');
jest.mock('../../../../src/models/user');
jest.mock('../../../../src/lib/notification-service');

const { handler } = require('../../../../src/handlers/events/remind');
const Event = require('../../../../src/models/event');
const BookClub = require('../../../../src/models/bookclub');
const notificationService = require('../../../../src/lib/notification-service');

describe('events.remind handler', () => {
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

    BookClub.getById.mockResolvedValue(null);

    const res = await handler(event);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.message).toBe('Club not found');
  });

  it('returns 404 when event is not found', async () => {
    const event = {
      pathParameters: { clubId: 'club-1', eventId: 'event-x' },
      userId: 'user-1',
      currentUser: { userId: 'user-1', name: 'Alice' },
    };

    BookClub.getById.mockResolvedValue({ clubId: 'club-1', createdBy: 'user-admin' });
    Event.getById.mockResolvedValue(null);

    const res = await handler(event);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.message).toBe('Event not found');
  });

  it('returns 404 when event clubId does not match path clubId', async () => {
    const event = {
      pathParameters: { clubId: 'club-1', eventId: 'event-1' },
      userId: 'user-1',
      currentUser: { userId: 'user-1', name: 'Alice' },
    };

    BookClub.getById.mockResolvedValue({ clubId: 'club-1', createdBy: 'user-admin' });
    Event.getById.mockResolvedValue({ eventId: 'event-1', clubId: 'club-different' });

    const res = await handler(event);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.message).toBe('Event not found');
  });

  it('returns 403 when user is not event creator, club creator, or club admin', async () => {
    const event = {
      pathParameters: { clubId: 'club-1', eventId: 'event-1' },
      userId: 'user-3',
      currentUser: { userId: 'user-3', name: 'Charlie' },
    };

    BookClub.getById.mockResolvedValue({ clubId: 'club-1', createdBy: 'user-admin' });
    Event.getById.mockResolvedValue({ eventId: 'event-1', clubId: 'club-1', createdBy: 'user-creator' });
    BookClub.getMemberRecord.mockResolvedValue({ role: 'member', status: 'active' });

    const res = await handler(event);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error.message).toBe('Only the event creator or club administrators can send reminders');
  });

  it('returns 200 and sentCount: 0 when there are no participants to remind', async () => {
    const event = {
      pathParameters: { clubId: 'club-1', eventId: 'event-1' },
      userId: 'user-creator',
      currentUser: { userId: 'user-creator', name: 'Alice' },
    };

    BookClub.getById.mockResolvedValue({ clubId: 'club-1', createdBy: 'user-admin' });
    Event.getById.mockResolvedValue({
      eventId: 'event-1',
      clubId: 'club-1',
      createdBy: 'user-creator',
      rsvps: {},
    });
    BookClub.getMemberRecord.mockResolvedValue({ role: 'member', status: 'active' });

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.sentCount).toBe(0);
    expect(body.data.message).toBe('No participants to remind');
  });

  it('sends reminders and returns 200 on success when user is the event creator', async () => {
    const event = {
      pathParameters: { clubId: 'club-1', eventId: 'event-1' },
      userId: 'user-creator',
      currentUser: { userId: 'user-creator', name: 'Alice' },
    };

    BookClub.getById.mockResolvedValue({ clubId: 'club-1', name: 'Awesome Club', slug: 'awesome-club', createdBy: 'user-admin' });
    Event.getById.mockResolvedValue({
      eventId: 'event-1',
      clubId: 'club-1',
      createdBy: 'user-creator',
      title: 'Dune Discussion',
      dateTime: '2026-06-01T18:00:00Z',
      description: 'Discuss Dune',
      rsvps: {
        'user-1': { name: 'Bob', status: 'going' },
        'user-2': { name: 'Charlie', status: 'interested' },
        'user-3': { name: 'Dave', status: 'not_going' },
      },
    });
    BookClub.getMemberRecord.mockResolvedValue({ role: 'member', status: 'active' });
    notificationService.sendEmailIfEnabled.mockResolvedValue({ sent: true });

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.sentCount).toBe(2);
    expect(body.data.recipients).toEqual(['user-1', 'user-2']);
    expect(notificationService.sendEmailIfEnabled).toHaveBeenCalledTimes(2);
    expect(notificationService.sendEmailIfEnabled).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'reminder_due_date',
      'event_reminder',
      expect.objectContaining({ eventTitle: 'Dune Discussion', clubName: 'Awesome Club' })
    );
  });

  it('sends reminders on success when user is the club admin', async () => {
    const event = {
      pathParameters: { clubId: 'club-1', eventId: 'event-1' },
      userId: 'user-admin',
      currentUser: { userId: 'user-admin', name: 'Bob' },
    };

    BookClub.getById.mockResolvedValue({ clubId: 'club-1', name: 'Awesome Club', slug: 'awesome-club', createdBy: 'user-owner' });
    Event.getById.mockResolvedValue({
      eventId: 'event-1',
      clubId: 'club-1',
      createdBy: 'user-creator',
      title: 'Dune Discussion',
      dateTime: '2026-06-01T18:00:00Z',
      description: 'Discuss Dune',
      rsvps: {
        'user-1': { name: 'Bob', status: 'going' },
      },
    });
    BookClub.getMemberRecord.mockResolvedValue({ role: 'admin', status: 'active' });
    notificationService.sendEmailIfEnabled.mockResolvedValue({ sent: true });

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.sentCount).toBe(1);
  });
});
