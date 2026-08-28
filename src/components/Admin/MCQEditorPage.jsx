import { useState, useRef } from 'react';
import { uploadActivityFile } from '../../services/activityService';

export default function MCQEditorPage({
  activityId,
  formData,
  part,
  partIndex,
  questionToEdit,
  editingQuestionIndex,
  onSaveQuestion,
  onCancel
}) {
  const isExam = formData.purpose === 'Exam';
  const autoGradeMCQ = formData.autoGradeMCQ !== false;
  const enableNegativeMarking = !!formData.enableNegativeMarking;

  // Form states
  const [questionText, setQuestionText] = useState(questionToEdit?.questionText || '');
  const [marks, setMarks] = useState(
    questionToEdit?.marks !== undefined && questionToEdit?.marks !== null
      ? String(questionToEdit.marks)
      : isExam ? '1' : ''
  );
  const [negativeMark, setNegativeMark] = useState(
    questionToEdit?.negativeMark !== undefined && questionToEdit?.negativeMark !== null
      ? String(questionToEdit.negativeMark)
      : (formData.negativeMarkValue || '0.25')
  );

  // Allow selecting multiple correct options toggle state
  const [allowMultipleChoices, setAllowMultipleChoices] = useState(
    questionToEdit?.allowMultipleChoices !== undefined
      ? !!questionToEdit.allowMultipleChoices
      : !!formData.allowMultipleChoices
  );

  // Explanation / Description toggle for participant/user screen
  const [enableExplanation, setEnableExplanation] = useState(
    questionToEdit?.enableExplanation !== undefined
      ? !!questionToEdit.enableExplanation
      : !!questionToEdit?.explanation
  );

  // Options state: Default to empty strings ['', ''] so placeholders show naturally without text backspacing!
  const [options, setOptions] = useState(() => {
    if (questionToEdit?.options && questionToEdit.options.length >= 2) {
      return [...questionToEdit.options];
    }
    return ['', ''];
  });
  const [correctOptionIndices, setCorrectOptionIndices] = useState(
    questionToEdit?.correctIndices || [0]
  );

  // Multiple File Uploads state (Images or PDFs - Optional)
  const [attachedFiles, setAttachedFiles] = useState(() => {
    if (questionToEdit?.attachedFiles && Array.isArray(questionToEdit.attachedFiles)) {
      return [...questionToEdit.attachedFiles];
    }
    const singleUrl = questionToEdit?.fileUrl || questionToEdit?.imageUrl || questionToEdit?.paperFileUrl;
    if (singleUrl) {
      return [{
        id: 'file_0',
        url: singleUrl,
        name: questionToEdit?.fileName || questionToEdit?.paperFileName || 'Attached File',
        type: questionToEdit?.fileType || (questionToEdit?.imageUrl ? 'image' : 'pdf')
      }];
    }
    return [];
  });

  const [error, setError] = useState('');
  const [fileUploading, setFileUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Reset form state to add another question
  const resetFormState = () => {
    setQuestionText('');
    setMarks(isExam ? '1' : '');
    setNegativeMark(formData.negativeMarkValue || '0.25');
    setOptions(['', '']);
    setCorrectOptionIndices([0]);
    setAllowMultipleChoices(!!formData.allowMultipleChoices);
    setEnableExplanation(false);
    setAttachedFiles([]);
    setError('');
  };

  // Option Handlers
  const handleAddOption = () => {
    if (options.length >= 10) {
      setError('Maximum 10 options allowed per MCQ.');
      return;
    }
    setError('');
    // Append an empty string so the new option box gets a placeholder "Option X" cleanly
    setOptions((prev) => [...prev, '']);
  };

  const handleOptionChange = (index, value) => {
    setError('');
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= 2) {
      setError('MCQ must have at least 2 options.');
      return;
    }
    setError('');
    const updated = options.filter((_, i) => i !== index);
    setOptions(updated);

    // Adjust correct option indices
    setCorrectOptionIndices((prev) => {
      return prev
        .filter((i) => i !== index)
        .map((i) => (i > index ? i - 1 : i));
    });
  };

  // Correct Answer Handler (Left side of option)
  const handleToggleCorrectOption = (index) => {
    setError('');
    if (allowMultipleChoices) {
      if (correctOptionIndices.includes(index)) {
        if (correctOptionIndices.length === 1) {
          setError('At least one correct answer must be selected when Autograding is enabled.');
          return;
        }
        setCorrectOptionIndices((prev) => prev.filter((i) => i !== index));
      } else {
        setCorrectOptionIndices((prev) => [...prev, index]);
      }
    } else {
      setCorrectOptionIndices([index]);
    }
  };

  // Multiple File Upload Handler
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    const lowerName = file.name.toLowerCase();
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(lowerName);
    const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');

    if (!isImage && !isPdf) {
      setError('Unsupported file type. Only Image files (JPG, PNG, GIF, WEBP) and PDF files are allowed.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('File size must be less than 15MB per file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const previewUrl = isImage ? URL.createObjectURL(file) : '';
    const newFileItem = {
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      fileObj: file,
      url: previewUrl,
      name: file.name,
      type: isImage ? 'image' : 'pdf'
    };

    setAttachedFiles((prev) => [...prev, newFileItem]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Replace attached file
  const handleReplaceFile = (fileId, file) => {
    if (!file) return;
    setError('');

    const lowerName = file.name.toLowerCase();
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(lowerName);
    const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');

    if (!isImage && !isPdf) {
      setError('Unsupported file type. Only Image files (JPG, PNG, GIF, WEBP) and PDF files are allowed.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('File size must be less than 15MB per file.');
      return;
    }

    const previewUrl = isImage ? URL.createObjectURL(file) : '';
    setAttachedFiles((prev) =>
      prev.map((fItem) => {
        if (fItem.id === fileId) {
          return {
            ...fItem,
            fileObj: file,
            url: previewUrl,
            name: file.name,
            type: isImage ? 'image' : 'pdf'
          };
        }
        return fItem;
      })
    );
  };

  const handleRemoveFile = (fileId) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // Submit Handler
  const validateAndBuildQuestion = async () => {
    setError('');

    if (!questionText || !questionText.trim()) {
      setError('Question text is required.');
      return null;
    }

    if (options.length < 2) {
      setError('At least 2 options are required.');
      return null;
    }

    if (options.length > 10) {
      setError('Maximum 10 options allowed.');
      return null;
    }

    for (let i = 0; i < options.length; i++) {
      if (!options[i] || !options[i].trim()) {
        setError(`Option ${i + 1} cannot be empty. Please fill or remove it.`);
        return null;
      }
    }

    if (isExam && (!marks || isNaN(parseFloat(marks)) || parseFloat(marks) <= 0)) {
      setError('Valid positive Marks value is compulsory for Exam activities.');
      return null;
    }

    if (marks && (isNaN(parseFloat(marks)) || parseFloat(marks) < 0)) {
      setError('Marks must be a valid positive number.');
      return null;
    }

    if (enableNegativeMarking) {
      if (negativeMark === '' || isNaN(parseFloat(negativeMark)) || parseFloat(negativeMark) < 0) {
        setError('Negative Marking must be a valid non-negative number.');
        return null;
      }
    }

    if (autoGradeMCQ) {
      if (!correctOptionIndices || correctOptionIndices.length === 0) {
        setError('Please select a correct answer option.');
        return null;
      }
      if (!allowMultipleChoices && correctOptionIndices.length > 1) {
        setError('Only one correct answer can be selected when multiple-answer mode is disabled.');
        return null;
      }
    }

    setFileUploading(true);

    try {
      // Upload any pending file objects
      const uploadedAttachedFiles = await Promise.all(
        attachedFiles.map(async (fItem) => {
          if (fItem.fileObj) {
            const uploadedUrl = await uploadActivityFile(activityId, fItem.fileObj);
            return {
              id: fItem.id,
              url: uploadedUrl,
              name: fItem.name,
              type: fItem.type
            };
          }
          return {
            id: fItem.id,
            url: fItem.url,
            name: fItem.name,
            type: fItem.type
          };
        })
      );

      const firstFile = uploadedAttachedFiles[0];

      const questionObj = {
        id: questionToEdit?.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'mcq',
        questionText: questionText.trim(),
        marks: marks ? parseFloat(marks) : null,
        negativeMark: enableNegativeMarking ? parseFloat(negativeMark) : null,
        options: options.map((opt) => opt.trim()),
        correctIndices: autoGradeMCQ ? correctOptionIndices : [],
        allowMultipleChoices: allowMultipleChoices,
        enableExplanation: enableExplanation,
        attachedFiles: uploadedAttachedFiles,
        fileUrl: firstFile?.url || '',
        fileName: firstFile?.name || '',
        fileType: firstFile?.type || '',
        imageUrl: firstFile?.type === 'image' ? firstFile.url : '',
        createdAt: questionToEdit?.createdAt || new Date().toISOString()
      };

      return questionObj;
    } catch (err) {
      console.error('Error saving MCQ question files:', err);
      setError('Failed to upload attached files. Please try again.');
      return null;
    } finally {
      setFileUploading(false);
    }
  };

  const handleSaveOnly = async () => {
    const qObj = await validateAndBuildQuestion();
    if (qObj) {
      onSaveQuestion(qObj, false);
    }
  };

  const handleSaveAndAddMore = async () => {
    const qObj = await validateAndBuildQuestion();
    if (qObj) {
      onSaveQuestion(qObj, true);
      resetFormState();
    }
  };

  const partTitle = part?.title || `Part ${partIndex + 1}`;

  return (
    <div className="fullscreen-mcq-editor-page fade-in">
      {/* Top Header Bar: Circular back button strictly centered on far left relative to badges + title block */}
      <div className="fullscreen-mcq-header">
        <div className="mcq-header-top-row" style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <button
            type="button"
            className="btn-back-circular"
            onClick={onCancel}
            title="Discard changes and return"
            aria-label="Back"
            style={{ flexShrink: 0, margin: 0 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>

          <div className="mcq-header-meta-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="mcq-badge-row mb-1" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="badge-mcq-type">MCQ</span>
              <span className="badge-part-name">Part: {partTitle}</span>
            </div>
            <h1 className="mcq-page-title" style={{ margin: 0, padding: 0, lineHeight: '1.2' }}>
              {editingQuestionIndex !== null ? 'Edit MCQ' : 'Add New MCQ'}
            </h1>
          </div>
        </div>
      </div>

      {/* Main Form Scroll Container */}
      <div className="fullscreen-mcq-body">
        {error && (
          <div className="alert alert-error mb-4">
            <svg className="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="mcq-form-card">
          {/* BOX 1: QUESTION TEXT, MULTIPLE UPLOADS, MARKS & NEGATIVE MARKING */}
          <div className="mcq-section-card">
            <label className="form-label font-bold text-base mb-2 block" htmlFor="mcq-question-text">
              Question Text <span className="req-star">*</span>
            </label>

            <div className="question-input-with-upload">
              <div className="question-text-wrapper">
                <textarea
                  id="mcq-question-text"
                  className="form-input text-area mcq-textarea-compact"
                  rows="2"
                  placeholder="Enter your question..."
                  value={questionText}
                  onChange={(e) => {
                    setError('');
                    setQuestionText(e.target.value);
                  }}
                  autoFocus
                />
              </div>

              {/* Upload Image/PDF button (Admin can add one or more files) */}
              <div className="upload-side-box">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*, application/pdf, .jpg, .jpeg, .png, .gif, .webp, .pdf"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id="mcq-file-upload-input"
                />
                <label htmlFor="mcq-file-upload-input" className="btn btn-upload-mcq-side">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span>+ Upload Image/PDF</span>
                </label>
              </div>
            </div>

            {/* List of Attached Files with Icon Action Buttons (Replace & Remove with 14px gap) */}
            {attachedFiles.length > 0 && (
              <div className="attached-files-list-wrapper mt-4 pt-2">
                {attachedFiles.map((fItem) => (
                  <div key={fItem.id} className="mcq-file-preview-card mb-2">
                    <div
                      className="preview-left cursor-pointer"
                      onClick={() => fItem.url && window.open(fItem.url, '_blank')}
                      title="Click to view file"
                    >
                      {fItem.type === 'image' && fItem.url ? (
                        <div className="img-thumbnail-box">
                          <img src={fItem.url} alt="Attachment" />
                        </div>
                      ) : (
                        <div className="pdf-icon-box">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                          </svg>
                          <span>PDF</span>
                        </div>
                      )}
                      <div className="file-info-details">
                        <span className="file-name-text font-semibold text-sm block text-primary hover-underline">
                          {fItem.name || 'Attached File'} ↗
                        </span>
                        <span className="file-type-badge text-xs uppercase font-bold text-muted">
                          {fItem.type || 'File'}
                        </span>
                      </div>
                    </div>

                    {/* Action Icon Buttons Row: Replace Icon & Delete Icon (14px gap between icons) */}
                    <div
                      className="preview-actions flex-align-center"
                      style={{ display: 'flex', alignItems: 'center', gap: '14px' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="file"
                        id={`replace-file-input-${fItem.id}`}
                        accept="image/*, application/pdf, .jpg, .jpeg, .png, .gif, .webp, .pdf"
                        onChange={(e) => handleReplaceFile(fItem.id, e.target.files?.[0])}
                        style={{ display: 'none' }}
                      />
                      <label
                        htmlFor={`replace-file-input-${fItem.id}`}
                        className="btn-icon-action btn-replace-action"
                        title="Replace file"
                        aria-label="Replace file"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                          <path d="M3 3v5h5"/>
                          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                          <path d="M16 16h5v5"/>
                        </svg>
                      </label>

                      <button
                        type="button"
                        className="btn-icon-action btn-delete-action"
                        onClick={() => handleRemoveFile(fItem.id)}
                        title="Remove file"
                        aria-label="Remove file"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          <line x1="10" y1="11" x2="10" y2="17"/>
                          <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* MARKS & NEGATIVE MARKING INTEGRATED IN BOX 1 */}
            <div className="marks-section-inside-box1 mt-4 pt-3 border-top">
              <div className="form-grid-2">
                {/* Marks Field */}
                <div className="form-group mb-0">
                  <label className="form-label font-semibold text-sm" htmlFor="mcq-marks">
                    Marks {isExam ? <span className="req-star">*</span> : <span className="optional-tag">(Optional)</span>}
                  </label>
                  <input
                    type="text"
                    id="mcq-marks"
                    className="form-input mcq-marks-input"
                    inputMode="decimal"
                    placeholder="e.g. 1"
                    value={marks}
                    onChange={(e) => {
                      setError('');
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setMarks(val);
                      }
                    }}
                  />
                </div>

                {/* Negative Marking Field (ONLY IF ENABLED IN BASIC INFO) */}
                {enableNegativeMarking && (
                  <div className="form-group mb-0">
                    <label className="form-label font-semibold text-sm" htmlFor="mcq-negative-mark">
                      Negative Marking <span className="req-star">*</span>
                    </label>
                    <input
                      type="text"
                      id="mcq-negative-mark"
                      className="form-input mcq-marks-input"
                      inputMode="decimal"
                      placeholder="e.g. 0.25"
                      value={negativeMark}
                      onChange={(e) => {
                        setError('');
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setNegativeMark(val);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* BOX 2: OPTIONS WITH SPACIOUS VERTICAL MARGIN BEFORE OPTION 1 */}
          <div className="mcq-section-card mt-4">
            <div className="options-header-row flex-between align-center mb-5">
              <h3 className="section-subtitle-sm m-0">Options</h3>

              {/* EXPLICIT ON/OFF TOGGLE WITH 32px MARGIN ON LEFT */}
              {autoGradeMCQ && (
                <div className="toggle-switch-row-sm flex-align-center ml-auto">
                  <span className="toggle-title text-xs font-semibold text-muted pr-2">
                    Allow selecting multiple correct options
                  </span>
                  <button
                    type="button"
                    className={`btn-onoff-toggle ${allowMultipleChoices ? 'on' : 'off'}`}
                    style={{ marginLeft: '32px' }}
                    onClick={() => {
                      const nextVal = !allowMultipleChoices;
                      setAllowMultipleChoices(nextVal);
                      if (!nextVal && correctOptionIndices.length > 1) {
                        setCorrectOptionIndices([correctOptionIndices[0]]);
                      }
                    }}
                  >
                    <span className="onoff-text">{allowMultipleChoices ? 'ON' : 'OFF'}</span>
                    <span className="onoff-slider"></span>
                  </button>
                </div>
              )}
            </div>

            {/* Options List - Spacious layout */}
            <div className="options-list-grid mt-2">
              {options.map((optText, index) => {
                const isCorrect = correctOptionIndices.includes(index);

                return (
                  <div key={index} className="option-row-card mb-4 flex-align-center flex-between">
                    {/* AUTOGRADING: CORRECT ANSWER CONTROL ON LEFT SIDE */}
                    {autoGradeMCQ && (
                      <div className="correct-answer-left-control">
                        <button
                          type="button"
                          className={`choice-select-btn ${isCorrect ? 'selected-correct' : ''}`}
                          onClick={() => handleToggleCorrectOption(index)}
                          title={isCorrect ? 'Correct Answer Selected' : 'Mark as Correct Answer'}
                        >
                          {allowMultipleChoices ? (
                            <span className="checkbox-indicator">{isCorrect ? '☑' : '☐'}</span>
                          ) : (
                            <span className="radio-indicator">{isCorrect ? '●' : '○'}</span>
                          )}
                          <span className="choice-btn-label">Correct</span>
                        </button>
                      </div>
                    )}

                    {/* Option Text Box with placeholder inside (No text backspace needed!) */}
                    <div className="option-input-field-wrapper flex-1">
                      <input
                        type="text"
                        className="form-input option-text-input"
                        placeholder={`Option ${index + 1}`}
                        value={optText || ''}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                      />
                    </div>

                    {/* Prominent Red Trash Delete Button at FAR RIGHT whenever options count > 2 */}
                    {options.length > 2 && (
                      <div className="option-delete-right-wrapper" style={{ marginLeft: '14px', flexShrink: 0 }}>
                        <button
                          type="button"
                          className="btn-delete-option-right"
                          onClick={() => handleRemoveOption(index)}
                          title="Delete Option"
                          aria-label={`Delete option ${index + 1}`}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* + Add Option Button */}
            <div className="add-option-btn-wrapper mt-4 mb-4">
              {options.length < 10 ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-add-option-full"
                  onClick={handleAddOption}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>+ Add Option</span>
                </button>
              ) : (
                <span className="max-options-notice text-xs text-muted block font-semibold text-center">
                  Maximum 10 options limit reached.
                </span>
              )}
            </div>

            {/* EXPLICIT ON/OFF TOGGLE FOR ANSWER EXPLANATION / DESCRIPTION */}
            <div className="explanation-toggle-section mt-5 pt-4 border-top">
              <div className="toggle-switch-row flex-between align-center">
                <div>
                  <span className="toggle-title font-semibold text-sm block">
                    Provide Answer Explanation / Description
                  </span>
                  <span className="text-xs text-muted block mt-1">
                    Shown to participants when solving or reviewing quiz.
                  </span>
                </div>
                <button
                  type="button"
                  className={`btn-onoff-toggle ${enableExplanation ? 'on' : 'off'}`}
                  style={{ marginLeft: '32px' }}
                  onClick={() => setEnableExplanation(!enableExplanation)}
                >
                  <span className="onoff-text">{enableExplanation ? 'ON' : 'OFF'}</span>
                  <span className="onoff-slider"></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTIONS BAR - ALL 3 BUTTONS IN A SINGLE ROW AT THE LAST */}
      <div className="fullscreen-mcq-bottom-bar flex-end">
        <div className="single-row-bottom-actions flex-align-center gap-3">
          <button
            type="button"
            className="btn btn-secondary btn-cancel-mcq"
            onClick={onCancel}
            disabled={fileUploading}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-primary btn-save-mcq"
            onClick={handleSaveOnly}
            disabled={fileUploading}
          >
            {fileUploading ? (
              <div className="spinner-container">
                <div className="spinner"></div>
                <span>Saving...</span>
              </div>
            ) : (
              <span>Save Question</span>
            )}
          </button>

          <button
            type="button"
            className="btn btn-accent btn-add-more-mcq"
            onClick={handleSaveAndAddMore}
            disabled={fileUploading}
          >
            {fileUploading ? (
              <div className="spinner-container">
                <div className="spinner"></div>
                <span>Saving...</span>
              </div>
            ) : (
              <span>Add More Question</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
