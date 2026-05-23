jest.mock('../../../../src/lib/middleware', () => {
  const original = jest.requireActual('../../../../src/lib/middleware');
  return {
    ...original,
    withUser: (handler) => original.withErrorHandler(handler),
  };
});

jest.mock('../../../../src/models/event');

const { handler } = require('../../../../src/handlers/events/update');
const Event = require('../../../../src/models/event');

describe('events.update handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when clubId or eventId is missing', async () => {
    const event = {
      pathParameters: { clubId: 'club-1' },
      userId: 'user-1',
    };

    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when event is not found', async () => {
    const event = {
      pathParameters: { clubId: 'club-1', eventId: 'event-x' },
      userId: 'user-1',
    };

    Event.getById.mockResolvedValue(null);

    const res = await handler(event);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.message).toBe('Event not found');
  });

  it('returns 400 when event does not belong to the specified club', async () => {
    const event = {
      pathParameters: { clubId: 'club-1', eventId: 'event-1' },
      userId: 'user-1',
    };

    Event.getById.mockResolvedValue({ eventId: 'event-1', clubId: 'club-2', createdBy: 'user-1' });

    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.message).toBe('Event does not belong to the specified club');
  });

  it('returns 403 when user is not the event creator', async () => {
    const event = {
      pathParameters: { clubId: 'club-1', eventId: 'event-1' },
      userId: 'user-2',
      body: JSON.stringify({ title: 'New Title' }),
    };

    Event.getById.mockResolvedValue({ eventId: 'event-1', clubId: 'club-1', createdBy: 'user-1' });

    const res = await handler(event);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error.message).toBe('Only the creator of the event can edit it');
  });

  it('returns 400 when validation fails (invalid ISO 8601 date)', async () => {
    const event = {
      pathParameters: { clubId: 'club-1', eventId: 'event-1' },
      userId: 'user-1',
      body: JSON.stringify({ dateTime: 'invalid-date' }),
    };

    Event.getById.mockResolvedValue({ eventId: 'event-1', clubId: 'club-1', createdBy: 'user-1' });

    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 and updated event on success', async () => {
    const event = {
      pathParameters: { clubId: 'club-1', eventId: 'event-1' },
      userId: 'user-1',
      body: JSON.stringify({
        title: 'Updated Book Club Event',
        description: 'New Description',
        dateTime: '2026-05-25T19:00:00Z',
        location: 'Community Library Room B',
        volunteerTasks: ['Bring snacks', 'Setup chairs'],
      }),
    };

    const mockEvent = { eventId: 'event-1', clubId: 'club-1', createdBy: 'user-1' };
    const mockUpdatedEvent = {
      ...mockEvent,
      title: 'Updated Book Club Event',
      description: 'New Description',
      dateTime: '2026-05-25T19:00:00Z',
      location: 'Community Library Room B',
      volunteerTasks: ['Bring snacks', 'Setup chairs'],
    };

    Event.getById.mockResolvedValue(mockEvent);
    Event.update.mockResolvedValue(mockUpdatedEvent);

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toEqual({ ...mockUpdatedEvent, seriesUpdated: false });
    expect(Event.update).toHaveBeenCalledWith('event-1', {
      title: 'Updated Book Club Event',
      description: 'New Description',
      dateTime: '2026-05-25T19:00:00Z',
      location: 'Community Library Room B',
      volunteerTasks: ['Bring snacks', 'Setup chairs'],
    });
  });
});
