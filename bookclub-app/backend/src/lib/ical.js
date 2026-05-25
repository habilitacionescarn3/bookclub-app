/**
 * Minimal RFC 5545 iCalendar (.ics) generator for ClubEvents.
 *
 * Intentionally dependency-free. Output is suitable for "download .ics and
 * import once" workflows (Google Calendar, Apple Calendar, Outlook). It is
 * NOT a live subscription feed.
 */

const PRODID = '-//BookClub App//Events 1.0//EN';

/**
 * Escape a string per RFC 5545 §3.3.11 TEXT value.
 */
function escapeText(value) {
  if (value == null) return '';
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Format a Date (or ISO string) as a UTC iCal DATE-TIME value:
 * `YYYYMMDDTHHMMSSZ`.
 */
function formatUtc(input) {
  const d = input instanceof Date ? input : new Date(input);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Fold long content lines to 75 octets per RFC 5545 §3.1. Continuation
 * lines start with a single whitespace character (we use a space).
 */
function foldLine(line) {
  if (line.length <= 75) return line;
  const parts = [];
  let i = 0;
  while (i < line.length) {
    if (i === 0) {
      parts.push(line.slice(0, 75));
      i = 75;
    } else {
      parts.push(' ' + line.slice(i, i + 74));
      i += 74;
    }
  }
  return parts.join('\r\n');
}

/**
 * Build an iCalendar VCALENDAR string for a single event.
 *
 * @param {Object} evt - Event from the Event model.
 * @param {Object} [opts]
 * @param {string} [opts.clubName] - Calendar / organizer display name.
 * @param {number} [opts.durationMinutes=60] - Event duration in minutes.
 * @param {string} [opts.eventUrl] - Optional URL to embed.
 * @returns {string} Full .ics document with CRLF line endings.
 */
function buildEventIcs(evt, opts = {}) {
  if (!evt || !evt.eventId || !evt.dateTime) {
    throw new Error('buildEventIcs requires an event with eventId and dateTime');
  }
  const { clubName, durationMinutes = 60, eventUrl } = opts;

  const start = new Date(evt.dateTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const dtstamp = formatUtc(new Date());

  const summary = evt.title || 'Event';
  const descParts = [];
  if (evt.description) descParts.push(evt.description);
  if (clubName) descParts.push(`Club: ${clubName}`);
  if (eventUrl) descParts.push(eventUrl);
  const description = descParts.join('\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${evt.eventId}@bookclub-app`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${formatUtc(start)}`,
    `DTEND:${formatUtc(end)}`,
    `SUMMARY:${escapeText(summary)}`,
    description ? `DESCRIPTION:${escapeText(description)}` : null,
    evt.location ? `LOCATION:${escapeText(evt.location)}` : null,
    eventUrl ? `URL:${escapeText(eventUrl)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

module.exports = {
  buildEventIcs,
  // Exported for unit-testing
  _internal: { escapeText, formatUtc, foldLine },
};
