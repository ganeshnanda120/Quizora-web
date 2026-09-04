import { useState } from 'react';

const COMMON_PRESETS = [
  'Name',
  'Class',
  'Department',
  'Email Address',
  'Registration Number',
  'Roll Number',
  'Section',
  'Student ID'
];

export default function Step4ParticipantForm({
  formData,
  updateFormData,
  onNext,
  onBack,
  onResetQuestions,
  saving
}) {
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewTestValues, setPreviewTestValues] = useState({});

  // Custom Field / Edit Modal State
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [editingFieldIndex, setEditingFieldIndex] = useState(null);
  const [customLabel, setCustomLabel] = useState('');
  const [customError, setCustomError] = useState('');

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState(null);

  // All fields start with isOptional: false (unchecked) by default
  const participantFields = formData.participantForm || [
    { id: 'field_name', label: 'Name', isOptional: false, required: true }
  ];

  const handleFieldChange = (index, key, value) => {
    setError('');
    const updated = [...participantFields];
    updated[index] = { ...updated[index], [key]: value };
    updateFormData({ participantForm: updated });
  };

  const handleToggleOptional = (index, isOptional) => {
    setError('');
    const updated = [...participantFields];
    updated[index] = {
      ...updated[index],
      isOptional: isOptional,
      required: !isOptional
    };
    updateFormData({ participantForm: updated });
  };

  // Add preset field (Unchecked Optional by default)
  const handleAddPreset = (presetName) => {
    setError('');
    const exists = participantFields.some(
      (f) => f.label.trim().toLowerCase() === presetName.trim().toLowerCase()
    );

    if (exists) {
      setError(`"${presetName}" already exists in the participant form.`);
      return;
    }

    const uniqueId = `field_${Date.now()}_${presetName.toLowerCase().replace(/\s+/g, '_')}`;
    const newField = {
      id: uniqueId,
      label: presetName,
      isOptional: false,
      required: true
    };

    updateFormData({ participantForm: [...participantFields, newField] });
  };

  // Open Custom Field Modal (for Creating new)
  const handleOpenCustomModal = () => {
    setError('');
    setEditingFieldIndex(null);
    setCustomLabel('');
    setCustomError('');
    setShowCustomModal(true);
  };

  // Open Modal to Edit existing field
  const handleOpenEditModal = (index) => {
    setError('');
    const field = participantFields[index];
    if (!field) return;
    setEditingFieldIndex(index);
    setCustomLabel(field.label || '');
    setCustomError('');
    setShowCustomModal(true);
  };

  // Save Custom Field (Create or Update)
  const handleSaveCustomField = (e) => {
    e.preventDefault();
    setCustomError('');

    const trimmedLabel = customLabel.trim();
    if (!trimmedLabel) {
      setCustomError('Field name is required.');
      return;
    }

    // Check for duplicate field name (case-insensitive) excluding the current editing index
    const alreadyExists = participantFields.some(
      (f, idx) => idx !== editingFieldIndex && f.label.trim().toLowerCase() === trimmedLabel.toLowerCase()
    );

    if (alreadyExists) {
      setCustomError('This field already exists. Please use a different name.');
      return;
    }

    if (editingFieldIndex !== null && editingFieldIndex >= 0) {
      // Editing existing field name
      const updated = [...participantFields];
      updated[editingFieldIndex] = {
        ...updated[editingFieldIndex],
        label: trimmedLabel
      };
      updateFormData({ participantForm: updated });
    } else {
      // Creating new custom field (optional is false by default, can be toggled on card)
      const uniqueId = `field_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;
      const newCustomField = {
        id: uniqueId,
        label: trimmedLabel,
        isOptional: false,
        required: true,
        isCustom: true
      };
      updateFormData({ participantForm: [...participantFields, newCustomField] });
    }

    setShowCustomModal(false);
    setEditingFieldIndex(null);
  };

  // Request field deletion
  const handleRequestDelete = (index) => {
    setError('');
    setDeleteTargetIndex(index);
    setShowDeleteModal(true);
  };

  // Confirm field deletion
  const handleConfirmDelete = () => {
    if (deleteTargetIndex !== null && deleteTargetIndex >= 0) {
      const updated = participantFields.filter((_, i) => i !== deleteTargetIndex);
      updateFormData({ participantForm: updated });
    }
    setShowDeleteModal(false);
    setDeleteTargetIndex(null);
  };

  const handleConfirmCancel = () => {
    setShowCancelModal(false);
    if (onResetQuestions) {
      onResetQuestions();
    } else if (onBack) {
      onBack();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Check if form has at least one field
    if (participantFields.length === 0) {
      setError('At least one participant form field is required to proceed.');
      return;
    }

    // Check empty field labels
    const hasEmptyLabels = participantFields.some((f) => !f.label || !f.label.trim());
    if (hasEmptyLabels) {
      setError('All participant form fields must have a valid label name.');
      return;
    }

    onNext();
  };

  const targetFieldToDelete = deleteTargetIndex !== null ? participantFields[deleteTargetIndex] : null;

  return (
    <form onSubmit={handleSubmit} className="wizard-step-container fade-in">
      {/* Cancel Participant Form Confirmation Dialog Modal */}
      {showCancelModal && (
        <div className="modal-backdrop" onClick={() => setShowCancelModal(false)}>
          <div className="modal-card small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar flex-between">
              <h4 className="modal-title-text text-danger font-bold">⚠️ Confirm Cancel & Reset</h4>
              <button type="button" className="modal-close-btn" onClick={() => setShowCancelModal(false)}>×</button>
            </div>
            <div className="modal-body-content py-3">
              <p className="text-sm font-semibold mb-2" style={{ color: '#0f172a' }}>
                Are you sure you want to cancel?
              </p>
              <p className="text-xs text-muted">
                Canceling will <strong>reset and delete all configured questions and participant form fields</strong> set for this activity and return you to Basic Info.
              </p>
            </div>
            <div className="modal-footer-bar flex-end gap-2 pt-3 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCancelModal(false)}
              >
                No, Stay Here
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleConfirmCancel}
              >
                Yes, Cancel & Reset All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Custom Field Create / Edit Modal */}
      {showCustomModal && (
        <div className="modal-backdrop" onClick={() => setShowCustomModal(false)}>
          <div className="modal-card small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar flex-between">
              <h4 className="modal-title-text font-bold text-dark">
                {editingFieldIndex !== null ? 'Edit Field' : '+ Add Custom Field'}
              </h4>
              <button type="button" className="modal-close-btn" onClick={() => setShowCustomModal(false)}>×</button>
            </div>

            <div className="modal-body-content py-3">
              {customError && (
                <div className="alert alert-error mb-3 py-2 px-3 text-xs">
                  <span>{customError}</span>
                </div>
              )}

              <div className="form-group mb-0">
                <label className="form-label font-semibold text-sm" htmlFor="custom-field-name">
                  Field Name <span className="req-star">*</span>
                </label>
                <input
                  type="text"
                  id="custom-field-name"
                  className="form-input"
                  placeholder="e.g. Parent Name, Phone Number, Semester..."
                  value={customLabel}
                  onChange={(e) => {
                    setCustomError('');
                    setCustomLabel(e.target.value);
                  }}
                  autoFocus
                />
              </div>
            </div>

            <div className="modal-footer-bar flex-end gap-2 pt-3 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCustomModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveCustomField}
              >
                {editingFieldIndex !== null ? 'Save Changes' : 'Add Field'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Delete Field Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-card small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar flex-between">
              <h4 className="modal-title-text text-danger font-bold">Remove this field?</h4>
              <button type="button" className="modal-close-btn" onClick={() => setShowDeleteModal(false)}>×</button>
            </div>

            <div className="modal-body-content py-3">
              <p className="text-sm font-semibold mb-2" style={{ color: '#0f172a' }}>
                Are you sure you want to remove <strong>"{targetFieldToDelete?.label}"</strong> from the participant details form?
              </p>
              <p className="text-xs text-muted m-0">
                Participants will no longer be asked to provide this detail for this activity.
              </p>
            </div>

            <div className="modal-footer-bar flex-end gap-2 pt-3 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleConfirmDelete}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="wizard-step-header flex-between align-center flex-wrap gap-3">
        <div>
          <h2 className="wizard-step-title">Participant Details Form</h2>
          <p className="wizard-step-subtitle">
            Define the identification details that students must provide before taking or submitting this activity. Check "Optional" for any field you wish to make optional.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-preview-toggle"
          onClick={() => {
            setPreviewTestValues({});
            setShowPreviewModal(true);
          }}
          title="Preview form as it appears on the student screen"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>Preview Form</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <svg className="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Quick Add Presets Section */}
      <div className="form-card-section">
        <h3 className="section-subtitle">Quick Add Presets</h3>
        <p className="text-xs text-muted" style={{ marginBottom: '22px' }}>
          Click any preset below to quickly append it to your form fields, or create a custom field.
        </p>
        <div className="preset-chips">
          {COMMON_PRESETS.map((preset) => {
            const alreadyExists = participantFields.some(
              (f) => f.label.trim().toLowerCase() === preset.trim().toLowerCase()
            );
            return (
              <button
                key={preset}
                type="button"
                className={`preset-chip ${alreadyExists ? 'disabled' : ''}`}
                disabled={alreadyExists}
                onClick={() => handleAddPreset(preset)}
                title={alreadyExists ? 'Already added' : `Add ${preset}`}
              >
                + {preset}
              </button>
            );
          })}

          {/* Custom field preset button with icon */}
          <button
            type="button"
            className="preset-chip custom-preset-chip"
            onClick={handleOpenCustomModal}
            title="Add Custom Field"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: '4px', verticalAlign: '-1px' }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Custom
          </button>
        </div>
      </div>

      {/* Form Fields List Section */}
      <div className="form-card-section">
        <div className="flex-between align-center flex-wrap gap-2" style={{ marginBottom: '24px' }}>
          <div>
            <h3 className="section-subtitle m-0">Form Fields ({participantFields.length})</h3>
            <span className="text-xs text-muted block mt-1">
              Check "Optional" for any detail you wish to make optional. Unchecked fields are mandatory for participants.
            </span>
          </div>
        </div>

        <div className="participant-fields-list">
          {participantFields.length === 0 ? (
            <div className="text-center py-4 px-3" style={{ background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: '8px' }}>
              <p className="text-sm font-semibold text-muted m-0">
                No form fields added. Please add at least one field from the presets above or create a custom field.
              </p>
            </div>
          ) : (
            participantFields.map((field, index) => {
              const isFieldOptional = field.isOptional === true;
              return (
                <div key={field.id || index} className="participant-field-card">
                <div className="field-card-main">
                  <span className="field-index-badge">{index + 1}</span>
                  <div className="field-name-display-wrapper flex-align-center">
                    <span className="field-static-name font-bold text-dark text-base">{field.label}</span>
                    {field.isCustom && <span className="custom-pill ml-2">Custom</span>}
                  </div>
                </div>

                <div className="field-card-controls">
                  {/* Optional Checkbox Toggle */}
                  <label className="checkbox-toggle-label cursor-pointer select-none" title={isFieldOptional ? 'Field is optional' : 'Field is required'}>
                    <input
                      type="checkbox"
                      className="field-checkbox-input"
                      checked={isFieldOptional}
                      onChange={(e) => handleToggleOptional(index, e.target.checked)}
                    />
                    <span className={`toggle-option-text ${isFieldOptional ? 'text-dark font-semibold' : 'text-primary font-bold'}`}>
                      Optional
                    </span>
                  </label>

                  {/* Edit button for custom added fields */}
                  {field.isCustom && (
                    <button
                      type="button"
                      className="btn-edit-field-icon"
                      onClick={() => handleOpenEditModal(index)}
                      title={`Edit ${field.label}`}
                      aria-label={`Edit ${field.label}`}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  )}

                  {/* Delete button */}
                  <button
                    type="button"
                    className="btn-delete-field-icon"
                    onClick={() => handleRequestDelete(index)}
                    title={`Delete ${field.label}`}
                    aria-label={`Delete ${field.label}`}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>

      {/* Actions Bar */}
      <div className="wizard-actions-bar">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setShowCancelModal(true)}
          disabled={saving}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? (
            <div className="spinner-container">
              <div className="spinner"></div>
              <span>Finalizing Activity...</span>
            </div>
          ) : (
            <span>Complete &amp; Generate Link &rarr;</span>
          )}
        </button>
      </div>

      {/* STUDENT PARTICIPANT FORM PREVIEW MODAL */}
      {showPreviewModal && (
        <div className="modal-backdrop preview-modal-backdrop" onClick={() => setShowPreviewModal(false)}>
          <div className="modal-card wide-modal admin-preview-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="preview-modal-header flex-between align-center">
              <div className="preview-header-info">
                <span className="preview-mode-tag">👁️ ADMIN PREVIEW MODE</span>
                <h3 className="preview-activity-title font-bold text-lg text-dark mt-1">
                  Participant Details Screen
                </h3>
                <span className="text-xs text-muted block mt-1">
                  This is the exact form students will see before entering the activity.
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm flex-align-center gap-1"
                onClick={() => setShowPreviewModal(false)}
              >
                <span>&times; Close Preview</span>
              </button>
            </div>

            <div className="preview-modal-body modal-body-scroll">
              <div className="student-form-preview-card p-6 bg-white border rounded-xl shadow-sm max-w-lg mx-auto">
                <div className="student-preview-brand-header text-center mb-5">
                  <span className="badge badge-primary text-xs uppercase font-bold tracking-wider mb-2 inline-block">
                    Participant Identification
                  </span>
                  <h3 className="text-xl font-bold text-dark m-0">Enter Your Details</h3>
                  <p className="text-xs text-muted mt-1">
                    Please provide your details below to start attending this {formData?.purpose || 'activity'}.
                  </p>
                </div>

                <div className="student-preview-fields-stack flex flex-col gap-4">
                  {participantFields.length === 0 ? (
                    <p className="text-sm text-muted text-center py-4">No fields configured.</p>
                  ) : (
                    participantFields.map((field, idx) => {
                      const isRequired = field.isOptional !== true;
                      return (
                        <div key={field.id || idx} className="form-group mb-0">
                          <label className="form-label font-semibold text-sm flex-between align-center mb-1">
                            <span>
                              {field.label || `Field ${idx + 1}`}
                              {isRequired && <span className="req-star ml-1 text-danger font-bold">*</span>}
                            </span>
                            {!isRequired && (
                              <span className="badge badge-secondary text-xs font-normal">Optional</span>
                            )}
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder={`Enter ${field.label.toLowerCase()}...`}
                            value={previewTestValues[field.id || idx] || ''}
                            onChange={(e) => {
                              setPreviewTestValues((prev) => ({
                                ...prev,
                                [field.id || idx]: e.target.value
                              }));
                            }}
                          />
                        </div>
                      );
                    })
                  )}

                  <div className="preview-notice-box p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-primary flex-align-center gap-2 mt-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>Only fields with red asterisks (*) are mandatory. Optional details can be skipped.</span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-lg w-full mt-3"
                    onClick={() => {
                      alert('Interactive Preview: In live mode, clicking this button will validate the mandatory fields and immediately open the questions interface.');
                    }}
                  >
                    <span>Continue to Activity &rarr;</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer-bar flex-between align-center pt-3 border-top">
              <span className="text-xs text-muted">
                Admins can test typing values in preview mode.
              </span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowPreviewModal(false)}
              >
                Done Previewing
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
