const response = require('../../lib/response');
const Event = require('../../models/event');
const BookClub = require('../../models/bookclub');
const { withUser } = require('../../lib/middleware');

const handler = async (event) => {
  const { clubId } = event.pathParameters || {};
  const userId = event.userId;

  if (!clubId) {
    return response.validationError({ message: 'Club ID is required' });
  }

  // Verify club membership or creator status
  const isMember = await BookClub.isClubMember(clubId, userId);
  const club = await BookClub.getById(clubId);
  if (!club) {
    return response.notFound('Club not found');
  }

  const isCreator = club.createdBy === userId;
  if (!isMember && !isCreator) {
    return response.forbidden('You must be a member of the club to view events');
  }

  const qs = event.queryStringParameters || {};
  const limitRaw = qs.limit;
  const limit = limitRaw != null ? Math.min(Math.max(parseInt(limitRaw, 10) || 0, 1), 200) : null;
  const nextToken = qs.nextToken || undefined;

  if (limit != null) {
    const page = await Event.listByClub(clubId, { limit, nextToken });
    return response.success(page);
  }

  const events = await Event.listByClub(clubId);
  return response.success(events);
};

module.exports.handler = withUser(handler);
