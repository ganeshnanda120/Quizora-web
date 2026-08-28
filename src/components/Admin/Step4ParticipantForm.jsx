import { useState } from 'react';

const COMMON_PRESETS = [
  'Roll Number',
  'Registration Number',
  'Class',
  'Section',
  'Student ID',
  'Email Address',
  'Department'
];

export default function Step4ParticipantForm({
  formData,
  updateFormData,
  onNext,
  onBack,
  onResetAndBack,
  saving
}) {
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  const participantFields = formData.participantForm || [
    { id: 'field_name', label: 'Name', required: true, isDefault: true }
  ];

  const handleFieldChange = (index, key, value) => {
    setError('');
    const updated = [...participantFields];
    updated[index] = { ...updated[index], [key]: value };
    updateFormData({ participantForm: updated });
  };

  const handleAddField = (presetName = '') => {
    setError('');
    const fieldIndex = participantFields.length + 1;
    const newField = {
      id: `field_${fieldIndex}_${presetName ? presetName.toLowerCase().replace(/\s+/g, '_') : 'custom'}`,
      label: presetName || `Field ${fieldIndex}`,
      required: true,
      isDefault: false
    };
    updateFormData({ participantForm: [...participantFields, newField] });
  };

  const handleDeleteField = (index) => {
    setError('');
    if (participantFields[index].isDefault) {
      setError('The "Name" field is required by default for participant identification.');
      return;
    }
    const updated = participantFields.filter((_, i) => i !== index);
    updateFormData({ participantForm: updated });
  };

  const handleCancelClick = () => {
    setShowCancelModal(true);
  };

  const handleConfirmResetAndBack = () => {
    setShowCancelModal(false);
    if (onResetAndBack) {
      onResetAndBack();
    } else if (onBack) {
      onBack();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Check empty field labels
    const hasEmptyLabels = participantFields.some((f) => !f.label || !f.label.trim());
    if (hasEmptyLabels) {
      setError('All participant form fields must have a valid label name.');
      return;
    }

    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="wizard-step-container fade-in">
      {/* Confirmation Modal when clicking Cancel / Back */}
      {showCancelModal && (
        <div className="modal-backdrop" onClick={() => setShowCancelModal(false)}>
          <div className="modal-card small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar flex-between">
              <h4 className="modal-title-text text-danger font-bold">⚠️ Confirm Reset & Cancel</h4>
              <button type="button" className="modal-close-btn" onClick={() => setShowCancelModal(false)}>×</button>
            </div>
            <div className="modal-body-content py-3">
              <p className="text-sm font-semibold mb-2" style={{ color: '#0f172a' }}>
                Are you sure you want to cancel and go back?
              </p>
              <p className="text-xs text-muted">
                Going back from Participant Form will <strong>reset and delete all configured questions</strong> for this activity. You will have to set up your questions again from scratch.
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
                onClick={handleConfirmResetAndBack}
              >
                Yes, Reset Questions & Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="wizard-step-header">
        <h2 className="wizard-step-title">Participant Details Form</h2>
        <p className="wizard-step-subtitle">
          Define the identification details that students must provide before taking or submitting this activity.
        </p>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <svg className="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Preset Quick Add Buttons */}
      <div className="form-card-section">
        <h3 className="section-subtitle">Quick Add Presets</h3>
        <div className="preset-chips">
          {COMMON_PRESETS.map((preset) => {
            const alreadyExists = participantFields.some(
              (f) => f.label.toLowerCase() === preset.toLowerCase()
            );
            return (
              <button
                key={preset}
                type="button"
                className={`preset-chip ${alreadyExists ? 'disabled' : ''}`}
                disabled={alreadyExists}
                onClick={() => handleAddField(preset)}
              >
                + {preset}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fields List */}
      <div className="form-card-section">
        <div className="flex-between mb-3">
          <h3 className="section-subtitle">Form Fields ({participantFields.length})</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleAddField('')}>
            + Add User Detail
          </button>
        </div>

        <div className="participant-fields-list">
          {participantFields.map((field, index) => (
            <div key={field.id || index} className="participant-field-card">
              <div className="field-card-main">
                <span className="field-index-badge">{index + 1}</span>
                <div className="field-name-input-wrapper">
                  <input
                    type="text"
                    className="form-input"
                    value={field.label}
                    onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                    placeholder="Field Name (e.g. Roll Number)"
                    disabled={field.isDefault}
                    required
                  />
                  {field.isDefault && <span className="default-pill">Default Required</span>}
                </div>
              </div>

              <div className="field-card-controls">
                <label className="checkbox-toggle-label">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => handleFieldChange(index, 'required', e.target.checked)}
                    disabled={field.isDefault}
                  />
                  <span>Required</span>
                </label>

                {!field.isDefault && (
                  <button
                    type="button"
                    className="btn btn-ghost danger btn-sm"
                    onClick={() => handleDeleteField(index)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions Bar */}
      <div className="wizard-actions-bar">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleCancelClick}
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
    </form>
  );
}
