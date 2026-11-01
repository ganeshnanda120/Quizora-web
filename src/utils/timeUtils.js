/**
 * Time utility functions for sorting, timestamp extraction, and history formatting
 */

/**
 * Extracts a numeric epoch timestamp (in ms) from an activity, submission, or history object.
 * Checks timestamp, submittedAt, createdAt, updatedAt, startTime, and ID fallbacks.
 * @param {object|null|undefined} item 
 * @returns {number} Epoch timestamp in milliseconds (or 0 if indeterminate)
 */
export const extractTimestamp = (item) => {
  if (!item || typeof item !== 'object') return 0;

  const possibleTimes = [
    item.timestamp,
    item.submittedAt,
    item.createdAt,
    item.updatedAt,
    item.startTimeMs,
    item.startTime,
    item.endTimeMs,
    item.endTime,
    item.date
  ];

  for (const t of possibleTimes) {
    if (!t) continue;
    if (typeof t === 'number' && !isNaN(t) && t > 0) return t;
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (typeof t.toDate === 'function') return t.toDate().getTime();
    if (typeof t === 'string') {
      const parsed = new Date(t).getTime();
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }

  // Fallback: extract timestamp from ID if generated like act_1730000000000_... or sub_1730000000000_...
  const idStr = String(item.id || item.activityId || item.submissionId || '');
  const idMatch = idStr.match(/(?:sub|act|activity)_?(\d{10,13})/);
  if (idMatch && idMatch[1]) {
    const num = parseInt(idMatch[1], 10);
    return num < 10000000000 ? num * 1000 : num;
  }

  return 0;
};

/**
 * Sorts an array of items time-wise in descending order (newest on top).
 * Does not mutate the original array.
 * @param {Array} list 
 * @returns {Array} Sorted new array with newest items at index 0
 */
export const sortNewestFirst = (list) => {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => extractTimestamp(b) - extractTimestamp(a));
};

/**
 * Formats a timestamp or date string into a clear, human-friendly date and time.
 * E.g., "Nov 1, 2026, 09:15 PM"
 * @param {number|string|Date} timestamp 
 * @returns {string}
 */
export const formatHistoryDateTime = (timestamp) => {
  if (!timestamp) return 'Recent';
  try {
    const d = new Date(typeof timestamp === 'number' ? timestamp : extractTimestamp({ timestamp }));
    if (isNaN(d.getTime())) return 'Recent';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return 'Recent';
  }
};

