const { v4: uuidv4 } = require('uuid');
const LocalStorage = require('../lib/local-storage');
const dynamoDb = require('../lib/dynamodb');
const { getTableName } = require('../lib/table-names');

const isOffline = () =>
  process.env.IS_OFFLINE === 'true' ||
  process.env.SERVERLESS_OFFLINE === 'true' ||
  process.env.APP_ENV === 'local' ||
  process.env.NODE_ENV === 'test';

// Recurrence pattern helpers
const RECURRENCE_PATTERNS = ['none', 'daily', 'weekly', 'biweekly', 'monthly'];

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
      // Recurrence fields
      parentEventId: data.parentEventId || null,
      recurrencePattern: data.recurrencePattern || 'none',
      recurrenceEndDate: data.recurrenceEndDate || null,
      isRecurringInstance: data.parentEventId ? true : false,
      createdAt: now,
      updatedAt: now,
    };

    if (isOffline()) {
      return LocalStorage.createEvent(event);
    }

    await dynamoDb.put(getTableName('bookclub-events'), event);
    return event;
  }

  // Generate recurring event dates based on pattern
  static generateRecurringDates(startDate, pattern, maxDate) {
    const dates = [];
    const start = new Date(startDate);
    const max = new Date(maxDate);
    
    // Limit to 26 weeks from start
    const twentySixWeeksFromStart = new Date(start.getTime() + 26 * 7 * 24 * 60 * 60 * 1000);
    const effectiveMax = max < twentySixWeeksFromStart ? max : twentySixWeeksFromStart;
    
    let current = new Date(start);
    
    while (current <= effectiveMax) {
      dates.push(new Date(current).toISOString());
      
      switch (pattern) {
        case 'daily':
          current.setDate(current.getDate() + 1);
          break;
        case 'weekly':
          current.setDate(current.getDate() + 7);
          break;
        case 'biweekly':
          current.setDate(current.getDate() + 14);
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + 1);
          break;
        default:
          return dates; // Only return first date for non-recurring
      }
    }
    
    return dates;
  }

  // Create a series of recurring events
  static async createSeries(baseData, userId, userName) {
    const { recurrencePattern, recurrenceEndDate, dateTime, ...base } = baseData;
    
    if (!recurrencePattern || recurrencePattern === 'none' || !recurrenceEndDate) {
      // Single event
      return [await this.create({ ...base, dateTime }, userId, userName)];
    }
    
    // Generate all dates in the series
    const dates = this.generateRecurringDates(dateTime, recurrencePattern, recurrenceEndDate);
    
    if (dates.length === 0) {
      throw new Error('No valid dates generated for recurring series');
    }
    
    // Create the parent event (first one)
    const parentEvent = await this.create({
      ...base,
      dateTime: dates[0],
      recurrencePattern,
      recurrenceEndDate,
    }, userId, userName);
    
    const events = [parentEvent];
    const parentId = parentEvent.eventId;
    
    // Create child events
    for (let i = 1; i < dates.length; i++) {
      const child = await this.create({
        ...base,
        dateTime: dates[i],
        parentEventId: parentId,
        recurrencePattern: 'none', // Children don't have their own pattern
        recurrenceEndDate: null,
      }, userId, userName);
      events.push(child);
    }
    
    return events;
  }

  // Get all events in a series
  static async getSeries(parentEventId) {
    if (isOffline()) {
      const allEvents = await LocalStorage.listEventsByClub(null);
      return (allEvents || []).filter(e => 
        e.eventId === parentEventId || e.parentEventId === parentEventId
      );
    }
    
    // Query by parentEventId using a GSI scan fallback
    const scanParams = {
      TableName: getTableName('bookclub-events'),
      FilterExpression: 'eventId = :parentId OR parentEventId = :parentId',
      ExpressionAttributeValues: { ':parentId': parentEventId },
    };
    
    const result = await dynamoDb.scan(scanParams);
    return (result.Items || []).sort((a, b) => 
      new Date(a.dateTime) - new Date(b.dateTime)
    );
  }

  // Delete all events in a series
  static async deleteSeries(parentEventId) {
    const events = await this.getSeries(parentEventId);
    const results = [];
    
    for (const evt of events) {
      results.push(await this.delete(evt.eventId));
    }
    
    return results.every(r => r === true);
  }

  // Update all future events in a series from a given event
  static async updateSeriesFrom(eventId, updates) {
    const event = await this.getById(eventId);
    if (!event) throw new Error('Event not found');
    
    const parentId = event.parentEventId || event.eventId;
    const allEvents = await this.getSeries(parentId);
    
    // Only update this event and all future ones
    const targetDate = new Date(event.dateTime);
    const futureEvents = allEvents.filter(e => new Date(e.dateTime) >= targetDate);
    
    const results = [];
    for (const evt of futureEvents) {
      // Don't change the dateTime or recurrence fields
      const allowedUpdates = {};
      if (updates.title !== undefined) allowedUpdates.title = updates.title;
      if (updates.description !== undefined) allowedUpdates.description = updates.description;
      if (updates.location !== undefined) allowedUpdates.location = updates.location;
      if (updates.volunteerTasks !== undefined) allowedUpdates.volunteerTasks = updates.volunteerTasks;
      
      if (Object.keys(allowedUpdates).length > 0) {
        results.push(await this.update(evt.eventId, allowedUpdates));
      }
    }
    
    return results;
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
