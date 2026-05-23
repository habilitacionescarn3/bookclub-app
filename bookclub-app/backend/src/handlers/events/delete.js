const response = require('../../lib/response');
const Event = require('../../models/event');
const { withUser } = require('../../lib/middleware');

const handler = async (event) => {
  const { clubId, eventId } = event.pathParameters || {};
  const userId = event.userId;
  const queryParams = event.queryStringParameters || {};
  const deleteSeries = queryParams.deleteSeries === 'true';

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
    return response.forbidden('Only the creator of the event can delete it');
  }

  if (deleteSeries) {
    // Get the parent event ID (this event or its parent)
    const parentEventId = existingEvent.parentEventId || existingEvent.eventId;
    const seriesDeleted = await Event.deleteSeries(parentEventId);
    
    if (!seriesDeleted) {
      return response.error('Failed to delete event series', 500);
    }
    
    return response.success({ 
      message: 'Event series deleted successfully',
      seriesDeleted: true,
    });
  }

  const success = await Event.delete(eventId);
  if (!success) {
    return response.notFound('Event not found during deletion');
  }

  return response.success({ 
    message: 'Event deleted successfully',
    seriesDeleted: false,
  });
};

module.exports.handler = withUser(handler);
