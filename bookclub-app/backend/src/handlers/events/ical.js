const Event = require('../../models/event');
const BookClub = require('../../models/bookclub');
const { withUser } = require('../../lib/middleware');
const { buildEventIcs } = require('../../lib/ical');

// Shared CORS headers (mirrors lib/response.js)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function errorResponse(statusCode, code, message) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ success: false, error: { code, message } }),
  };
}

const handler = async (event) => {
  const { clubId, eventId } = event.pathParameters || {};
  const userId = event.userId;

  if (!clubId || !eventId) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Club ID and Event ID are required');
  }

  const [club, dbEvent] = await Promise.all([
    BookClub.getById(clubId),
    Event.getById(eventId),
  ]);

  if (!club) return errorResponse(404, 'NOT_FOUND', 'Club not found');
  if (!dbEvent || dbEvent.clubId !== clubId) {
    return errorResponse(404, 'NOT_FOUND', 'Event not found');
  }

  // Only members or the creator may download the calendar invite
  const isMember = await BookClub.isClubMember(clubId, userId);
  const isCreator = club.createdBy === userId;
  if (!isMember && !isCreator) {
    return errorResponse(
      403,
      'FORBIDDEN',
      'You must be a member of the club to export this event'
    );
  }

  const baseUrl = (process.env.SITE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const eventUrl = `${baseUrl}/clubs/${club.slug || clubId}/events`;

  const ics = buildEventIcs(dbEvent, {
    clubName: club.name,
    eventUrl,
  });

  const safeTitle = (dbEvent.title || 'event')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'event';

  return {
    statusCode: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeTitle}.ics"`,
      'Cache-Control': 'no-store',
    },
    body: ics,
  };
};

module.exports.handler = withUser(handler);
