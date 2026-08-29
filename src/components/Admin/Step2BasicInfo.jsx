import { useState } from 'react';

const TIME_CONFIG_OPTIONS = [
  { id: 'start_on_begin', label: 'Start when user begins' },
  { id: 'start_on_share', label: 'Start immediately when link is shared' },
  { id: 'individual_question', label: 'Individual question time' },
  { id: 'no_limit', label: 'No time limit until final date' }
];

const PURPOSE_OPTIONS = ['Exam', 'Assignment', 'Custom', 'Other'];

export default function Step2BasicInfo({
  formData,
  updateFormData,
  onNext,
  onBack,
  saving
}) {
  const [errors, setErrors] = useState({});
  const [editingTitleIdx, setEditingTitleIdx] = useState(null);
  const [tempTitle, setTempTitle] = useState('');
  const [editError, setEditError] = useState('');
  const [deleteConfirmIdx, setDeleteConfirmIdx] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Helper for current ISO datetime string formatted for datetime-local input
  const getMinStartDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const handleInputChange = (field, value) => {
    setErrors((prev) => ({ ...prev, [field]: '', totalMarks: '', parts: '' }));
    updateFormData({ [field]: value });
  };

  const parts = formData.parts || [
    {
      id: 'part_1',
      title: 'Part 1',
      partTotalMarks: '',
      individualStartTime: '',
      individualEndTime: '',
      questions: []
    }
  ];

  // Helper for part field updates
  const handlePartChange = (index, key, value) => {
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[`part_${index}_start`];
      delete copy[`part_${index}_end`];
      delete copy[`part_${index}_marks`];
      delete copy.parts;
      return copy;
    });

    const updatedParts = [...parts];
    updatedParts[index] = { ...updatedParts[index], [key]: value };
    updateFormData({ parts: updatedParts });
  };

  // Add a new part
  const handleAddPart = () => {
    setErrors((prev) => ({ ...prev, parts: '' }));
    const currentParts = formData.parts || [];
    const newPartNum = currentParts.length + 1;
    const newPart = {
      id: `part_${Date.now()}_${newPartNum}`,
      title: `Part ${newPartNum}`,
      partTotalMarks: '',
      individualStartTime: '',
      individualEndTime: '',
      questions: []
    };
    const updated = [...currentParts, newPart];
    updateFormData({
      isMultiPart: updated.length > 1,
      parts: updated
    });
  };

  // Confirm delete part and renumber default part titles
  const confirmDeletePart = (index) => {
    if (parts.length <= 1) {
      setErrors((prev) => ({ ...prev, parts: 'Activity must contain at least 1 part.' }));
      setDeleteConfirmIdx(null);
      return;
    }

    const filtered = parts.filter((_, i) => i !== index);

    // Automatically renumber default "Part X" titles
    const renumbered = filtered.map((part, idx) => {
      const isDefaultName = /^Part\s+\d+$/i.test((part.title || '').trim());
      return {
        ...part,
        title: isDefaultName ? `Part ${idx + 1}` : part.title
      };
    });

    updateFormData({
      isMultiPart: renumbered.length > 1,
      parts: renumbered
    });

    setDeleteConfirmIdx(null);
    if (editingTitleIdx === index) {
      setEditingTitleIdx(null);
    }
  };

  // Save edited part title
  const handleSaveTitle = (index) => {
    if (!tempTitle || !tempTitle.trim()) {
      setEditError('Part name cannot be empty.');
      return;
    }
    handlePartChange(index, 'title', tempTitle.trim());
    setEditingTitleIdx(null);
    setEditError('');
  };

  // Validate Step 2 fields
  const validateForm = () => {
    const newErrors = {};

    if (!formData.title || !formData.title.trim()) {
      newErrors.title = 'Title is required.';
    }

    if (formData.purpose === 'Exam') {
      if (!formData.totalMarks || Number(formData.totalMarks) <= 0) {
        newErrors.totalMarks = 'Total Marks is compulsory for Exam.';
      }
    }

    if (!formData.startTime) {
      newErrors.startTime = 'Starting Date & Time is required.';
    }

    if (!formData.endTime) {
      newErrors.endTime = 'Ending Date & Time is required.';
    }

    if (formData.startTime && formData.endTime) {
      const mainStart = new Date(formData.startTime);
      const mainEnd = new Date(formData.endTime);

      if (mainEnd <= mainStart) {
        newErrors.endTime = 'Main ending time must be strictly after starting time.';
      }

      // Validate Option C (individualTime) for parts when 2+ parts exist
      if (parts.length >= 2 && formData.partNavigationMode === 'individualTime') {
        parts.forEach((p, idx) => {
          if (!p.individualStartTime) {
            newErrors[`part_${idx}_start`] = `Part ${idx + 1} start time is required.`;
          }
          if (!p.individualEndTime) {
            newErrors[`part_${idx}_end`] = `Part ${idx + 1} end time is required.`;
          }

          if (p.individualStartTime && p.individualEndTime) {
            const partStart = new Date(p.individualStartTime);
            const partEnd = new Date(p.individualEndTime);

            if (partEnd <= partStart) {
              newErrors[`part_${idx}_end`] = `Part ${idx + 1} end time must be after its start time.`;
            }

            // Individual part time MUST ALWAYS be inside or equal to Main Activity boundaries
            if (partStart < mainStart || partStart > mainEnd) {
              newErrors[`part_${idx}_start`] = `Part ${idx + 1} start time must be within main activity schedule.`;
            }

            if (partEnd < mainStart || partEnd > mainEnd) {
              newErrors[`part_${idx}_end`] = `Part ${idx + 1} end time must be within main activity schedule.`;
            }
          }
        });
      }
    }

    // Validate Part Total Marks sum vs Main Total Marks if 2+ parts and main totalMarks is provided
    if (parts.length >= 2 && formData.totalMarks && Number(formData.totalMarks) > 0) {
      const mainTotal = Number(formData.totalMarks);
      const sumPartMarks = parts.reduce((acc, p) => acc + (Number(p.partTotalMarks) || 0), 0);

      if (sumPartMarks !== mainTotal) {
        newErrors.parts = `The sum of part marks (${sumPartMarks} pts) must equal the main total marks (${mainTotal} pts).`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onNext();
    }
  };

  const minStartStr = getMinStartDateTime();

  return (
    <form onSubmit={handleSubmit} className="wizard-step-container fade-in">
      <div className="wizard-step-header">
        <h2 className="wizard-step-title">Activity Basic Information</h2>
        <p className="wizard-step-subtitle">
          Configure title, main activity schedule, total marks, evaluation rules, and part navigation.
        </p>
      </div>

      {/* Delete Part Confirmation Dialog Modal */}
      {deleteConfirmIdx !== null && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirmIdx(null)}>
          <div className="modal-card small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar flex-between">
              <h4 className="modal-title-text">Confirm Delete Part</h4>
              <button type="button" className="modal-close-btn" onClick={() => setDeleteConfirmIdx(null)}>×</button>
            </div>
            <div className="modal-body-content py-3">
              <p>
                Are you sure you want to delete <strong>{parts[deleteConfirmIdx]?.title || `Part ${deleteConfirmIdx + 1}`}</strong>?
              </p>
            </div>
            <div className="modal-footer-bar flex-end gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirmIdx(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => confirmDeletePart(deleteConfirmIdx)}>
                Delete Part
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Basic Info Section */}
      <div className="form-card-section">
        <h3 className="section-subtitle">Basic Information</h3>

        <div className="form-grid-2">
          {/* Institution Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="institutionName">
              Institution / Organization / Company Name <span className="optional-tag">(Optional)</span>
            </label>
            <input
              type="text"
              id="institutionName"
              className="form-input"
              placeholder="e.g. Stanford University or Quizora Academy"
              value={formData.institutionName || ''}
              onChange={(e) => handleInputChange('institutionName', e.target.value)}
            />
          </div>

          {/* Admin Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="adminName">
              Admin Name <span className="req-star">*</span>
            </label>
            <input
              type="text"
              id="adminName"
              className="form-input"
              value={formData.adminName || ''}
              onChange={(e) => handleInputChange('adminName', e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-grid-3">
          {/* Purpose */}
          <div className="form-group">
            <label className="form-label" htmlFor="purpose">
              Purpose <span className="req-star">*</span>
            </label>
            <select
              id="purpose"
              className="form-input select-input"
              value={formData.purpose || 'Exam'}
              onChange={(e) => handleInputChange('purpose', e.target.value)}
              required
            >
              {PURPOSE_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="form-group col-span-2">
            <label className="form-label" htmlFor="title">
              Title <span className="req-star">*</span>
            </label>
            <input
              type="text"
              id="title"
              className="form-input"
              placeholder="e.g. Midterm Physics Assessment 2026"
              value={formData.title || ''}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
            />
            {errors.title && <span className="field-error-text">{errors.title}</span>}
          </div>
        </div>

        {/* Subject & Total Marks side by side */}
        <div className="form-grid-2">
          {/* Subject */}
          <div className="form-group">
            <label className="form-label" htmlFor="subject">
              Subject <span className="optional-tag">(Optional)</span>
            </label>
            <input
              type="text"
              id="subject"
              className="form-input"
              placeholder="e.g. Mathematics, Science, General Knowledge"
              value={formData.subject || ''}
              onChange={(e) => handleInputChange('subject', e.target.value)}
            />
          </div>

          {/* Total Marks */}
          <div className="form-group">
            <label className="form-label" htmlFor="totalMarks">
              Total Marks {formData.purpose === 'Exam' ? <span className="req-star">*</span> : <span className="optional-tag">(Optional)</span>}
            </label>
            <input
              type="text"
              id="totalMarks"
              className="form-input mcq-marks-input"
              inputMode="decimal"
              placeholder={formData.purpose === 'Exam' ? 'e.g. 100' : 'e.g. 100 (Optional)'}
              value={formData.totalMarks || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  handleInputChange('totalMarks', val);
                }
              }}
              required={formData.purpose === 'Exam'}
            />
            {errors.totalMarks && <span className="field-error-text">{errors.totalMarks}</span>}
          </div>
        </div>
      </div>

      {/* Main Start and End Time Schedule */}
      <div className="form-card-section">
        <h3 className="section-subtitle">Main Activity Schedule</h3>
        <p className="field-hint schedule-field-hint">
          Main activity schedule controls overall availability. Individual part times (if configured) must fall inside this schedule.
        </p>

        <div className="main-schedule-row">
          <div className="form-group schedule-input-group">
            <label className="form-label" htmlFor="startTime">
              Starting Date & Time <span className="req-star">*</span>
            </label>
            <input
              type="datetime-local"
              id="startTime"
              className="form-input schedule-datetime-input"
              min={minStartStr}
              value={formData.startTime || ''}
              onChange={(e) => handleInputChange('startTime', e.target.value)}
              required
            />
            {errors.startTime && <span className="field-error-text">{errors.startTime}</span>}
          </div>

          <div className="form-group schedule-input-group">
            <label className="form-label" htmlFor="endTime">
              Ending Date & Time <span className="req-star">*</span>
            </label>
            <input
              type="datetime-local"
              id="endTime"
              className="form-input schedule-datetime-input"
              min={formData.startTime || minStartStr}
              value={formData.endTime || ''}
              onChange={(e) => handleInputChange('endTime', e.target.value)}
              required
            />
            {errors.endTime && <span className="field-error-text">{errors.endTime}</span>}
          </div>
        </div>
      </div>

      {/* REDESIGNED PART CONFIGURATION SECTION */}
      <div className="form-card-section part-config-main-wrapper">
        <h3 className="section-subtitle mb-3">Part Configuration</h3>

        {/* GLOBAL PART NAVIGATION CONFIGURATION (Shown ONLY when 2 or more parts exist) */}
        {parts.length >= 2 && (
          <div className="global-part-nav-card p-4 mb-4 rounded border bg-light">
            <h4 className="global-nav-title font-bold text-dark mb-4">
              Part Navigation Configuration
            </h4>

            <div className="radio-options-vertical">
              {/* Option A (Default) */}
              <label className="radio-option-card">
                <input
                  type="radio"
                  name="partNavigationMode"
                  value="sequential"
                  checked={(formData.partNavigationMode || 'sequential') === 'sequential'}
                  onChange={(e) => handleInputChange('partNavigationMode', e.target.value)}
                />
                <span className="radio-label text-dark text-sm">
                  <strong>Start next part after completing previous part</strong>
                </span>
              </label>

              {/* Option B */}
              <label className="radio-option-card">
                <input
                  type="radio"
                  name="partNavigationMode"
                  value="free"
                  checked={formData.partNavigationMode === 'free'}
                  onChange={(e) => handleInputChange('partNavigationMode', e.target.value)}
                />
                <span className="radio-label text-dark text-sm">
                  <strong>Allow user to move to next part before completing previous part</strong>
                </span>
              </label>

              {/* Option C */}
              <label className="radio-option-card">
                <input
                  type="radio"
                  name="partNavigationMode"
                  value="individualTime"
                  checked={formData.partNavigationMode === 'individualTime'}
                  onChange={(e) => handleInputChange('partNavigationMode', e.target.value)}
                />
                <span className="radio-label text-dark text-sm">
                  <strong>Set individual time for each part</strong>
                </span>
              </label>
            </div>
          </div>
        )}

        {errors.parts && <span className="field-error-text mb-3 block">{errors.parts}</span>}

        {/* PARTS LIST (Each Part rendered inside its OWN compact card/box) */}
        <div className="parts-container-list">
          {parts.map((part, index) => {
            const isEditing = editingTitleIdx === index;
            const showIndividualTime = parts.length >= 2 && formData.partNavigationMode === 'individualTime';

            return (
              <div key={part.id || index} className="part-card-box compact-part-card">
                {/* Part Card Header Row */}
                <div className="part-card-header flex-between align-center">
                  {/* Left Side: Part Name / Edit Inputs */}
                  <div className="part-title-wrapper">
                    {isEditing ? (
                      <div className="part-edit-inline-row">
                        <input
                          type="text"
                          className="form-input part-title-input"
                          value={tempTitle}
                          onChange={(e) => {
                            setEditError('');
                            setTempTitle(e.target.value);
                          }}
                          placeholder="Part Name (e.g. Physics, Section A)"
                          autoFocus
                        />
                        <div className="part-edit-btn-group">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm btn-save-part"
                            onClick={() => handleSaveTitle(index)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-cancel-part"
                            onClick={() => {
                              setEditingTitleIdx(null);
                              setEditError('');
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="part-title-display flex-align-center gap-3">
                        <span className="part-name-heading font-bold text-dark text-base">
                          {part.title || `Part ${index + 1}`}
                        </span>
                        {/* Change Name Button Placed directly to the right of Part Name */}
                        <button
                          type="button"
                          className="btn-part-action btn-edit-part"
                          onClick={() => {
                            setEditingTitleIdx(index);
                            setTempTitle(part.title || `Part ${index + 1}`);
                            setEditError('');
                          }}
                          title="Change Part Name"
                          aria-label="Change Part Name"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                          <span>Change Name</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Far-Right Side: Delete Action Button (ONLY when 2+ parts exist) */}
                  {!isEditing && parts.length > 1 && (
                    <div className="part-card-actions-right">
                      <button
                        type="button"
                        className="btn-part-action btn-delete-icon-only"
                        onClick={() => setDeleteConfirmIdx(index)}
                        title="Delete Part"
                        aria-label="Delete Part"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {editError && isEditing && (
                  <span className="field-error-text mt-2 block">{editError}</span>
                )}

                {/* Below Part Name: Part Marks on Left, and Individual Time on Right (when Option C is active) */}
                {(parts.length >= 2 || showIndividualTime) && (
                  <div className="part-config-details-row mt-3 pt-3 border-top">
                    {/* Part Marks on Left */}
                    {parts.length >= 2 && (
                      <div className="part-marks-field-box">
                        <label className="form-label text-xs font-semibold">
                          Part Marks <span className="optional-tag font-normal">(Out of {formData.totalMarks || 'Main Total'})</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          className="form-input form-input-sm part-marks-input-sm"
                          placeholder="e.g. 50"
                          value={part.partTotalMarks || ''}
                          onChange={(e) => handlePartChange(index, 'partTotalMarks', e.target.value)}
                        />
                      </div>
                    )}

                    {/* Individual Time on Right (when Option C is active) */}
                    {showIndividualTime && (
                      <div className="part-inline-time-container">
                        <div className="part-time-field">
                          <label className="form-label text-xs">
                            Start: <span className="req-star">*</span>
                          </label>
                          <input
                            type="datetime-local"
                            className="form-input form-input-sm part-time-input-sm"
                            value={part.individualStartTime || ''}
                            min={formData.startTime || minStartStr}
                            max={formData.endTime || undefined}
                            onChange={(e) => handlePartChange(index, 'individualStartTime', e.target.value)}
                            required
                          />
                          {errors[`part_${index}_start`] && (
                            <span className="field-error-text mt-1">{errors[`part_${index}_start`]}</span>
                          )}
                        </div>

                        <div className="part-time-field">
                          <label className="form-label text-xs">
                            End: <span className="req-star">*</span>
                          </label>
                          <input
                            type="datetime-local"
                            className="form-input form-input-sm part-time-input-sm"
                            value={part.individualEndTime || ''}
                            min={part.individualStartTime || formData.startTime || minStartStr}
                            max={formData.endTime || undefined}
                            onChange={(e) => handlePartChange(index, 'individualEndTime', e.target.value)}
                            required
                          />
                          {errors[`part_${index}_end`] && (
                            <span className="field-error-text mt-1">{errors[`part_${index}_end`]}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* + ADD MORE PART BUTTON (Single plus icon & label) */}
        <div className="mt-3 text-left">
          <button
            type="button"
            className="btn btn-add-part-colored"
            onClick={handleAddPart}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add More Part</span>
          </button>
        </div>
      </div>

      {/* Time & Attempt Rules */}
      <div className="form-card-section">
        <h3 className="section-subtitle">Time & Attempt Rules</h3>

        <div className="time-config-options">
          {TIME_CONFIG_OPTIONS.map((opt) => (
            <label key={opt.id} className="radio-option-card mb-2">
              <input
                type="radio"
                name="timeConfiguration"
                value={opt.id}
                checked={formData.timeConfiguration === opt.id}
                onChange={(e) => handleInputChange('timeConfiguration', e.target.value)}
              />
              <span className="radio-label text-dark text-sm">
                <strong>{opt.label}</strong>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Access Controls & Security */}
      <div className="form-card-section">
        <h3 className="section-subtitle">Access & Participant Controls</h3>

        <div className="access-controls-row">
          {/* Password (Optional) */}
          <div className="form-group access-control-input-group">
            <label className="form-label" htmlFor="password">
              Password Protection <span className="optional-tag">(Optional)</span>
            </label>
            <input
              type="password"
              id="password"
              className="form-input access-control-input"
              placeholder="Leave blank for no password"
              value={formData.password || ''}
              onChange={(e) => handleInputChange('password', e.target.value)}
            />
          </div>

          {/* Number of Participants */}
          <div className="form-group access-control-input-group">
            <label className="form-label" htmlFor="participantLimit">
              Number of Participants <span className="optional-tag">(Optional, empty = unlimited)</span>
            </label>
            <input
              type="number"
              id="participantLimit"
              className="form-input access-control-input"
              placeholder="e.g. 50"
              min="1"
              value={formData.participantLimit || ''}
              onChange={(e) => handleInputChange('participantLimit', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* DEDICATED AUTO-GRADING & EVALUATION RULES BOX (Placed at the Very End) */}
      <div className="form-card-section evaluation-rules-box">
        <h3 className="section-subtitle">Auto-Grading & Evaluation Rules</h3>

        {/* 1. Auto-Grade MCQ Toggle */}
        <div className="toggle-switch-row mb-3">
          <div className="toggle-info">
            <span className="toggle-title">Auto-grade Multiple Choice Questions (MCQ)</span>
            <span className="toggle-desc">Automatically calculate marks for correct MCQ selections upon submission.</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={!!formData.autoGradeMCQ}
              onChange={(e) => handleInputChange('autoGradeMCQ', e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>

        {/* 2. Negative Marking (-ve Marking) */}
        <div className="toggle-switch-row mb-3 pt-3 border-top">
          <div className="toggle-info">
            <span className="toggle-title">Enable Negative Marking (-ve Marking)</span>
            <span className="toggle-desc">Deduct marks for incorrect MCQ answers.</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={!!formData.enableNegativeMarking}
              onChange={(e) => handleInputChange('enableNegativeMarking', e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>

        {formData.enableNegativeMarking && (
          <div className="negative-marking-inputs p-3 bg-light rounded mb-3 border">
            <div className="form-group mb-0">
              <label className="form-label text-xs font-semibold">
                Negative Marks per Wrong Answer (e.g. 0.25, 0.5, 1.0)
              </label>
              <input
                type="text"
                className="form-input mcq-marks-input"
                inputMode="decimal"
                placeholder="0.25"
                value={formData.negativeMarkValue || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    handleInputChange('negativeMarkValue', val);
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* 3. Show Percentage */}
        <div className="toggle-switch-row pt-3 border-top">
          <div className="toggle-info">
            <span className="toggle-title">Show Percentage Score</span>
            <span className="toggle-desc">Calculate and display percentage score on student scorecard and results breakdown.</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={!!formData.showPercentageScore}
              onChange={(e) => handleInputChange('showPercentageScore', e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      {/* Cancel Basic Info Confirmation Dialog Modal */}
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
                Canceling will <strong>reset all basic information, schedule, and details set so far</strong> for this activity and return you to the Admin Dashboard.
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
                onClick={() => {
                  setShowCancelModal(false);
                  if (onBack) onBack();
                }}
              >
                Yes, Cancel & Reset All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
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
              <span>Saving Draft...</span>
            </div>
          ) : (
            <span>Move to Questions &rarr;</span>
          )}
        </button>
      </div>
    </form>
  );
}
