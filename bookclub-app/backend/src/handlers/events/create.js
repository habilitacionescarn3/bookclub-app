const { z } = require('zod');
const response = require('../../lib/response');
const Event = require('../../models/event');
const BookClub = require('../../models/bookclub');
const { withUser } = require('../../lib/middleware');

const RECURRENCE_PATTERNS = ['none', 'daily', 'weekly', 'biweekly', 'monthly'];

const CreateEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
  dateTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/, 'Invalid ISO 8601 date-time format'),
  volunteerTasks: z.array(z.string().min(1)).optional(),
  location: z.string().max(200, 'Location must be 200 characters or less').optional(),
  recurrencePattern: z.enum(RECURRENCE_PATTERNS).optional().default('none'),
  recurrenceEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional(),
});

// Validate recurrence settings
function validateRecurrence(data) {
  if (data.recurrencePattern && data.recurrencePattern !== 'none') {
    if (!data.recurrenceEndDate) {
      return 'End date is required for recurring events';
    }
    
    const startDate = new Date(data.dateTime);
    const endDate = new Date(data.recurrenceEndDate);
    const maxDate = new Date(startDate.getTime() + 26 * 7 * 24 * 60 * 60 * 1000);
    
    if (endDate > maxDate) {
      return 'Recurring events can only be scheduled up to 26 weeks in advance';
    }
    
    if (endDate <= startDate) {
      return 'End date must be after the start date';
    }
  }
  return null;
}

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

  // Validate recurrence settings
  const recurrenceError = validateRecurrence(data);
  if (recurrenceError) {
    return response.validationError({ message: recurrenceError });
  }

  // Create event series (single event if no recurrence)
  const events = await Event.createSeries({
    clubId,
    title: data.title,
    description: data.description,
    dateTime: data.dateTime,
    volunteerTasks: data.volunteerTasks,
    location: data.location,
    recurrencePattern: data.recurrencePattern,
    recurrenceEndDate: data.recurrenceEndDate,
  }, userId, userName);

  return response.success({
    events,
    count: events.length,
    parentEventId: events[0].eventId,
  });
};

module.exports.handler = withUser(handler);
