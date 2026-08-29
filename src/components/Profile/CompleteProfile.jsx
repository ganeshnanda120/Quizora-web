import { useState, useEffect } from 'react';
import { saveUserProfile } from '../../services/userService';
import logoImg from '../../assets/logo.png';

const GENDER_OPTIONS = [
  'Male',
  'Female',
  'Other',
  'Prefer not to say'
];

export default function CompleteProfile({ user, initialProfile, onComplete }) {
  const [fullName, setFullName] = useState(initialProfile?.fullName || user?.displayName || '');
  const [gender, setGender] = useState(initialProfile?.gender || 'Male');
  const [dateOfBirth, setDateOfBirth] = useState(initialProfile?.dateOfBirth || '');
  
  const [selectedFile, setSelectedFile] = useState(null);

  // Fallback photo priority:
  // 1. Newly selected file preview blob
  // 2. Initial profile photoURL (if already saved in Firestore)
  // 3. Firebase Auth photoURL (e.g. Google profile picture)
  const initialPhoto = initialProfile?.photoURL || user?.photoURL || '';
  const [previewUrl, setPreviewUrl] = useState(initialPhoto);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Cleanup object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (selectedFile && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [selectedFile, previewUrl]);

  // Restrict date picker to today
  const todayStr = new Date().toISOString().split('T')[0];

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    // Requirement 2: JPG/JPEG, PNG, WEBP. Reject videos or non-image files.
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setError('Please select a valid image format (JPG, JPEG, PNG, or WEBP). Videos and non-image files are not supported.');
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

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    // Fallback: initial profile photo, Firebase Auth photo, or empty (initials)
    setPreviewUrl(initialProfile?.photoURL || user?.photoURL || '');
  };

  // Validation checks
  const isNameValid = fullName.trim().length >= 1;
  const isGenderValid = GENDER_OPTIONS.includes(gender);
  const isDobValid = dateOfBirth.length > 0 && dateOfBirth <= todayStr;

  const isFormValid = isNameValid && isGenderValid && isDobValid;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    setLoading(true);
    setError('');

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
        createdAt: initialProfile?.createdAt || now,
        updatedAt: now
      };

      // Save to Firebase Storage (only if selectedFile exists) and update Firestore in single write
      const savedData = await saveUserProfile(
        user.uid,
        profilePayload,
        selectedFile,
        user?.photoURL || ''
      );

      // Pass savedData to parent to navigate to Dashboard immediately
      if (onComplete) {
        onComplete(savedData);
      }
    } catch (err) {
      console.error("Save profile error:", err);
      setError(err.message || 'Failed to save profile. Please try again.');
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
    <div className="auth-card profile-setup-card">
      <div className="auth-header">
        <div className="brand-badge logo-only">
          <img src={logoImg} alt="Logo" className="brand-logo-img" />
        </div>
        <h1 className="auth-title">Complete Your Profile</h1>
        <p className="auth-subtitle">
          Please fill in your basic details to unlock full access to your workspace.
        </p>
      </div>

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

      <form onSubmit={handleSubmit} className="auth-form profile-form">
        {/* Profile Picture (Optional) */}
        <div className="profile-pic-section">
          <div className="avatar-preview-container">
            <div 
              className="avatar-preview-wrapper"
              onClick={() => document.getElementById('profile-upload')?.click()}
              title="Click to choose profile picture"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Profile Preview" className="avatar-preview-img" />
              ) : (
                <div className="avatar-preview-fallback">
                  {getInitials(fullName)}
                </div>
              )}
              <div className="avatar-upload-badge" title="Choose photo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            </div>

            <div className="avatar-controls-box">
              <input
                type="file"
                id="profile-upload"
                accept="image/jpeg, image/jpg, image/png, image/webp"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
              <div className="avatar-action-buttons">
                <button
                  type="button"
                  className="btn-upload-photo"
                  onClick={() => document.getElementById('profile-upload')?.click()}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span>{selectedFile || previewUrl ? 'Change Photo' : 'Choose Photo'}</span>
                </button>

                {(selectedFile || (previewUrl && previewUrl !== user?.photoURL)) && (
                  <button 
                    type="button" 
                    className="btn-remove-photo" 
                    onClick={handleRemovePhoto}
                    title="Remove photo"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    <span>Remove</span>
                  </button>
                )}
              </div>
              <span className="file-hint">JPG, PNG or WEBP (Max 5MB)</span>
            </div>
          </div>
        </div>

        {/* Full Name */}
        <div className="form-group">
          <label className="form-label" htmlFor="fullName">
            Full Name <span className="req-star">*</span>
          </label>
          <div className="input-wrapper">
            <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <input
              type="text"
              id="fullName"
              className="form-input"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          {!isNameValid && fullName.length > 0 && (
            <span className="field-error-text">Full name cannot be empty.</span>
          )}
        </div>

        {/* Gender Select */}
        <div className="form-group">
          <label className="form-label" htmlFor="gender">
            Gender <span className="req-star">*</span>
          </label>
          <div className="input-wrapper">
            <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v8M8 12h8"/>
            </svg>
            <select
              id="gender"
              className="form-input select-input"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              required
            >
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date of Birth */}
        <div className="form-group">
          <label className="form-label" htmlFor="dateOfBirth">
            Date of Birth <span className="req-star">*</span>
          </label>
          <div className="input-wrapper">
            <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <input
              type="date"
              id="dateOfBirth"
              className="form-input"
              max={todayStr}
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              required
            />
          </div>
          {dateOfBirth > todayStr && (
            <span className="field-error-text">Date of birth cannot be in the future.</span>
          )}
        </div>

        {/* Continue / Save Button */}
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
            <span>Continue</span>
          )}
        </button>
      </form>
    </div>
  );
}
