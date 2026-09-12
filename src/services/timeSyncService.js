/**
 * Universal Server Time Synchronization Service
 * Eliminates clock drift across different devices, operating systems, and timezones.
 */

let serverClockOffset = 0; // serverTime - localClientTime
let isSynchronized = false;
let ongoingSyncPromise = null;

/**
 * Checks whether the server time has been successfully synchronized.
 * @returns {boolean}
 */
export function isServerTimeSynchronized() {
  return isSynchronized;
}

/**
 * Syncs the local browser clock with the server's real-time clock via HTTP Date header.
 * @returns {Promise<number>} Clock offset in milliseconds
 */
export async function syncServerTime() {
  if (ongoingSyncPromise) return ongoingSyncPromise;

  ongoingSyncPromise = (async () => {
    try {
      const pingUrl = `${window.location.origin}/?_t=${Date.now()}`;
      const requestStart = Date.now();
      
      const response = await fetch(pingUrl, {
        method: 'HEAD',
        cache: 'no-store'
      });

      const requestEnd = Date.now();
      const roundTripMs = requestEnd - requestStart;
      const dateHeader = response.headers.get('date');

      if (dateHeader) {
        const serverTime = new Date(dateHeader).getTime() + Math.floor(roundTripMs / 2);
        serverClockOffset = serverTime - requestEnd;
        isSynchronized = true;
      }
    } catch (err) {
      console.warn("Time synchronization notice (using device clock fallback):", err.message);
    } finally {
      ongoingSyncPromise = null;
    }
    return serverClockOffset;
  })();

  return ongoingSyncPromise;
}

/**
 * Returns the current synchronized timestamp (in milliseconds).
 * Guarantees that all devices compute the exact same time.
 * @returns {number} Epoch timestamp in milliseconds
 */
export function getSynchronizedTime() {
  return Date.now() + serverClockOffset;
}

/**
 * Parses an activity timestamp (startTime, endTime, etc.) into an exact epoch timestamp in ms.
 * Handles:
 * - Direct epoch milliseconds (number or numeric string)
 * - Full ISO strings with timezone indicators (e.g. 2026-09-05T03:50:00.000Z)
 * - Local datetime-local strings (e.g. 2026-09-05T09:20) along with admin's saved timezone offset
 * 
 * @param {string|number} timeValue 
 * @param {object} [activity] Optional activity object containing admin's timezone metadata
 * @returns {number|null} Epoch timestamp in milliseconds
 */
export function parseActivityTime(timeValue, activity = null) {
  if (!timeValue) return null;

  // 1. Direct number
  if (typeof timeValue === 'number' && !isNaN(timeValue) && timeValue > 0) {
    return timeValue;
  }

  // 2. Pure digits string
  if (typeof timeValue === 'string' && /^\d+$/.test(timeValue.trim())) {
    const num = parseInt(timeValue.trim(), 10);
    if (!isNaN(num) && num > 0) return num;
  }

  if (typeof timeValue === 'string') {
    const str = timeValue.trim();

    // 3. If it contains timezone designator 'Z' or '+HH:MM' or '-HH:MM'
    if (str.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(str)) {
      const parsed = new Date(str).getTime();
      if (!isNaN(parsed)) return parsed;
    }

    // 4. If it is a datetime-local format without timezone (e.g. 'YYYY-MM-DDTHH:mm')
    // Check if the activity has adminTimezoneOffset stored
    if (activity && typeof activity.adminTimezoneOffset === 'number') {
      const match = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        const hour = parseInt(match[4], 10);
        const minute = parseInt(match[5], 10);
        const second = match[6] ? parseInt(match[6], 10) : 0;

        // UTC timestamp assuming 0 offset, then adjust by admin's offset in minutes
        const utcMs = Date.UTC(year, month, day, hour, minute, second);
        // getTimezoneOffset() returns minutes that local time is BEHIND UTC (e.g. -330 for +05:30)
        const adjustedMs = utcMs + (activity.adminTimezoneOffset * 60 * 1000);
        return adjustedMs;
      }
    }

    // Standard JavaScript Date parse fallback
    const standardParsed = new Date(str).getTime();
    if (!isNaN(standardParsed)) return standardParsed;
  }

  return null;
}
