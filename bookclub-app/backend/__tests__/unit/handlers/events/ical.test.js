jest.mock('../../../../src/lib/middleware', () => ({
  withUser: (handler) => handler,
}));

jest.mock('../../../../src/models/event');
jest.mock('../../../../src/models/bookclub');

const { handler } = require('../../../../src/handlers/events/ical');
const Event = require('../../../../src/models/event');
const BookClub = require('../../../../src/models/bookclub');

describe('events.ical handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseRequest = {
    pathParameters: { clubId: 'c1', eventId: 'e1' },
    userId: 'u1',
  };

  it('returns 400 when path params are missing', async () => {
    const res = await handler({ pathParameters: { clubId: 'c1' }, userId: 'u1' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when club is missing', async () => {
    BookClub.getById.mockResolvedValue(null);
    Event.getById.mockResolvedValue({ eventId: 'e1', clubId: 'c1' });
    const res = await handler(baseRequest);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.message).toBe('Club not found');
  });

  it('returns 404 when event does not belong to the club', async () => {
    BookClub.getById.mockResolvedValue({ clubId: 'c1', name: 'Club', createdBy: 'creator' });
    Event.getById.mockResolvedValue({ eventId: 'e1', clubId: 'c2' });
    const res = await handler(baseRequest);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.message).toBe('Event not found');
  });

  it('returns 403 when the requester is not a member or the creator', async () => {
    BookClub.getById.mockResolvedValue({ clubId: 'c1', name: 'Club', createdBy: 'creator' });
    Event.getById.mockResolvedValue({
      eventId: 'e1',
      clubId: 'c1',
      title: 'T',
      dateTime: '2026-06-01T18:00:00Z',
    });
    BookClub.isClubMember.mockResolvedValue(false);

    const res = await handler(baseRequest);
    expect(res.statusCode).toBe(403);
  });

  it('returns 200 with text/calendar body for a member', async () => {
    BookClub.getById.mockResolvedValue({
      clubId: 'c1',
      slug: 'my-club',
      name: 'My Club',
      createdBy: 'creator',
    });
    Event.getById.mockResolvedValue({
      eventId: 'e1',
      clubId: 'c1',
      title: 'Weekly Meet',
      description: 'Read ch.1',
      location: 'Library',
      dateTime: '2026-06-01T18:00:00.000Z',
    });
    BookClub.isClubMember.mockResolvedValue(true);

    const res = await handler(baseRequest);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/calendar; charset=utf-8');
    expect(res.headers['Content-Disposition']).toMatch(/attachment; filename="weekly-meet\.ics"/);
    expect(res.body).toContain('BEGIN:VCALENDAR');
    expect(res.body).toContain('UID:e1@bookclub-app');
    expect(res.body).toContain('DTSTART:20260601T180000Z');
    expect(res.body).toContain('SUMMARY:Weekly Meet');
    expect(res.body).toContain('LOCATION:Library');
  });
});
