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
  organizers: z.record(z.object({
    name: z.string(),
    nominatedAt: z.string(),
  })).optional(),
});

const handler = async (event) => {
  const { clubId, eventId } = event.pathParameters || {};
  const userId = event.userId;
  const queryParams = event.queryStringParameters || {};
  const updateSeries = queryParams.updateSeries === 'true';

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

  // Verify that requester is an organizer (creator or nominated organizer)
  const isOrganizer = existingEvent.createdBy === userId || (existingEvent.organizers && existingEvent.organizers[userId]);
  if (!isOrganizer) {
    return response.forbidden('Only an organizer of the event can edit it');
  }

  const body = JSON.parse(event.body || '{}');
  const data = UpdateEventSchema.parse(body);

  // Check if this is part of a series and user wants to update the series
  const isPartOfSeries = existingEvent.parentEventId || 
    (existingEvent.recurrencePattern && existingEvent.recurrencePattern !== 'none');
  
  if (updateSeries && isPartOfSeries) {
    // Update this and all future events in the series
    const updatedEvents = await Event.updateSeriesFrom(eventId, data);
    
    return response.success({
      events: updatedEvents,
      seriesUpdated: true,
      updatedCount: updatedEvents.length,
    });
  }

  // Single event update
  const updatedEvent = await Event.update(eventId, data);
  if (!updatedEvent) {
    return response.notFound('Event not found during update');
  }

  return response.success({
    ...updatedEvent,
    seriesUpdated: false,
  });
};

module.exports.handler = withUser(handler);
