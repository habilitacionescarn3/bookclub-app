const { v4: uuidv4 } = require('uuid');
const LocalStorage = require('../lib/local-storage');
const dynamoDb = require('../lib/dynamodb');
const { getTableName } = require('../lib/table-names');

const isOffline = () =>
  process.env.IS_OFFLINE === 'true' ||
  process.env.SERVERLESS_OFFLINE === 'true' ||
  process.env.APP_ENV === 'local' ||
  process.env.NODE_ENV === 'test';

class Event {
  static async create(data, userId, userName) {
    const now = new Date().toISOString();
    const event = {
      eventId: uuidv4(),
      clubId: data.clubId,
      title: data.title,
      description: data.description || '',
      dateTime: data.dateTime,
      location: data.location || '',
      createdBy: userId,
      creatorName: userName || 'Anonymous',
      volunteerTasks: Array.isArray(data.volunteerTasks) ? data.volunteerTasks : [],
      volunteers: {},
      rsvps: {},
      discussions: [],
      createdAt: now,
      updatedAt: now,
    };

    if (isOffline()) {
      return LocalStorage.createEvent(event);
    }

    await dynamoDb.put(getTableName('bookclub-events'), event);
    return event;
  }

  static async getById(eventId) {
    if (isOffline()) {
      return LocalStorage.getEvent(eventId);
    }
    return dynamoDb.get(getTableName('bookclub-events'), { eventId });
  }

  static async listByClub(clubId) {
    if (isOffline()) {
      return LocalStorage.listEventsByClub(clubId);
    }

    // In DynamoDB, if we don't have GSI on clubId, we can query if hash is clubId, range is eventId.
    // Let's assume table hash key is clubId, range key is eventId.
    // If table hash key is eventId, we'd need a GSI for ClubId. But wait, in the plan we proposed Hash: clubId, Range: eventId.
    // Let's implement query assuming Hash: clubId, Range: eventId.
    const params = {
      TableName: getTableName('bookclub-events'),
      KeyConditionExpression: 'clubId = :clubId',
      ExpressionAttributeValues: { ':clubId': clubId },
    };

    const result = await dynamoDb.query(params);
    let items = result.Items || [];
    
    // Sort chronologically by dateTime
    return items.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  }

  static async update(eventId, updates) {
    const existing = await this.getById(eventId);
    if (!existing) return null;

    const allowed = {};
    if (updates.title !== undefined) allowed.title = updates.title;
    if (updates.description !== undefined) allowed.description = updates.description;
    if (updates.dateTime !== undefined) allowed.dateTime = updates.dateTime;
    if (updates.location !== undefined) allowed.location = updates.location;
    if (Array.isArray(updates.volunteerTasks)) allowed.volunteerTasks = updates.volunteerTasks;
    if (updates.volunteers !== undefined) allowed.volunteers = updates.volunteers;
    if (updates.rsvps !== undefined) allowed.rsvps = updates.rsvps;
    if (updates.discussions !== undefined) allowed.discussions = updates.discussions;

    const now = new Date().toISOString();
    const merged = { ...existing, ...allowed, updatedAt: now };

    if (isOffline()) {
      return LocalStorage.updateEvent(eventId, merged);
    }

    const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
      dynamoDb.generateUpdateExpression({ ...allowed, updatedAt: now });

    // Since our primary key is clubId + eventId in DDB, we need clubId.
    const result = await dynamoDb.update({
      TableName: getTableName('bookclub-events'),
      Key: { clubId: existing.clubId, eventId },
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });
    return result.Attributes;
  }

  static async delete(eventId) {
    const existing = await this.getById(eventId);
    if (!existing) return false;

    if (isOffline()) {
      return LocalStorage.deleteEvent(eventId);
    }

    await dynamoDb.delete(getTableName('bookclub-events'), { clubId: existing.clubId, eventId });
    return true;
  }

  // RSVP helper
  static async rsvp(eventId, userId, userName, status) {
    const event = await this.getById(eventId);
    if (!event) throw new Error('Event not found');

    const rsvps = { ...event.rsvps };
    rsvps[userId] = {
      name: userName || 'Anonymous',
      status,
      updatedAt: new Date().toISOString(),
    };

    return this.update(eventId, { rsvps });
  }

  // Volunteer helper
  static async volunteer(eventId, userId, userName, task) {
    const event = await this.getById(eventId);
    if (!event) throw new Error('Event not found');

    const volunteers = { ...event.volunteers };
    if (task) {
      // Check if user is already volunteering for another task, clear it if so (limit to 1 task per user per event)
      for (const [uid, info] of Object.entries(volunteers)) {
        if (uid === userId) {
          delete volunteers[uid];
        }
      }
      volunteers[userId] = {
        name: userName || 'Anonymous',
        task,
        signedUpAt: new Date().toISOString(),
      };
    } else {
      // Clear volunteer slot for this user
      delete volunteers[userId];
    }

    return this.update(eventId, { volunteers });
  }

  // Discussion comment helper
  static async addComment(eventId, userId, userName, content) {
    const event = await this.getById(eventId);
    if (!event) throw new Error('Event not found');

    const discussions = [...(event.discussions || [])];
    discussions.push({
      commentId: uuidv4(),
      userId,
      name: userName || 'Anonymous',
      content,
      createdAt: new Date().toISOString(),
    });

    return this.update(eventId, { discussions });
  }
}

module.exports = Event;
