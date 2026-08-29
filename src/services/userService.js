import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

/**
 * Checks if a profile object is complete and valid.
 * Supports various naming conventions (web, mobile, flutter, firestore).
 * @param {object|null} data 
 * @returns {boolean}
 */
export const checkIsProfileComplete = (data) => {
  if (!data || typeof data !== 'object') return false;

  // 1. Check explicit completion flags
  if (
    data.profileCompleted === true ||
    data.isProfileCompleted === true ||
    data.profile_completed === true ||
    data.is_profile_completed === true ||
    data.isCompleted === true ||
    data.completed === true ||
    data.profileCompleted === 'true'
  ) {
    return true;
  }

  // 2. Check if required fields exist and are non-empty
  const name = (data.fullName || data.name || data.full_name || data.displayName || '').trim();
  const gender = (data.gender || '').trim();
  const dob = (data.dateOfBirth || data.dob || data.date_of_birth || data.birthDate || '').trim();

  // If user has a name and either gender or date of birth filled, profile is considered complete
  if (name.length > 0 && (gender.length > 0 || dob.length > 0)) {
    return true;
  }

  return false;
};

/**
 * Normalizes user profile data across various schema formats
 * @param {string} uid 
 * @param {object} data 
 * @returns {object}
 */
export const normalizeUserProfile = (uid, data = {}) => {
  if (!data) return null;

  const isComplete = checkIsProfileComplete(data);
  const name = data.fullName || data.name || data.full_name || data.displayName || '';
  const email = data.email || '';
  const gender = data.gender || 'Prefer not to say';
  const dob = data.dateOfBirth || data.dob || data.date_of_birth || data.birthDate || '';
  const photo = data.photoURL || data.profileImageUrl || data.photo_url || data.avatar || data.avatarUrl || '';

  return {
    ...data,
    uid: data.uid || uid,
    fullName: name,
    name: name,
    email: email,
    gender: gender,
    dateOfBirth: dob,
    dob: dob,
    photoURL: photo,
    profileImageUrl: photo,
    profileCompleted: isComplete,
    isProfileCompleted: isComplete,
    profile_completed: isComplete,
    createdAt: data.createdAt || data.created_at || new Date().toISOString(),
    updatedAt: data.updatedAt || data.updated_at || new Date().toISOString()
  };
};

/**
 * Client-side image compressor that resizes images to max 600px dimension and converts to JPEG blob
 * @param {File} file 
 * @param {number} maxDimension 
 * @param {number} quality 
 * @returns {Promise<File|Blob>}
 */
export const compressImageFile = (file, maxDimension = 600, quality = 0.85) => {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width <= maxDimension && height <= maxDimension && file.size < 500 * 1024) {
          return resolve(file);
        }

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], 'profile.jpg', {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

/**
 * Fetch user profile from Firestore users/{uid} with local cache fallback
 * @param {string} uid 
 * @returns {Promise<{exists: boolean, data: object|null}>}
 */
export const getUserProfile = async (uid) => {
  if (!uid) return { exists: false, data: null };

  const localKey = `quizora_user_${uid}`;
  let localData = null;
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      localData = normalizeUserProfile(uid, parsed);
    }
  } catch {
    // Ignore JSON parse error
  }

  try {
    // 1. Check 'users' collection (standard Firestore path)
    const userDocRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const remoteData = normalizeUserProfile(uid, docSnap.data());
      try {
        localStorage.setItem(localKey, JSON.stringify(remoteData));
      } catch {
        // Ignore quota error
      }
      return { exists: true, data: remoteData };
    }

    // 2. Fallback check for capitalized 'Users' collection if applicable
    try {
      const altDocRef = doc(db, 'Users', uid);
      const altSnap = await getDoc(altDocRef);
      if (altSnap.exists()) {
        const remoteData = normalizeUserProfile(uid, altSnap.data());
        try {
          localStorage.setItem(localKey, JSON.stringify(remoteData));
        } catch {
          // Ignore quota error
        }
        return { exists: true, data: remoteData };
      }
    } catch {
      // Ignore
    }

    // 3. Fallback to local cache if Firestore returned empty but local profile exists
    if (localData) {
      return { exists: true, data: localData };
    }

    return { exists: false, data: null };
  } catch (error) {
    console.warn("Firestore getUserProfile notice:", error.message);
    if (localData) {
      return { exists: true, data: localData };
    }
    return { exists: false, data: null };
  }
};

/**
 * Upload profile picture to Firebase Storage at profilePictures/{uid}/profile.jpg
 * @param {string} uid 
 * @param {File} file 
 * @returns {Promise<string>} download URL or fallback Data URL
 */
export const uploadProfileImage = async (uid, file) => {
  if (!file || !uid) return null;

  try {
    const compressedFile = await compressImageFile(file, 600, 0.85);
    const storageRef = ref(storage, `profilePictures/${uid}/profile.jpg`);
    const snapshot = await uploadBytes(storageRef, compressedFile);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (err) {
    console.warn("Firebase Storage upload notice (falling back to local preview Data URL):", err.message);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }
};

/**
 * Create or update user profile in Firestore in a single write operation.
 * @param {string} uid 
 * @param {object} profileData 
 * @param {File|null} imageFile 
 * @param {string|null} fallbackPhotoURL 
 * @returns {Promise<object>} updated profile payload
 */
export const saveUserProfile = async (uid, profileData, imageFile = null, fallbackPhotoURL = '') => {
  if (!uid) throw new Error("User ID is required");

  let photoURL = profileData.photoURL || profileData.profileImageUrl || fallbackPhotoURL || '';

  // Only upload to Firebase Storage if an explicit image file was selected by the user
  if (imageFile) {
    try {
      const uploadedURL = await uploadProfileImage(uid, imageFile);
      if (uploadedURL) photoURL = uploadedURL;
    } catch (err) {
      console.warn("Profile image upload notice:", err);
    }
  }

  const cleanFullName = (profileData.fullName || profileData.name || '').trim();
  const now = new Date().toISOString();

  const userPayload = {
    uid,
    fullName: cleanFullName,
    name: cleanFullName,
    email: profileData.email || '',
    gender: profileData.gender || 'Prefer not to say',
    dateOfBirth: profileData.dateOfBirth || profileData.dob || '',
    dob: profileData.dateOfBirth || profileData.dob || '',
    photoURL: photoURL || '',
    profileImageUrl: photoURL || '',
    profileCompleted: true,
    isProfileCompleted: true,
    profile_completed: true,
    updatedAt: now
  };

  if (profileData.createdAt || profileData.created_at) {
    userPayload.createdAt = profileData.createdAt || profileData.created_at;
  } else {
    userPayload.createdAt = now;
  }

  // Update local storage for instant offline resilience
  try {
    localStorage.setItem(`quizora_user_${uid}`, JSON.stringify(userPayload));
  } catch {
    // Ignore quota errors
  }

  // Write to Firestore with merge to protect existing user fields
  try {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, userPayload, { merge: true });
  } catch (error) {
    console.warn("Firestore save permission notice (using local profile cache):", error.message);
  }

  return normalizeUserProfile(uid, userPayload);
};
