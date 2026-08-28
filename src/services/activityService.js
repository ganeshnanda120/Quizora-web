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
 * Save activity draft to Firestore and localStorage
 * @param {string} activityId 
 * @param {object} activityData 
 * @returns {Promise<object>} Saved payload
 */
export const saveActivityDraft = async (activityId, activityData) => {
  if (!activityId) throw new Error("Activity ID is required");

  const now = new Date().toISOString();
  const payload = {
    ...activityData,
    activityId,
    updatedAt: now,
    status: activityData.status || 'draft'
  };

  if (!payload.createdAt) {
    payload.createdAt = now;
  }

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

  const finalPayload = {
    ...fullPayload,
    activityId,
    shareUrl: permanentUrl,
    status: 'published',
    updatedAt: now
  };

  try {
    localStorage.setItem(`quizora_activity_${activityId}`, JSON.stringify(finalPayload));
  } catch {
    // Ignore quota issues
  }

  try {
    const docRef = doc(db, 'activities', activityId);
    await setDoc(docRef, finalPayload, { merge: true });
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
      return snap.data();
    }
    return localData;
  } catch (err) {
    console.warn("Firestore getActivityById notice:", err.message);
    return localData;
  }
};
