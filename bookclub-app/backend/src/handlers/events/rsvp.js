const { z } = require('zod');
const response = require('../../lib/response');
const Event = require('../../models/event');
const BookClub = require('../../models/bookclub');
const { withUser } = require('../../lib/middleware');

const RsvpSchema = z.object({
  status: z.enum(['going', 'interested', 'not_going']),
});

const handler = async (event) => {
  const { clubId, eventId } = event.pathParameters || {};
  const userId = event.userId;
  const userName = event.currentUser.name;

  if (!clubId || !eventId) {
    return response.validationError({ message: 'Club ID and Event ID are required' });
  }

  // Verify membership or creator status
  const isMember = await BookClub.isClubMember(clubId, userId);
  const club = await BookClub.getById(clubId);
  if (!club) {
    return response.notFound('Club not found');
  }

  const isCreator = club.createdBy === userId;
  if (!isMember && !isCreator) {
    return response.forbidden('You must be a member of the club to RSVP');
  }

  const dbEvent = await Event.getById(eventId);
  if (!dbEvent || dbEvent.clubId !== clubId) {
    return response.notFound('Event not found');
  }

  const body = JSON.parse(event.body || '{}');
  const { status } = RsvpSchema.parse(body);

  const updatedEvent = await Event.rsvp(eventId, userId, userName, status);
  return response.success(updatedEvent);
};

module.exports.handler = withUser(handler);
