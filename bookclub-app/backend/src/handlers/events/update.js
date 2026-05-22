const { z } = require('zod');
const response = require('../../lib/response');
const Event = require('../../models/event');
const BookClub = require('../../models/bookclub');
const { withUser } = require('../../lib/middleware');

const UpdateEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less').optional(),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
  dateTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/, 'Invalid ISO 8601 date-time format').optional(),
  volunteerTasks: z.array(z.string().min(1)).optional(),
  location: z.string().max(200, 'Location must be 200 characters or less').optional(),
});

const handler = async (event) => {
  const { clubId, eventId } = event.pathParameters || {};
  const userId = event.userId;

  if (!clubId || !eventId) {
    return response.validationError({ message: 'Club ID and Event ID are required' });
  }

  // Fetch existing event
  const existingEvent = await Event.getById(eventId);
  if (!existingEvent) {
    return response.notFound('Event not found');
  }

  // Ensure event matches the club
  if (existingEvent.clubId !== clubId) {
    return response.error('Event does not belong to the specified club', 400);
  }

  // Verify that requester is the event creator
  if (existingEvent.createdBy !== userId) {
    return response.forbidden('Only the creator of the event can edit it');
  }

  const body = JSON.parse(event.body || '{}');
  const data = UpdateEventSchema.parse(body);

  const updatedEvent = await Event.update(eventId, data);
  if (!updatedEvent) {
    return response.notFound('Event not found during update');
  }

  return response.success(updatedEvent);
};

module.exports.handler = withUser(handler);
