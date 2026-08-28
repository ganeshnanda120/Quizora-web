import { useState, useEffect } from 'react';
import { saveUserProfile } from '../../services/userService';

const GENDER_OPTIONS = [
  'Male',
  'Female',
  'Other',
  'Prefer not to say'
];

export default function ProfileModal({ user, profileData, initialMode = 'view', onClose, onProfileUpdated, onLogout }) {
  const [mode, setMode] = useState(initialMode); // 'view' or 'edit'

  const [fullName, setFullName] = useState(profileData?.fullName || user?.displayName || '');
  const [gender, setGender] = useState(profileData?.gender || 'Male');
  const [dateOfBirth, setDateOfBirth] = useState(profileData?.dateOfBirth || '');
  
  const [selectedFile, setSelectedFile] = useState(null);

  // Fallback photo priority:
  // 1. User uploaded custom photo (profileData.photoURL)
  // 2. Firebase Auth photoURL (e.g. Google photo)
  const initialPhoto = profileData?.photoURL || user?.photoURL || '';
  const [previewUrl, setPreviewUrl] = useState(initialPhoto);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Clean object URLs
  useEffect(() => {
    return () => {
      if (selectedFile && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [selectedFile, previewUrl]);

  const todayStr = new Date().toISOString().split('T')[0];

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setError('Please select a valid image file (JPG, JPEG, PNG, or WEBP). Videos and non-image files are not supported.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image file size must be less than 10MB.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleRemoveCustomPhoto = () => {
    setSelectedFile(null);
    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    // Fall back to Auth photoURL if available
    setPreviewUrl(user?.photoURL || '');
  };

  const isNameValid = fullName.trim().length >= 1;
  const isGenderValid = GENDER_OPTIONS.includes(gender);
  const isDobValid = dateOfBirth.length > 0 && dateOfBirth <= todayStr;
  const isFormValid = isNameValid && isGenderValid && isDobValid;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const now = new Date().toISOString();
      const cleanName = fullName.trim();
      const initialPhoto = previewUrl.startsWith('blob:') ? '' : previewUrl;

      const profilePayload = {
        uid: user.uid,
        email: user.email,
        fullName: cleanName,
        gender,
        dateOfBirth,
        photoURL: initialPhoto,
        profileCompleted: true,
        createdAt: profileData?.createdAt || now,
        updatedAt: now
      };

      const savedData = await saveUserProfile(
        user.uid,
        profilePayload,
        selectedFile,
        user?.photoURL || ''
      );

      setSuccessMsg('Profile updated successfully!');
      
      if (onProfileUpdated) {
        onProfileUpdated(savedData);
      }

      setPreviewUrl(savedData.photoURL || user?.photoURL || '');
      setSelectedFile(null);
      setMode('view');
      setLoading(false);

    } catch (err) {
      console.error("Update profile error:", err);
      setError(err.message || 'Failed to update profile.');
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'Q';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0] ? parts[0].slice(0, 2).toUpperCase() : 'Q';
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="profile-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <svg className="modal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <h2>{mode === 'edit' ? 'Edit Profile' : 'Profile Details'}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="alert alert-error">
            <svg className="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert alert-success">
            <svg className="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body Content */}
        {mode === 'view' ? (
          <div className="profile-view-body">
            <div className="profile-avatar-block">
              {previewUrl ? (
                <img src={previewUrl} alt={fullName} className="profile-avatar-large" />
              ) : (
                <div className="profile-avatar-fallback">
                  {getInitials(fullName)}
                </div>
              )}
              <h3 className="profile-view-name">{fullName || 'Quizora User'}</h3>
              <span className="profile-view-email">{user?.email}</span>
            </div>

            <div className="profile-info-grid">
              <div className="info-item">
                <span className="info-label">Full Name</span>
                <span className="info-value">{fullName || 'Not provided'}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Email Address</span>
                <span className="info-value">{user?.email}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Gender</span>
                <span className="info-value">{profileData?.gender || gender || 'Not provided'}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Date of Birth</span>
                <span className="info-value">{dateOfBirth || 'Not provided'}</span>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={() => setMode('edit')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                <span>Edit Profile</span>
              </button>
              {onLogout && (
                <button className="btn btn-ghost danger" onClick={onLogout}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  <span>Logout</span>
                </button>
              )}
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="profile-edit-form">
            <div className="profile-pic-section">
              <div className="avatar-preview-wrapper">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="avatar-preview-img" />
                ) : (
                  <div className="avatar-preview-fallback">{getInitials(fullName)}</div>
                )}
                <label htmlFor="edit-profile-upload" className="avatar-upload-badge" title="Change Photo">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </label>
              </div>

              <div className="file-upload-action">
                <input
                  type="file"
                  id="edit-profile-upload"
                  accept="image/jpeg, image/jpg, image/png, image/webp"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
                <div className="avatar-action-buttons">
                  <label htmlFor="edit-profile-upload" className="btn btn-secondary btn-sm upload-btn">
                    <span>{previewUrl ? 'Change Photo' : 'Upload Photo'}</span>
                  </label>
                  {(selectedFile || (previewUrl && previewUrl !== user?.photoURL)) && (
                    <button type="button" className="btn btn-ghost btn-sm remove-photo-btn" onClick={handleRemoveCustomPhoto}>
                      Remove Custom Photo
                    </button>
                  )}
                </div>
                <span className="file-hint">JPG, JPEG, PNG or WEBP</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-fullName">Full Name</label>
              <input
                type="text"
                id="edit-fullName"
                className="form-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email (Read Only)</label>
              <input
                type="email"
                className="form-input"
                value={user?.email || ''}
                disabled
                style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-gender">Gender</label>
              <select
                id="edit-gender"
                className="form-input select-input"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                required
              >
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-dob">Date of Birth</label>
              <input
                type="date"
                id="edit-dob"
                className="form-input"
                max={todayStr}
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
              />
            </div>

            <div className="modal-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!isFormValid || loading}
              >
                {loading ? (
                  <div className="spinner-container">
                    <div className="spinner"></div>
                    <span>Saving...</span>
                  </div>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setMode('view')}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
