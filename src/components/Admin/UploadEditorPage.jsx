import { useState, useRef } from 'react';
import { uploadActivityFile } from '../../services/activityService';

export default function UploadEditorPage({
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
  const [marks, setMarks] = useState(
    questionToEdit?.marks !== undefined && questionToEdit?.marks !== null
      ? String(questionToEdit.marks)
      : ''
  );

  // Answer Guidelines state
  const [answerGuidelines, setAnswerGuidelines] = useState(
    questionToEdit?.answerGuidelines || questionToEdit?.description || ''
  );

  // Helper to format bytes into readable size
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Multiple File Uploads state (Images or PDFs)
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
        type: questionToEdit?.fileType || (questionToEdit?.imageUrl ? 'image' : 'pdf'),
        sizeFormatted: questionToEdit?.fileSize ? formatFileSize(questionToEdit.fileSize) : ''
      }];
    }
    return [];
  });

  const [error, setError] = useState('');
  const [fileUploading, setFileUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Reset form state to add another question
  const resetFormState = () => {
    setMarks('');
    setAnswerGuidelines('');
    setAttachedFiles([]);
    setError('');
  };

  // Multiple File Upload Handler (Supports multiple files at once and preserves previously selected files)
  const handleFileSelect = (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    setError('');

    const newFilesToAdd = [];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(lowerName);
      const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
      const isValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));

      if (!isImage && !isPdf && !isValidExt) {
        setError('Unsupported file type. Please upload JPG, PNG, WEBP, or PDF files only.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (file.size > 15 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds the 15MB limit. Please upload files under 15MB.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const previewUrl = isImage ? URL.createObjectURL(file) : '';
      newFilesToAdd.push({
        id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fileObj: file,
        url: previewUrl,
        name: file.name,
        type: isImage ? 'image' : 'pdf',
        size: file.size,
        sizeFormatted: formatFileSize(file.size)
      });
    }

    setAttachedFiles((prev) => [...prev, ...newFilesToAdd]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove individual file
  const handleRemoveFile = (fileId) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // Reorder files (Move Up)
  const handleMoveUp = (index) => {
    if (index === 0) return;
    setAttachedFiles((prev) => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  // Reorder files (Move Down)
  const handleMoveDown = (index) => {
    if (index === attachedFiles.length - 1) return;
    setAttachedFiles((prev) => {
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  // Validate and Build Upload Question Object
  const validateAndBuildQuestion = async () => {
    setError('');

    if (attachedFiles.length === 0) {
      setError('Please upload at least one image or PDF.');
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
      // Upload any pending file objects to Firebase Storage
      const uploadedAttachedFiles = await Promise.all(
        attachedFiles.map(async (fItem) => {
          if (fItem.fileObj) {
            const uploadedUrl = await uploadActivityFile(activityId, fItem.fileObj);
            return {
              id: fItem.id,
              url: uploadedUrl,
              name: fItem.name,
              type: fItem.type,
              size: fItem.size || null,
              sizeFormatted: fItem.sizeFormatted || ''
            };
          }
          return {
            id: fItem.id,
            url: fItem.url,
            name: fItem.name,
            type: fItem.type,
            size: fItem.size || null,
            sizeFormatted: fItem.sizeFormatted || ''
          };
        })
      );

      const firstFile = uploadedAttachedFiles[0];

      const questionObj = {
        id: questionToEdit?.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'upload',
        marks: marks ? parseFloat(marks) : null,
        answerGuidelines: answerGuidelines.trim(),
        description: answerGuidelines.trim(),
        attachedFiles: uploadedAttachedFiles,
        fileUrl: firstFile?.url || '',
        fileName: firstFile?.name || '',
        fileType: firstFile?.type || '',
        paperFileUrl: firstFile?.url || '',
        paperFileName: firstFile?.name || '',
        imageUrl: firstFile?.type === 'image' ? firstFile.url : '',
        createdAt: questionToEdit?.createdAt || new Date().toISOString()
      };

      return questionObj;
    } catch (err) {
      console.error('Error saving upload question files:', err);
      setError('Failed to upload files. Please check your network and try again.');
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
      {/* Top Header Bar: Circular back button strictly centered on far left */}
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
              <span className="badge-mcq-type badge-upload-type">UPLOAD</span>
              {sectionName && (
                <span className="badge-part-name" style={{ background: '#e0e7ff', color: '#3730a3', borderColor: '#c7d2fe' }}>
                  Section: {sectionName}
                </span>
              )}
              <span className="badge-part-name">Part: {partTitle}</span>
            </div>
            <h1 className="mcq-page-title" style={{ margin: 0, padding: 0, lineHeight: '1.2' }}>
              {editingQuestionIndex !== null ? 'Edit Uploads' : 'Add New Uploads'}
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
          {/* CARD 1: MARKS CONFIGURATION */}
          <div className="mcq-section-card">
            <div className="form-group mb-0" style={{ maxWidth: '240px' }}>
              <label className="form-label font-semibold text-sm" htmlFor="upload-marks">
                Marks {isExam ? <span className="req-star">*</span> : <span className="optional-tag">(Optional)</span>}
              </label>
              <input
                type="text"
                id="upload-marks"
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
                autoFocus
              />
            </div>
          </div>

          {/* CARD 2: UPLOAD FILES SECTION (Supports multiple files & additions) */}
          <div className="mcq-section-card mt-4">
            <div className="upload-header-action-row flex-between align-center mb-4">
              <div>
                <h3 className="section-subtitle-sm m-0 font-bold text-dark">
                  Upload Files <span className="req-star">*</span>
                </h3>
                <span className="text-xs text-muted block mt-1">
                  Upload one or more question images or PDF documents (JPG, PNG, WEBP, PDF up to 15MB each).
                </span>
              </div>

              {/* Upload Button */}
              <div className="upload-action-box">
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept=".jpg, .jpeg, .png, .webp, .pdf, image/*, application/pdf"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id="multi-file-upload-input"
                />
                <label htmlFor="multi-file-upload-input" className="btn btn-primary btn-upload-prominent">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>+ Upload</span>
                </label>
              </div>
            </div>

            {/* List of Uploaded Files */}
            {attachedFiles.length > 0 ? (
              <div className="uploaded-files-section mt-5 pt-3 border-top">
                <div className="flex-between align-center mb-3">
                  <span className="font-bold text-xs uppercase tracking-wider text-muted">
                    Uploaded Files ({attachedFiles.length})
                  </span>
                  <span className="text-xs text-muted">
                    Drag or use arrows to adjust file order
                  </span>
                </div>

                <div className="attached-files-list-wrapper">
                  {attachedFiles.map((fItem, fIdx) => (
                    <div key={fItem.id || fIdx} className="mcq-file-preview-card uploaded-file-item-card">
                      {/* Left side: Thumbnail / PDF Icon + Name + Size */}
                      <div
                        className="preview-left cursor-pointer flex-1 min-w-0"
                        onClick={() => fItem.url && window.open(fItem.url, '_blank')}
                        title="Click to view full file"
                      >
                        {fItem.type === 'image' && fItem.url ? (
                          <div className="img-thumbnail-box flex-shrink-0">
                            <img src={fItem.url} alt={fItem.name} />
                          </div>
                        ) : (
                          <div className="pdf-icon-box flex-shrink-0">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <span>PDF</span>
                          </div>
                        )}

                        <div className="file-info-details min-w-0 flex-1">
                          <span className="file-name-text font-semibold text-sm block text-primary hover-underline truncate">
                            {fItem.name || 'Uploaded File'} ↗
                          </span>
                          <div className="flex-align-center gap-2 mt-1">
                            <span className="file-type-badge text-xs uppercase font-bold text-muted">
                              {fItem.type || 'File'}
                            </span>
                            {fItem.sizeFormatted && (
                              <span className="file-size-tag text-xs text-muted font-medium">
                                • {fItem.sizeFormatted}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right side Actions: Move Up, Move Down, Delete (✕) */}
                      <div
                        className="preview-actions flex-align-center"
                        style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {attachedFiles.length > 1 && (
                          <div className="reorder-btn-group flex-align-center gap-1">
                            <button
                              type="button"
                              className="btn-icon-action btn-reorder-sm"
                              onClick={() => handleMoveUp(fIdx)}
                              disabled={fIdx === 0}
                              title="Move file up"
                              aria-label="Move file up"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              className="btn-icon-action btn-reorder-sm"
                              onClick={() => handleMoveDown(fIdx)}
                              disabled={fIdx === attachedFiles.length - 1}
                              title="Move file down"
                              aria-label="Move file down"
                            >
                              ▼
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          className="btn-icon-action btn-delete-action"
                          onClick={() => handleRemoveFile(fItem.id)}
                          title="Remove file"
                          aria-label={`Remove ${fItem.name}`}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                className="empty-upload-dropzone mt-5 pt-8 pb-8 text-center cursor-pointer border-dashed rounded"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="empty-upload-icon-box mb-3">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <h4 className="text-base font-bold text-dark m-0">No files uploaded yet</h4>
                <p className="text-xs text-muted mt-2 mb-0">
                  Click <strong>+ Upload</strong> above to select one or more files from your device.
                </p>
              </div>
            )}
          </div>

          {/* CARD 3: ANSWER GUIDELINES */}
          <div className="mcq-section-card mt-4 written-config-section">
            <div className="section-header-box mb-3">
              <h3 className="section-subtitle-sm m-0 font-bold text-dark">Answer Guidelines</h3>
            </div>

            <div className="form-group mb-0">
              <label className="form-label font-semibold text-sm" htmlFor="upload-answer-guidelines">
                Answer Guidelines <span className="optional-tag font-normal">(Optional)</span>
              </label>
              <textarea
                id="upload-answer-guidelines"
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
