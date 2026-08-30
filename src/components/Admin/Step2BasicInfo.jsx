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

  // Sections / Groups state
  const partMode = formData.partMode || 'parts'; // 'parts' | 'sections'
  const [deleteSectionConfirmIdx, setDeleteSectionConfirmIdx] = useState(null);

  // Section Part editing states
  const [editingSecPartIdx, setEditingSecPartIdx] = useState(null); // { secIdx, partIdx }
  const [tempSecPartTitle, setTempSecPartTitle] = useState('');
  const [editSecPartError, setEditSecPartError] = useState('');
  const [deleteSecPartConfirm, setDeleteSecPartConfirm] = useState(null); // { secIdx, partIdx }

  // Helper for current ISO datetime string formatted for datetime-local input
  const getMinStartDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const handleInputChange = (field, value) => {
    setErrors((prev) => ({ ...prev, [field]: '', totalMarks: '', parts: '', sections: '' }));
    updateFormData({ [field]: value });
  };

  // Normal Parts (Tab 1)
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

  // Helper to construct 2 default sections
  const createDefaultTwoSections = () => [
    {
      id: 'sec_default_1',
      name: '',
      totalMarks: '',
      partNavigationMode: 'sequential',
      isMultiPart: false,
      parts: [
        {
          id: 'sec_default_1_p_1',
          title: 'Part 1',
          partTotalMarks: '',
          individualStartTime: '',
          individualEndTime: '',
          questions: []
        }
      ]
    },
    {
      id: 'sec_default_2',
      name: '',
      totalMarks: '',
      partNavigationMode: 'sequential',
      isMultiPart: false,
      parts: [
        {
          id: 'sec_default_2_p_1',
          title: 'Part 1',
          partTotalMarks: '',
          individualStartTime: '',
          individualEndTime: '',
          questions: []
        }
      ]
    }
  ];

  // Sections (Tab 2)
  const sections = formData.sections && formData.sections.length > 0
    ? formData.sections
    : [];

  const handleTabSwitch = (newMode) => {
    setErrors((prev) => ({ ...prev, parts: '', sections: '' }));
    if (newMode === 'sections') {
      const existing = formData.sections || [];
      if (existing.length < 2) {
        let updatedSecs = [...existing];
        while (updatedSecs.length < 2) {
          const sIdx = updatedSecs.length + 1;
          updatedSecs.push({
            id: `sec_${Date.now()}_${sIdx}`,
            name: '',
            totalMarks: '',
            partNavigationMode: 'sequential',
            isMultiPart: false,
            parts: [
              {
                id: `sec_${sIdx}_p_1_${Date.now()}`,
                title: 'Part 1',
                partTotalMarks: '',
                individualStartTime: '',
                individualEndTime: '',
                questions: []
              }
            ]
          });
        }
        updateFormData({ partMode: newMode, sections: updatedSecs });
      } else {
        updateFormData({ partMode: newMode });
      }
    } else {
      updateFormData({ partMode: newMode });
    }
  };

  // Helper for part field updates (Tab 1)
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

  // Add a new part (Tab 1)
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

  // Confirm delete part and renumber default part titles (Tab 1)
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

  // Save edited part title (Tab 1)
  const handleSaveTitle = (index) => {
    if (!tempTitle || !tempTitle.trim()) {
      setEditError('Part name cannot be empty.');
      return;
    }
    handlePartChange(index, 'title', tempTitle.trim());
    setEditingTitleIdx(null);
    setEditError('');
  };

  // ==========================================
  // SECTION / GROUP HANDLERS (Tab 2)
  // ==========================================

  // Update Section Name inline
  const handleSectionNameChange = (sIdx, value) => {
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[`sec_${sIdx}_name`];
      delete copy.sections;
      return copy;
    });

    const currentSecs = sections.length > 0 ? sections : createDefaultTwoSections();
    const updated = [...currentSecs];
    updated[sIdx] = {
      ...updated[sIdx],
      name: value
    };
    updateFormData({ sections: updated });
  };

  // Update Section Total Marks
  const handleSectionTotalMarksChange = (sIdx, value) => {
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[`sec_${sIdx}_totalMarks`];
      delete copy[`sec_${sIdx}_parts`];
      delete copy.sections;
      return copy;
    });

    const currentSecs = sections.length > 0 ? sections : createDefaultTwoSections();
    const updated = [...currentSecs];
    updated[sIdx] = {
      ...updated[sIdx],
      totalMarks: value
    };
    updateFormData({ sections: updated });
  };

  // Add new Section / Group (Section 3, Section 4, etc.)
  const handleAddNewSection = () => {
    setErrors((prev) => ({ ...prev, sections: '' }));
    const currentSecs = sections.length > 0 ? sections : createDefaultTwoSections();
    const newSecIdx = currentSecs.length + 1;
    const newSection = {
      id: `sec_${newSecIdx}_${Math.random().toString(36).substring(2, 7)}`,
      name: '',
      totalMarks: '',
      partNavigationMode: 'sequential',
      isMultiPart: false,
      parts: [
        {
          id: `sec_${newSecIdx}_p_1_${Math.random().toString(36).substring(2, 7)}`,
          title: 'Part 1',
          partTotalMarks: '',
          individualStartTime: '',
          individualEndTime: '',
          questions: []
        }
      ]
    };

    const updated = [...currentSecs, newSection];
    updateFormData({ sections: updated });
  };

  // Confirm delete Section
  const confirmDeleteSection = (secIdx) => {
    const currentSecs = sections.length > 0 ? sections : createDefaultTwoSections();
    const filtered = currentSecs.filter((_, i) => i !== secIdx);
    updateFormData({ sections: filtered });
    setDeleteSectionConfirmIdx(null);
  };

  // Update Section navigation mode
  const handleSectionNavModeChange = (secIdx, mode) => {
    const currentSecs = sections.length > 0 ? sections : createDefaultTwoSections();
    const updated = [...currentSecs];
    updated[secIdx] = {
      ...updated[secIdx],
      partNavigationMode: mode
    };
    updateFormData({ sections: updated });
  };

  // Update part inside section
  const handleSectionPartChange = (secIdx, partIdx, key, value) => {
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[`sec_${secIdx}_part_${partIdx}_start`];
      delete copy[`sec_${secIdx}_part_${partIdx}_end`];
      delete copy[`sec_${secIdx}_part_${partIdx}_marks`];
      delete copy[`sec_${secIdx}_parts`];
      delete copy.sections;
      return copy;
    });

    const currentSecs = sections.length > 0 ? sections : createDefaultTwoSections();
    const updated = [...currentSecs];
    const secParts = [...(updated[secIdx]?.parts || [])];
    secParts[partIdx] = { ...secParts[partIdx], [key]: value };

    updated[secIdx] = {
      ...updated[secIdx],
      parts: secParts,
      isMultiPart: secParts.length > 1
    };

    updateFormData({ sections: updated });
  };

  // Add Part to Section
  const handleAddPartToSection = (secIdx) => {
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.sections;
      return copy;
    });

    const currentSecs = sections.length > 0 ? sections : createDefaultTwoSections();
    const updated = [...currentSecs];
    const currentSecParts = updated[secIdx]?.parts || [];
    const newPartNum = currentSecParts.length + 1;

    const newPart = {
      id: `sec_${secIdx + 1}_part_${newPartNum}_${Math.random().toString(36).substring(2, 7)}`,
      title: `Part ${newPartNum}`,
      partTotalMarks: '',
      individualStartTime: '',
      individualEndTime: '',
      questions: []
    };

    const updatedParts = [...currentSecParts, newPart];
    updated[secIdx] = {
      ...updated[secIdx],
      parts: updatedParts,
      isMultiPart: updatedParts.length > 1
    };

    updateFormData({ sections: updated });
  };

  // Confirm delete part from section
  const confirmDeletePartFromSection = (secIdx, partIdx) => {
    const currentSecs = sections.length > 0 ? sections : createDefaultTwoSections();
    const currentSec = currentSecs[secIdx];
    const secParts = currentSec?.parts || [];

    if (secParts.length <= 1) {
      setErrors((prev) => ({ ...prev, [`sec_${secIdx}_parts`]: 'Section must contain at least 1 part.' }));
      setDeleteSecPartConfirm(null);
      return;
    }

    const filtered = secParts.filter((_, i) => i !== partIdx);
    const renumbered = filtered.map((part, idx) => {
      const isDefaultName = /^Part\s+\d+$/i.test((part.title || '').trim());
      return {
        ...part,
        title: isDefaultName ? `Part ${idx + 1}` : part.title
      };
    });

    const updated = [...currentSecs];
    updated[secIdx] = {
      ...updated[secIdx],
      parts: renumbered,
      isMultiPart: renumbered.length > 1
    };

    updateFormData({ sections: updated });
    setDeleteSecPartConfirm(null);
    if (editingSecPartIdx?.secIdx === secIdx && editingSecPartIdx?.partIdx === partIdx) {
      setEditingSecPartIdx(null);
    }
  };

  // Save edited part title in section
  const handleSaveSecPartTitle = (secIdx, partIdx) => {
    if (!tempSecPartTitle || !tempSecPartTitle.trim()) {
      setEditSecPartError('Part name cannot be empty.');
      return;
    }

    handleSectionPartChange(secIdx, partIdx, 'title', tempSecPartTitle.trim());
    setEditingSecPartIdx(null);
    setEditSecPartError('');
  };

  // ==========================================
  // FORM VALIDATION
  // ==========================================
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

      // 1. VALIDATION FOR TAB 1 (Normal Parts)
      if (partMode === 'parts') {
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

              if (partStart < mainStart || partStart > mainEnd) {
                newErrors[`part_${idx}_start`] = `Part ${idx + 1} start time must be within main activity schedule.`;
              }

              if (partEnd < mainStart || partEnd > mainEnd) {
                newErrors[`part_${idx}_end`] = `Part ${idx + 1} end time must be within main activity schedule.`;
              }
            }
          });
        }

        // Validate Part Total Marks sum vs Main Total Marks if 2+ parts and main totalMarks is provided
        if (parts.length >= 2 && formData.totalMarks && Number(formData.totalMarks) > 0) {
          const mainTotal = Number(formData.totalMarks);
          const sumPartMarks = parts.reduce((acc, p) => acc + (Number(p.partTotalMarks) || 0), 0);

          if (sumPartMarks > 0 && sumPartMarks !== mainTotal) {
            newErrors.parts = `The sum of part marks (${sumPartMarks} pts) must equal the main total marks (${mainTotal} pts).`;
          }
        }
      }

      // 2. VALIDATION FOR TAB 2 (Sections / Groups)
      if (partMode === 'sections') {
        const activeSections = sections.length > 0 ? sections : createDefaultTwoSections();

        if (activeSections.length < 2) {
          newErrors.sections = 'At least 2 Sections / Groups (Section 1 and Section 2) are compulsory.';
        } else {
          activeSections.forEach((sec, sIdx) => {
            // Section Name (Compulsory)
            if (!sec.name || !sec.name.trim()) {
              newErrors[`sec_${sIdx}_name`] = 'Section/Group name is required.';
            }

            // Total Marks for Section (Compulsory)
            if (!sec.totalMarks || isNaN(Number(sec.totalMarks)) || Number(sec.totalMarks) <= 0) {
              newErrors[`sec_${sIdx}_totalMarks`] = 'Total Marks is compulsory for this section.';
            }

            const secParts = sec.parts || [];
            if (secParts.length === 0) {
              newErrors[`sec_${sIdx}_parts`] = `Section ${sIdx + 1} must contain at least 1 part.`;
            }

            // Part marks validation against Section Total Marks
            const secTotal = Number(sec.totalMarks);
            if (secTotal > 0 && secParts.length >= 1) {
              const sumPartMarks = secParts.reduce((acc, p) => acc + (Number(p.partTotalMarks) || 0), 0);
              const anyPartHasMarks = secParts.some((p) => p.partTotalMarks !== '' && p.partTotalMarks !== null && p.partTotalMarks !== undefined);

              if (sumPartMarks > secTotal) {
                newErrors[`sec_${sIdx}_parts`] = 'Total marks allocated to parts cannot exceed the section\'s total marks.';
              } else if (secParts.length > 1 && anyPartHasMarks && sumPartMarks !== secTotal) {
                newErrors[`sec_${sIdx}_parts`] = 'Part marks must equal the section\'s total marks.';
              }
            }

            // Validate individual part times if individualTime is selected for this section
            if (secParts.length >= 2 && sec.partNavigationMode === 'individualTime') {
              secParts.forEach((p, pIdx) => {
                if (!p.individualStartTime) {
                  newErrors[`sec_${sIdx}_part_${pIdx}_start`] = `Part ${pIdx + 1} start time is required.`;
                }
                if (!p.individualEndTime) {
                  newErrors[`sec_${sIdx}_part_${pIdx}_end`] = `Part ${pIdx + 1} end time is required.`;
                }

                if (p.individualStartTime && p.individualEndTime) {
                  const partStart = new Date(p.individualStartTime);
                  const partEnd = new Date(p.individualEndTime);

                  if (partEnd <= partStart) {
                    newErrors[`sec_${sIdx}_part_${pIdx}_end`] = `Part ${pIdx + 1} end time must be after its start time.`;
                  }

                  if (partStart < mainStart || partStart > mainEnd) {
                    newErrors[`sec_${sIdx}_part_${pIdx}_start`] = `Part ${pIdx + 1} start time must be within main activity schedule.`;
                  }

                  if (partEnd < mainStart || partEnd > mainEnd) {
                    newErrors[`sec_${sIdx}_part_${pIdx}_end`] = `Part ${pIdx + 1} end time must be within main activity schedule.`;
                  }
                }
              });
            }
          });
        }
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
  const currentSectionsList = sections.length > 0 ? sections : (partMode === 'sections' ? createDefaultTwoSections() : []);

  return (
    <form onSubmit={handleSubmit} className="wizard-step-container fade-in">
      <div className="wizard-step-header">
        <h2 className="wizard-step-title">Activity Basic Information</h2>
        <p className="wizard-step-subtitle">
          Configure title, main activity schedule, total marks, evaluation rules, and part navigation.
        </p>
      </div>

      {/* Delete Part Confirmation Dialog Modal (Tab 1) */}
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

      {/* Confirm Delete Section Modal (Tab 2) */}
      {deleteSectionConfirmIdx !== null && (
        <div className="modal-backdrop" onClick={() => setDeleteSectionConfirmIdx(null)}>
          <div className="modal-card small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar flex-between">
              <h4 className="modal-title-text text-danger">⚠️ Delete Section / Group</h4>
              <button type="button" className="modal-close-btn" onClick={() => setDeleteSectionConfirmIdx(null)}>×</button>
            </div>
            <div className="modal-body-content py-3">
              <p className="text-sm font-semibold mb-2">
                Are you sure you want to delete {currentSectionsList[deleteSectionConfirmIdx]?.name ? `section "${currentSectionsList[deleteSectionConfirmIdx]?.name}"` : `Section ${deleteSectionConfirmIdx + 1}`}?
              </p>
              <p className="text-xs text-muted">
                Deleting this section will permanently remove its configured parts and questions.
              </p>
            </div>
            <div className="modal-footer-bar flex-end gap-2 pt-3 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDeleteSectionConfirmIdx(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => confirmDeleteSection(deleteSectionConfirmIdx)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Part from Section Modal (Tab 2) */}
      {deleteSecPartConfirm !== null && (
        <div className="modal-backdrop" onClick={() => setDeleteSecPartConfirm(null)}>
          <div className="modal-card small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar flex-between">
              <h4 className="modal-title-text">Confirm Delete Part</h4>
              <button type="button" className="modal-close-btn" onClick={() => setDeleteSecPartConfirm(null)}>×</button>
            </div>
            <div className="modal-body-content py-3">
              <p>
                Are you sure you want to delete <strong>{currentSectionsList[deleteSecPartConfirm.secIdx]?.parts?.[deleteSecPartConfirm.partIdx]?.title || `Part ${deleteSecPartConfirm.partIdx + 1}`}</strong> from <strong>{currentSectionsList[deleteSecPartConfirm.secIdx]?.name || `Section ${deleteSecPartConfirm.secIdx + 1}`}</strong>?
              </p>
            </div>
            <div className="modal-footer-bar flex-end gap-2 pt-3 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDeleteSecPartConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => confirmDeletePartFromSection(deleteSecPartConfirm.secIdx, deleteSecPartConfirm.partIdx)}
              >
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

      {/* PART CONFIGURATION & SECTIONS / GROUPS MAIN SECTION */}
      <div className="form-card-section part-config-main-wrapper">
        {/* TABS AT TOP OF PART CONFIGURATION: 1. Part Configuration  2. Sections / Groups */}
        <div className="part-config-header-tabs-bar mb-4">
          <div className="part-config-nav-tabs">
            <button
              type="button"
              className={`part-tab-nav-btn ${partMode === 'parts' ? 'active' : ''}`}
              onClick={() => handleTabSwitch('parts')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Part Wise</span>
            </button>

            <button
              type="button"
              className={`part-tab-nav-btn ${partMode === 'sections' ? 'active' : ''}`}
              onClick={() => handleTabSwitch('sections')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Sections / Groups</span>
              {currentSectionsList.length > 0 && (
                <span className="tab-pill-badge">{currentSectionsList.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* TAB 1 CONTENT: STANDARD PART WISE */}
        {partMode === 'parts' && (
          <div className="tab-parts-content fade-in">
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

                    {/* Below Part Name: Part Marks, Start Time, End Time in a left-aligned responsive grid */}
                    {(parts.length >= 2 || showIndividualTime) && (
                      <div className="part-config-details-row mt-3 pt-3 border-top">
                        <div className="part-fields-responsive-grid">
                          {/* Part Marks */}
                          {parts.length >= 2 && (
                            <div className="part-field-col">
                              <label className="form-label text-xs font-semibold">
                                Part Marks <span className="optional-tag font-normal">(Out of {formData.totalMarks || 'Main Total'})</span>
                              </label>
                              <input
                                type="number"
                                min="1"
                                className="form-input form-input-sm"
                                placeholder="e.g. 50"
                                value={part.partTotalMarks || ''}
                                onChange={(e) => handlePartChange(index, 'partTotalMarks', e.target.value)}
                              />
                            </div>
                          )}

                          {/* Individual Time: Start Time */}
                          {showIndividualTime && (
                            <div className="part-field-col">
                              <label className="form-label text-xs font-semibold">
                                Start Time <span className="req-star">*</span>
                              </label>
                              <input
                                type="datetime-local"
                                className="form-input form-input-sm"
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
                          )}

                          {/* Individual Time: End Time */}
                          {showIndividualTime && (
                            <div className="part-field-col">
                              <label className="form-label text-xs font-semibold">
                                End Time <span className="req-star">*</span>
                              </label>
                              <input
                                type="datetime-local"
                                className="form-input form-input-sm"
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
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* + Add More Part button */}
            <div className="mt-3 text-left">
              <button
                type="button"
                className="btn btn-add-part-colored"
                onClick={handleAddPart}
              >
                <span className="btn-plus-icon">+</span>
                <span>Add More Part</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2 CONTENT: SECTIONS / GROUPS */}
        {partMode === 'sections' && (
          <div className="tab-sections-content fade-in">
            {errors.sections && (
              <div className="alert alert-error mb-4">
                <span>{errors.sections}</span>
              </div>
            )}

            {/* Vertical Stack of Section Cards (Section 1, Section 2, Section 3...) */}
            <div className="sections-list-stack">
              {currentSectionsList.map((sec, sIdx) => {
                const secParts = sec.parts || [];
                const showIndividualTime =
                  secParts.length >= 2 && sec.partNavigationMode === 'individualTime';

                return (
                  <div key={sec.id || sIdx} className="section-main-card">
                    {/* Visual Section Name Heading when entered */}
                    {sec.name?.trim() && (
                      <h4 className="section-card-active-title font-bold text-dark text-sm mb-3 pb-2 border-bottom flex-align-center gap-2">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="text-primary">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span>{sec.name.trim()}</span>
                      </h4>
                    )}

                    {/* Section Name & Total Marks in the SAME Row on desktop/tablet, stacked on mobile */}
                    <div className="section-name-marks-row">
                      {/* Section / Group Name (Compulsory) */}
                      <div className="form-group mb-0 sec-name-input-col">
                        <label className="form-label font-bold text-dark text-xs mb-1" htmlFor={`sec_name_${sIdx}`}>
                          Section / Group Name <span className="req-star">*</span>
                        </label>
                        <input
                          type="text"
                          id={`sec_name_${sIdx}`}
                          className={`form-input form-input-sm compact-input ${errors[`sec_${sIdx}_name`] ? 'input-error' : ''}`}
                          placeholder="e.g. Software Engineering"
                          value={sec.name || ''}
                          onChange={(e) => handleSectionNameChange(sIdx, e.target.value)}
                          required
                        />
                        {errors[`sec_${sIdx}_name`] && (
                          <span className="field-error-text mt-1 block text-xs">
                            {errors[`sec_${sIdx}_name`]}
                          </span>
                        )}
                      </div>

                      {/* Total Marks for Section (Compulsory) */}
                      <div className="form-group mb-0 sec-marks-input-col">
                        <label className="form-label font-bold text-dark text-xs mb-1" htmlFor={`sec_marks_${sIdx}`}>
                          Total Marks for Section <span className="req-star">*</span>
                        </label>
                        <input
                          type="number"
                          id={`sec_marks_${sIdx}`}
                          min="1"
                          className={`form-input form-input-sm compact-input ${errors[`sec_${sIdx}_totalMarks`] ? 'input-error' : ''}`}
                          placeholder="e.g. 100"
                          value={sec.totalMarks || ''}
                          onChange={(e) => handleSectionTotalMarksChange(sIdx, e.target.value)}
                          required
                        />
                        {errors[`sec_${sIdx}_totalMarks`] && (
                          <span className="field-error-text mt-1 block text-xs">
                            {errors[`sec_${sIdx}_totalMarks`]}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Visual Divider between Section Name/Total Marks and Part Wise */}
                    <div className="section-divider"></div>

                    {/* DEDICATED PART WISE FOR THIS SECTION */}
                    <div className="section-part-config-inner-box">
                      <div className="section-part-config-header">
                        <h5 className="section-part-config-title">
                          Part Wise
                        </h5>
                      </div>

                      {/* Navigation Mode Radio Cards (when this section has >= 2 parts) */}
                      {secParts.length >= 2 && (
                        <div className="global-part-nav-card p-3 mb-3 rounded border bg-white">
                          <h6 className="global-nav-title font-bold text-dark mb-2 text-xs uppercase tracking-wide">
                            Part Navigation Rules
                          </h6>

                          <div className="radio-options-vertical">
                            <label className="radio-option-card">
                              <input
                                type="radio"
                                name={`sec_${sIdx}_nav`}
                                value="sequential"
                                checked={(sec.partNavigationMode || 'sequential') === 'sequential'}
                                onChange={() => handleSectionNavModeChange(sIdx, 'sequential')}
                              />
                              <span className="radio-label text-dark text-xs">
                                <strong>Start next part after completing previous part</strong>
                              </span>
                            </label>

                            <label className="radio-option-card">
                              <input
                                type="radio"
                                name={`sec_${sIdx}_nav`}
                                value="free"
                                checked={sec.partNavigationMode === 'free'}
                                onChange={() => handleSectionNavModeChange(sIdx, 'free')}
                              />
                              <span className="radio-label text-dark text-xs">
                                <strong>Allow user to move to next part before completing previous part</strong>
                              </span>
                            </label>

                            <label className="radio-option-card">
                              <input
                                type="radio"
                                name={`sec_${sIdx}_nav`}
                                value="individualTime"
                                checked={sec.partNavigationMode === 'individualTime'}
                                onChange={() => handleSectionNavModeChange(sIdx, 'individualTime')}
                              />
                              <span className="radio-label text-dark text-xs">
                                <strong>Set individual time for each part</strong>
                              </span>
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Parts List inside this section */}
                      <div className="parts-container-list">
                        {secParts.map((part, pIdx) => {
                          const isEditingThisPart =
                            editingSecPartIdx?.secIdx === sIdx &&
                            editingSecPartIdx?.partIdx === pIdx;

                          return (
                            <div key={part.id || pIdx} className="part-card-box compact-part-card">
                              <div className="part-card-header flex-between align-center">
                                <div className="part-title-wrapper">
                                  {isEditingThisPart ? (
                                    <div className="part-edit-inline-row">
                                      <input
                                        type="text"
                                        className="form-input part-title-input"
                                        value={tempSecPartTitle}
                                        onChange={(e) => {
                                          setEditSecPartError('');
                                          setTempSecPartTitle(e.target.value);
                                        }}
                                        placeholder="Part Name"
                                        autoFocus
                                      />
                                      <div className="part-edit-btn-group">
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-sm btn-save-part"
                                          onClick={() => handleSaveSecPartTitle(sIdx, pIdx)}
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm btn-cancel-part"
                                          onClick={() => {
                                            setEditingSecPartIdx(null);
                                            setEditSecPartError('');
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="part-title-display flex-align-center gap-3">
                                      <span className="part-name-heading font-bold text-dark text-sm">
                                        {part.title || `Part ${pIdx + 1}`}
                                      </span>
                                      <button
                                        type="button"
                                        className="btn-part-action btn-edit-part"
                                        onClick={() => {
                                          setEditingSecPartIdx({ secIdx: sIdx, partIdx: pIdx });
                                          setTempSecPartTitle(part.title || `Part ${pIdx + 1}`);
                                          setEditSecPartError('');
                                        }}
                                        title="Change Part Name"
                                      >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                        <span>Change Name</span>
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Delete Part button (when > 1 part in section) */}
                                {!isEditingThisPart && secParts.length > 1 && (
                                  <div className="part-card-actions-right">
                                    <button
                                      type="button"
                                      className="btn-part-action btn-delete-icon-only"
                                      onClick={() => setDeleteSecPartConfirm({ secIdx: sIdx, partIdx: pIdx })}
                                      title="Delete Part"
                                    >
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        <line x1="10" y1="11" x2="10" y2="17" />
                                        <line x1="14" y1="11" x2="14" y2="17" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {editSecPartError && isEditingThisPart && (
                                <span className="field-error-text mt-2 block">{editSecPartError}</span>
                              )}

                              {/* Part Marks, Start Time, End Time in a left-aligned responsive grid */}
                              {(secParts.length >= 2 || showIndividualTime) && (
                                <div className="part-config-details-row mt-2 pt-2 border-top">
                                  <div className="part-fields-responsive-grid">
                                    {/* Part Marks */}
                                    {secParts.length >= 2 && (
                                      <div className="part-field-col">
                                        <label className="form-label text-xs font-semibold">
                                          Part Marks <span className="optional-tag font-normal">(Out of {sec.totalMarks || formData.totalMarks || 'Section Total'})</span>
                                        </label>
                                        <input
                                          type="number"
                                          min="1"
                                          className="form-input form-input-sm"
                                          placeholder="e.g. 50"
                                          value={part.partTotalMarks || ''}
                                          onChange={(e) => handleSectionPartChange(sIdx, pIdx, 'partTotalMarks', e.target.value)}
                                        />
                                      </div>
                                    )}

                                    {/* Start Time */}
                                    {showIndividualTime && (
                                      <div className="part-field-col">
                                        <label className="form-label text-xs font-semibold">
                                          Start Time <span className="req-star">*</span>
                                        </label>
                                        <input
                                          type="datetime-local"
                                          className="form-input form-input-sm"
                                          value={part.individualStartTime || ''}
                                          min={formData.startTime || minStartStr}
                                          max={formData.endTime || undefined}
                                          onChange={(e) => handleSectionPartChange(sIdx, pIdx, 'individualStartTime', e.target.value)}
                                          required
                                        />
                                        {errors[`sec_${sIdx}_part_${pIdx}_start`] && (
                                          <span className="field-error-text mt-1">
                                            {errors[`sec_${sIdx}_part_${pIdx}_start`]}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {/* End Time */}
                                    {showIndividualTime && (
                                      <div className="part-field-col">
                                        <label className="form-label text-xs font-semibold">
                                          End Time <span className="req-star">*</span>
                                        </label>
                                        <input
                                          type="datetime-local"
                                          className="form-input form-input-sm"
                                          value={part.individualEndTime || ''}
                                          min={part.individualStartTime || formData.startTime || minStartStr}
                                          max={formData.endTime || undefined}
                                          onChange={(e) => handleSectionPartChange(sIdx, pIdx, 'individualEndTime', e.target.value)}
                                          required
                                        />
                                        {errors[`sec_${sIdx}_part_${pIdx}_end`] && (
                                          <span className="field-error-text mt-1">
                                            {errors[`sec_${sIdx}_part_${pIdx}_end`]}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Part Marks Validation Message for Section */}
                      {errors[`sec_${sIdx}_parts`] && (
                        <span className="field-error-text mt-3 block font-semibold text-xs">
                          {errors[`sec_${sIdx}_parts`]}
                        </span>
                      )}

                      {/* + Add More Part to Section Button */}
                      <div className="section-add-part-wrapper text-left">
                        <button
                          type="button"
                          className="btn btn-add-section-part"
                          onClick={() => handleAddPartToSection(sIdx)}
                        >
                          <span className="btn-plus-icon">+</span>
                          <span className="btn-part-text">
                            Add More Part to {sec.name?.trim() ? sec.name.trim() : `Section ${sIdx + 1}`}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Delete Section Button placed at the BOTTOM of the section card (Only when > 2 sections exist) */}
                    {currentSectionsList.length > 2 && (
                      <div className="section-card-bottom-actions flex-end">
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm flex-align-center gap-1"
                          onClick={() => setDeleteSectionConfirmIdx(sIdx)}
                          title={`Delete ${sec.name || `Section ${sIdx + 1}`}`}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                          <span>Delete Section</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* + Add Section / Group Button placed outside & below all section cards */}
            <div className="add-section-bottom-container mt-6 mb-4 text-center">
              <button
                type="button"
                className="btn btn-add-section-prominent flex-align-center gap-2 mx-auto"
                onClick={handleAddNewSection}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Add Section / Group</span>
              </button>
            </div>
          </div>
        )}
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
          <div className="form-group access-control-input-group mb-0">
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
          <div className="form-group access-control-input-group mb-0">
            <label className="form-label access-control-label-nowrap" htmlFor="participantLimit">
              <span>Number of Participants</span> <span className="optional-tag">(Optional, empty = unlimited)</span>
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
