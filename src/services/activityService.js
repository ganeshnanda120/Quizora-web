import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

/**
 * Generates a unique permanent activity ID
 */
export const generateActivityId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'qzk_';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Upload question paper (PDF/PNG/JPG) or question image to Firebase Storage at activities/{activityId}/questions/...
 * @param {string} activityId 
 * @param {File} file 
 * @returns {Promise<string>} Download URL or Data URL fallback
 */
export const uploadActivityFile = async (activityId, file) => {
  if (!file || !activityId) return null;

  try {
    const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storageRef = ref(storage, `activities/${activityId}/questions/${filename}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (err) {
    console.warn("Storage upload notice (falling back to Data URL preview):", err.message);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }
};

/**
 * Recursively cleans and sanitizes any payload for Firestore.
 * Converts 'undefined' values to null and strips raw File objects so setDoc never fails.
 */
export const sanitizeFirestorePayload = (obj) => {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeFirestorePayload(item));
  }

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      clean[key] = null;
    } else if (typeof File !== 'undefined' && value instanceof File) {
      continue;
    } else if (typeof Blob !== 'undefined' && value instanceof Blob) {
      continue;
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeFirestorePayload(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
};

/**
 * Normalizes activity payload with absolute epoch timestamps and timezone metadata
 */
const normalizeTimePayload = (data) => {
  const currentTz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const currentOffset = new Date().getTimezoneOffset();

  const startTimeMs = data.startTime ? new Date(data.startTime).getTime() : null;
  const endTimeMs = data.endTime ? new Date(data.endTime).getTime() : null;

  const normalized = {
    ...data,
    adminTimezone: data.adminTimezone || currentTz,
    adminTimezoneOffset: typeof data.adminTimezoneOffset === 'number' ? data.adminTimezoneOffset : currentOffset,
    startTimeMs: startTimeMs && !isNaN(startTimeMs) ? startTimeMs : null,
    endTimeMs: endTimeMs && !isNaN(endTimeMs) ? endTimeMs : null
  };

  // Also normalize individual part times if present
  if (Array.isArray(normalized.parts)) {
    normalized.parts = normalized.parts.map((p) => ({
      ...p,
      individualStartTimeMs: p.individualStartTime ? new Date(p.individualStartTime).getTime() : null,
      individualEndTimeMs: p.individualEndTime ? new Date(p.individualEndTime).getTime() : null
    }));
  }

  if (Array.isArray(normalized.sections)) {
    normalized.sections = normalized.sections.map((sec) => ({
      ...sec,
      parts: Array.isArray(sec.parts)
        ? sec.parts.map((p) => ({
            ...p,
            individualStartTimeMs: p.individualStartTime ? new Date(p.individualStartTime).getTime() : null,
            individualEndTimeMs: p.individualEndTime ? new Date(p.individualEndTime).getTime() : null
          }))
        : (sec.parts || [])
    }));
  }

  return normalized;
};

/**
 * Save activity draft to Firestore and localStorage
 * @param {string} activityId 
 * @param {object} activityData 
 * @returns {Promise<object>} Saved payload
 */
export const saveActivityDraft = async (activityId, activityData) => {
  if (!activityId) throw new Error("Activity ID is required");

  const now = new Date().toISOString();
  const normalizedData = normalizeTimePayload(activityData);
  const rawPayload = {
    ...normalizedData,
    activityId,
    updatedAt: now,
    status: activityData.status || 'draft'
  };

  if (!rawPayload.createdAt) {
    rawPayload.createdAt = now;
  }

  const payload = sanitizeFirestorePayload(rawPayload);

  // Cache locally
  try {
    localStorage.setItem(`quizora_activity_${activityId}`, JSON.stringify(payload));
  } catch {
    // Ignore quota issues
  }

  // Write to Firestore with permission resilience
  try {
    const docRef = doc(db, 'activities', activityId);
    await setDoc(docRef, payload, { merge: true });
    console.log(`[Quizora] Activity draft successfully persisted to Firestore: ${activityId}`);
  } catch (err) {
    console.warn("Firestore activity draft write notice:", err.message);
  }

  return payload;
};

/**
 * Finalize activity document with permanent share URL
 * @param {string} activityId 
 * @param {object} fullPayload 
 * @returns {Promise<object>} Published payload with permanent URL
 */
export const publishActivity = async (activityId, fullPayload) => {
  const origin = window.location.origin;
  const permanentUrl = `${origin}/activity/${activityId}`;
  const now = new Date().toISOString();
  const normalizedData = normalizeTimePayload(fullPayload);

  const rawPayload = {
    ...normalizedData,
    activityId,
    shareUrl: permanentUrl,
    status: 'published',
    updatedAt: now
  };

  const finalPayload = sanitizeFirestorePayload(rawPayload);

  try {
    localStorage.setItem(`quizora_activity_${activityId}`, JSON.stringify(finalPayload));
  } catch {
    // Ignore quota issues
  }

  try {
    const docRef = doc(db, 'activities', activityId);
    await setDoc(docRef, finalPayload, { merge: true });
    console.log(`[Quizora] Activity successfully published to Firestore: ${activityId}`);
  } catch (err) {
    console.warn("Firestore activity publish write notice:", err.message);
  }

  return finalPayload;
};

/**
 * Fetch an activity by ID from Firestore or local cache
 * @param {string} activityId 
 * @returns {Promise<object|null>}
 */
export const getActivityById = async (activityId) => {
  if (!activityId) return null;

  // Check local cache
  let localData = null;
  try {
    const raw = localStorage.getItem(`quizora_activity_${activityId}`);
    if (raw) localData = JSON.parse(raw);
  } catch {
    // Ignore JSON error
  }

  try {
    const docRef = doc(db, 'activities', activityId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { activityId, ...snap.data() };
    }
    return localData;
  } catch (err) {
    console.warn("Firestore getActivityById notice:", err.message);
    return localData;
  }
};

