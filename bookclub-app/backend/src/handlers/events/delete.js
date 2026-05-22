const response = require('../../lib/response');
const Event = require('../../models/event');
const { withUser } = require('../../lib/middleware');

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
    return response.forbidden('Only the creator of the event can delete it');
  }

  const success = await Event.delete(eventId);
  if (!success) {
    return response.notFound('Event not found during deletion');
  }

  return response.success({ message: 'Event deleted successfully' });
};

module.exports.handler = withUser(handler);
