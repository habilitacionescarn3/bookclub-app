const { z } = require('zod');
const response = require('../../lib/response');
const Event = require('../../models/event');
const BookClub = require('../../models/bookclub');
const { withUser } = require('../../lib/middleware');

const CreateEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
  dateTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/, 'Invalid ISO 8601 date-time format'),
  volunteerTasks: z.array(z.string().min(1)).optional(),
  location: z.string().max(200, 'Location must be 200 characters or less').optional(),
});

const handler = async (event) => {
  const { clubId } = event.pathParameters || {};
  const userId = event.userId;
  const userName = event.currentUser.name;

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
    return response.forbidden('You must be a member of the club to create events');
  }

  const body = JSON.parse(event.body || '{}');
  const data = CreateEventSchema.parse(body);

  const newEvent = await Event.create({
    clubId,
    title: data.title,
    description: data.description,
    dateTime: data.dateTime,
    volunteerTasks: data.volunteerTasks,
    location: data.location,
  }, userId, userName);

  return response.success(newEvent);
};

module.exports.handler = withUser(handler);
