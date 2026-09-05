import { useState, useRef } from 'react';
import { uploadActivityFile } from '../../services/activityService';

export default function WrittenEditorPage({
  activityId,
  formData,
  sectionName,
  part,
  partIndex,
  questionToEdit,
  editingQuestionIndex,
  onSaveQuestion,
  onCancel
}) {
  const isExam = formData?.purpose === 'Exam';

  // Form states
  const [questionText, setQuestionText] = useState(questionToEdit?.questionText || '');
  const [marks, setMarks] = useState(
    questionToEdit?.marks !== undefined && questionToEdit?.marks !== null
      ? String(questionToEdit.marks)
      : ''
  );

  // Written Answer Guidelines state
  const [answerGuidelines, setAnswerGuidelines] = useState(
    questionToEdit?.answerGuidelines || questionToEdit?.description || ''
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
    setMarks('');
    setAnswerGuidelines('');
    setAttachedFiles([]);
    setError('');
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

  // Validate and Build Written Question Object
  const validateAndBuildQuestion = async () => {
    setError('');

    if (!questionText || !questionText.trim()) {
      setError('Question text is required.');
      return null;
    }

    if (isExam && (!marks || isNaN(parseFloat(marks)) || parseFloat(marks) <= 0)) {
      setError('Valid positive Marks value is compulsory for Exam activities.');
      return null;
    }

    if (marks && (isNaN(parseFloat(marks)) || parseFloat(marks) < 0)) {
      setError('Marks must be a valid positive number.');
      return null;
    }

    // Check Part/Section Marks Validation limits
    const enteredMarks = marks ? parseFloat(marks) : 0;
    const targetPartTotal = part?.partTotalMarks
      ? Number(part.partTotalMarks)
      : (formData?.parts?.length === 1 ? Number(formData.totalMarks) || 0 : 0);

    if (targetPartTotal > 0 && enteredMarks > 0) {
      const existingQuestions = part?.questions || [];
      const otherQuestionsSum = existingQuestions.reduce((acc, q, idx) => {
        if (editingQuestionIndex !== null && idx === editingQuestionIndex) {
          return acc;
        }
        return acc + (Number(q.marks) || 0);
      }, 0);

      const newSum = otherQuestionsSum + enteredMarks;
      if (newSum > targetPartTotal) {
        const remaining = Math.max(0, targetPartTotal - otherQuestionsSum);
        setError(
          `Question marks (${enteredMarks} pts) exceeds available marks for this Part (${targetPartTotal} pts total, ${remaining} pts remaining).`
        );
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
        type: 'written',
        questionText: questionText.trim(),
        marks: marks ? parseFloat(marks) : null,
        answerRequired: questionToEdit?.answerRequired !== false,
        answerGuidelines: answerGuidelines.trim(),
        description: answerGuidelines.trim(),
        attachedFiles: uploadedAttachedFiles,
        fileUrl: firstFile?.url || '',
        fileName: firstFile?.name || '',
        fileType: firstFile?.type || '',
        imageUrl: firstFile?.type === 'image' ? firstFile.url : '',
        createdAt: questionToEdit?.createdAt || new Date().toISOString()
      };

      return questionObj;
    } catch (err) {
      console.error('Error saving written question files:', err);
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
            <div className="mcq-badge-row mb-1" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <span className="badge-mcq-type badge-written-type">WRITTEN</span>
              {sectionName && (
                <span className="badge-part-name" style={{ background: '#e0e7ff', color: '#3730a3', borderColor: '#c7d2fe' }}>
                  Section: {sectionName}
                </span>
              )}
              <span className="badge-part-name">Part: {partTitle}</span>
            </div>
            <h1 className="mcq-page-title" style={{ margin: 0, padding: 0, lineHeight: '1.2' }}>
              {editingQuestionIndex !== null ? 'Edit Written' : 'Add New Written'}
            </h1>
          </div>
        </div>
      </div>

      {/* Main Form Scroll Container */}
      <div className="fullscreen-mcq-body">
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

        <div className="mcq-form-card">
          {/* BOX 1: QUESTION TEXT, MULTIPLE UPLOADS, MARKS */}
          <div className="mcq-section-card">
            <label className="form-label font-bold text-base block" style={{ marginBottom: '18px' }} htmlFor="written-question-text">
              Question Text <span className="req-star">*</span>
            </label>

            <div className="question-input-with-upload">
              <div className="question-text-wrapper">
                <textarea
                  id="written-question-text"
                  className="form-input text-area mcq-textarea-compact"
                  rows="3"
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
                  id="written-file-upload-input"
                />
                <label htmlFor="written-file-upload-input" className="btn btn-upload-mcq-side">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>+ Upload</span>
                </label>
              </div>
            </div>

            {/* List of Attached Files with Icon Action Buttons (Replace & Remove) */}
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
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
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

                    {/* Action Icon Buttons Row: Replace Icon & Delete Icon */}
                    <div
                      className="preview-actions flex-align-center"
                      style={{ display: 'flex', alignItems: 'center', gap: '14px' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="file"
                        id={`replace-written-file-input-${fItem.id}`}
                        accept="image/*, application/pdf, .jpg, .jpeg, .png, .gif, .webp, .pdf"
                        onChange={(e) => handleReplaceFile(fItem.id, e.target.files?.[0])}
                        style={{ display: 'none' }}
                      />
                      <label
                        htmlFor={`replace-written-file-input-${fItem.id}`}
                        className="btn-icon-action btn-replace-action"
                        title="Replace file"
                        aria-label="Replace file"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                          <path d="M16 16h5v5" />
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
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* MARKS FIELD */}
            <div className="marks-section-inside-box1 mt-5 pt-4 border-top">
              <div className="form-group mb-0" style={{ maxWidth: '240px' }}>
                <label className="form-label font-semibold text-sm" htmlFor="written-marks">
                  Marks {isExam ? <span className="req-star">*</span> : <span className="optional-tag">(Optional)</span>}
                </label>
                <input
                  type="text"
                  id="written-marks"
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
            </div>
          </div>

          {/* BOX 2: ANSWER CONFIGURATION / GUIDELINES */}
          <div className="mcq-section-card mt-4 written-config-section">
            <div className="section-header-box mb-3">
              <h3 className="section-subtitle-sm m-0">Answer Guidelines</h3>
            </div>

            {/* ANSWER GUIDELINES (OPTIONAL) */}
            <div className="form-group mb-0">
              <label className="form-label font-semibold text-sm" htmlFor="written-answer-guidelines">
                Answer Guidelines <span className="optional-tag font-normal">(Optional)</span>
              </label>
              <textarea
                id="written-answer-guidelines"
                className="form-input text-area"
                rows="3"
                placeholder="Write your answer clearly and explain all necessary steps..."
                value={answerGuidelines}
                onChange={(e) => setAnswerGuidelines(e.target.value)}
              />
              <span className="field-hint text-xs text-muted mt-1 block">
                These instructions will be displayed directly to the participant while writing their answer.
              </span>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTIONS BAR - SCROLLABLE AT END OF PAGE */}
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
    </div>
  );
}
