import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { generateActivityId } from './activityService';

/**
 * Computes activity status based on current time and start/end dates
 * @param {object} activity 
 * @returns {string} 'Draft' | 'Scheduled' | 'Active' | 'Completed' | 'Expired'
 */
export const computeActivityStatus = (activity) => {
  if (!activity) return 'Draft';
  if (activity.status === 'draft') return 'Draft';

  const now = new Date();
  const start = activity.startTime ? new Date(activity.startTime) : null;
  const end = activity.endTime ? new Date(activity.endTime) : null;

  if (start && now < start) {
    return 'Scheduled';
  }

  if (end && now > end) {
    return 'Expired';
  }

  if (start && end && now >= start && now <= end) {
    return 'Active';
  }

  return activity.status === 'published' ? 'Active' : 'Completed';
};

/**
 * Fetch all activities created by current Admin from Firestore or local cache
 * @param {string} adminUid 
 * @returns {Promise<Array>}
 */
export const getAdminActivities = async (adminUid) => {
  if (!adminUid) return [];

  const activityMap = new Map();
  const localKeys = Object.keys(localStorage).filter((k) => k.startsWith('quizora_activity_'));

  // 1. Load from local storage cache first
  localKeys.forEach((key) => {
    try {
      const item = JSON.parse(localStorage.getItem(key) || '{}');
      if (item.adminUid === adminUid && item.activityId) {
        activityMap.set(item.activityId, {
          ...item,
          computedStatus: computeActivityStatus(item)
        });
      }
    } catch {
      // Ignore parse error
    }
  });

  // 2. Query Firestore and merge
  try {
    const q = query(collection(db, 'activities'), where('adminUid', '==', adminUid));
    const snap = await getDocs(q);

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const id = docSnap.id;
      const existing = activityMap.get(id);
      activityMap.set(id, {
        ...(existing || {}),
        ...data,
        activityId: id,
        computedStatus: computeActivityStatus(data)
      });
    });
  } catch (err) {
    console.warn("Firestore getAdminActivities notice:", err.message);
  }

  return Array.from(activityMap.values());
};

/**
 * Real-time subscription to activities created by the current Admin
 * @param {string} adminUid 
 * @param {function(Array): void} callback 
 * @returns {function(): void} unsubscribe
 */
export const subscribeAdminActivities = (adminUid, callback) => {
  if (!adminUid) return () => {};

  try {
    const q = query(collection(db, 'activities'), where('adminUid', '==', adminUid));
    return onSnapshot(
      q,
      (snapshot) => {
        const activityMap = new Map();
        const localKeys = Object.keys(localStorage).filter((k) => k.startsWith('quizora_activity_'));

        localKeys.forEach((key) => {
          try {
            const item = JSON.parse(localStorage.getItem(key) || '{}');
            if (item.adminUid === adminUid && item.activityId) {
              activityMap.set(item.activityId, {
                ...item,
                computedStatus: computeActivityStatus(item)
              });
            }
          } catch {
            // Ignore
          }
        });

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const id = docSnap.id;
          const existing = activityMap.get(id);
          activityMap.set(id, {
            ...(existing || {}),
            ...data,
            activityId: id,
            computedStatus: computeActivityStatus(data)
          });
        });

        callback(Array.from(activityMap.values()));
      },
      (err) => {
        console.warn("Firestore subscribeAdminActivities notice:", err.message);
      }
    );
  } catch (err) {
    console.warn("Firestore subscribeAdminActivities setup error:", err.message);
    return () => {};
  }
};

/**
 * Security-checked Activity Deletion
 * @param {string} activityId 
 * @param {string} adminUid 
 */
export const deleteAdminActivity = async (activityId, adminUid) => {
  if (!activityId || !adminUid) return;

  // Clear local cache
  localStorage.removeItem(`quizora_activity_${activityId}`);

  try {
    const docRef = doc(db, 'activities', activityId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.adminUid !== adminUid) {
        throw new Error("Unauthorized: You can only delete your own activities.");
      }
      await deleteDoc(docRef);
    }
  } catch (err) {
    console.warn("Firestore deleteAdminActivity notice:", err.message);
  }
};

/**
 * Clones an existing activity into a new draft with fresh activityId
 * @param {object} sourceActivity 
 * @param {string} adminUid 
 * @returns {Promise<object>} Duplicated activity payload
 */
export const duplicateAdminActivity = async (sourceActivity, adminUid) => {
  if (!sourceActivity || !adminUid) throw new Error("Invalid parameters");
  if (sourceActivity.adminUid !== adminUid) {
    throw new Error("Unauthorized: You can only duplicate your own activities.");
  }

  const newId = generateActivityId();
  const now = new Date().toISOString();

  const clonedPayload = {
    ...sourceActivity,
    activityId: newId,
    title: `${sourceActivity.title || 'Activity'} (Copy)`,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    shareUrl: `${window.location.origin}/activity/${newId}`
  };

  try {
    localStorage.setItem(`quizora_activity_${newId}`, JSON.stringify(clonedPayload));
  } catch {
    // Ignore cache error
  }

  try {
    const docRef = doc(db, 'activities', newId);
    await setDoc(docRef, clonedPayload);
  } catch (err) {
    console.warn("Firestore duplicateAdminActivity notice:", err.message);
  }

  return clonedPayload;
};

/**
 * Fetch all student submissions for activities created by current Admin
 * @param {string} adminUid 
 * @returns {Promise<Array>}
 */
export const getAdminSubmissions = async (adminUid) => {
  if (!adminUid) return [];

  const submissions = [];
  const localKeys = Object.keys(localStorage).filter((k) => k.startsWith('quizora_sub_'));

  localKeys.forEach((key) => {
    try {
      const item = JSON.parse(localStorage.getItem(key) || '{}');
      if (item.adminUid === adminUid) {
        submissions.push(item);
      }
    } catch {
      // Ignore
    }
  });

  try {
    const q = query(collection(db, 'submissions'), where('adminUid', '==', adminUid));
    const snap = await getDocs(q);
    const firestoreSubmissions = [];

    snap.forEach((docSnap) => {
      firestoreSubmissions.push({
        ...docSnap.data(),
        submissionId: docSnap.id
      });
    });

    if (firestoreSubmissions.length > 0) {
      return firestoreSubmissions;
    }
  } catch (err) {
    console.warn("Firestore getAdminSubmissions notice:", err.message);
  }

  return submissions;
};

/**
 * Save checking results and feedback for a submission
 * @param {string} submissionId 
 * @param {object} checkPayload 
 * @returns {Promise<object>}
 */
export const saveSubmissionGrade = async (submissionId, checkPayload) => {
  if (!submissionId) throw new Error("Submission ID is required");

  const now = new Date().toISOString();
  const finalPayload = {
    ...checkPayload,
    submissionId,
    status: 'Checked',
    checkedAt: now
  };

  try {
    localStorage.setItem(`quizora_sub_${submissionId}`, JSON.stringify(finalPayload));
  } catch {
    // Ignore
  }

  try {
    const docRef = doc(db, 'submissions', submissionId);
    await setDoc(docRef, finalPayload, { merge: true });
  } catch (err) {
    console.warn("Firestore saveSubmissionGrade notice:", err.message);
  }

  return finalPayload;
};
