import { useState } from 'react';
import { uploadActivityFile } from '../../services/activityService';
import MCQEditorPage from './MCQEditorPage';

export default function Step3QuestionsSetup({
  activityId,
  formData,
  updateFormData,
  onNext,
  onBack,
  saving
}) {
  const parts = formData.parts || [{ id: 'part_1', title: 'Part 1', questions: [] }];

  // Modal & Selection States
  const [typeSelectorPartIndex, setTypeSelectorPartIndex] = useState(null);
  const [editorMode, setEditorMode] = useState(null); // null, 'mcq', 'written', 'upload_paper'
  const [editingPartIndex, setEditingPartIndex] = useState(0);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  const [deletingTarget, setDeletingTarget] = useState(null); // { partIndex, qIdx, question }
  const [showCancelQuestionsModal, setShowCancelQuestionsModal] = useState(false);

  const [error, setError] = useState('');
  const [fileUploading, setFileUploading] = useState(false);

  // Form states for active question editor
  const [questionText, setQuestionText] = useState('');
  const [marks, setMarks] = useState(formData.purpose === 'Exam' ? '1' : '');
  const [description, setDescription] = useState('');



  // Image & File attachment states
  const [questionImageFile, setQuestionImageFile] = useState(null);
  const [questionImageUrl, setQuestionImageUrl] = useState('');
  const [paperFile, setPaperFile] = useState(null);
  const [paperFileUrl, setPaperFileUrl] = useState('');
  const [paperFileName, setPaperFileName] = useState('');

  const isExam = formData.purpose === 'Exam';

  const resetQuestionForm = () => {
    setQuestionText('');
    setMarks(isExam ? '1' : '');
    setDescription('');
    setQuestionImageFile(null);
    setQuestionImageUrl('');
    setPaperFile(null);
    setPaperFileUrl('');
    setPaperFileName('');
    setEditingQuestionIndex(null);
    setEditorMode(null);
    setError('');
  };

  const openTypeSelector = (pIdx) => {
    setError('');
    setTypeSelectorPartIndex(pIdx);
  };

  const openEditor = (pIdx, type, questionToEdit = null, qIdx = null) => {
    resetQuestionForm();
    setTypeSelectorPartIndex(null);
    setEditingPartIndex(pIdx);
    setEditorMode(type);

    if (questionToEdit) {
      setEditingQuestionIndex(qIdx);
      setQuestionText(questionToEdit.questionText || '');
      setMarks(questionToEdit.marks !== undefined && questionToEdit.marks !== null ? String(questionToEdit.marks) : '');
      setDescription(questionToEdit.description || '');
      setQuestionImageUrl(questionToEdit.imageUrl || '');
      setPaperFileUrl(questionToEdit.paperFileUrl || '');
      setPaperFileName(questionToEdit.paperFileName || '');
    }
  };

  const handlePaperFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const validExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
    const lowerName = file.name.toLowerCase();
    const isValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isValidExt) {
      setError('Unsupported file format. Please upload JPG, JPEG, PNG, or PDF files only.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('File size must be less than 15MB.');
      return;
    }

    setPaperFile(file);
    setPaperFileName(file.name);
  };

  const handleQuestionImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG).');
      return;
    }
    setQuestionImageFile(file);
    const preview = URL.createObjectURL(file);
    setQuestionImageUrl(preview);
  };

  // Save Question into editingPartIndex
  const handleSaveQuestion = async () => {
    setError('');

    if (editorMode !== 'upload_paper' && (!questionText || !questionText.trim())) {
      setError('Question text is required.');
      return;
    }

    if (isExam && (!marks || parseFloat(marks) <= 0)) {
      setError('Marks are compulsory for Exam activities.');
      return;
    }

    if (editorMode === 'upload_paper' && !paperFile && !paperFileUrl) {
      setError('Please select a question paper file (PDF or Image).');
      return;
    }

    setFileUploading(true);

    try {
      let finalImageUrl = questionImageUrl;
      let finalPaperUrl = paperFileUrl;

      if (questionImageFile) {
        finalImageUrl = await uploadActivityFile(activityId, questionImageFile);
      }

      if (paperFile) {
        finalPaperUrl = await uploadActivityFile(activityId, paperFile);
      }

      const currentPartQuestions = parts[editingPartIndex]?.questions || [];

      const questionObj = {
        id: editingQuestionIndex !== null ? currentPartQuestions[editingQuestionIndex].id : `q_${Date.now()}`,
        type: editorMode,
        questionText: questionText.trim(),
        marks: marks ? parseFloat(marks) : null,
        description: description.trim(),
        imageUrl: finalImageUrl,
        paperFileUrl: finalPaperUrl,
        paperFileName: paperFileName || (paperFile ? paperFile.name : ''),
        createdAt: new Date().toISOString()
      };

      const updatedParts = [...parts];
      const partQuestions = [...(updatedParts[editingPartIndex].questions || [])];

      if (editingQuestionIndex !== null) {
        partQuestions[editingQuestionIndex] = questionObj;
      } else {
        partQuestions.push(questionObj);
      }

      updatedParts[editingPartIndex] = {
        ...updatedParts[editingPartIndex],
        questions: partQuestions
      };

      updateFormData({ parts: updatedParts });
      resetQuestionForm();
    } catch (err) {
      console.error("Save question error:", err);
      setError("Failed to save question. Please try again.");
    } finally {
      setFileUploading(false);
    }
  };

  // Dedicated Save Handler for Full-Screen MCQ Editor
  const handleSaveMCQQuestion = (questionObj, addMore = false) => {
    const updatedParts = [...parts];
    const targetPart = updatedParts[editingPartIndex] || { id: `part_${editingPartIndex + 1}`, title: `Part ${editingPartIndex + 1}`, questions: [] };
    const partQuestions = [...(targetPart.questions || [])];

    if (editingQuestionIndex !== null && editingQuestionIndex !== undefined) {
      partQuestions[editingQuestionIndex] = questionObj;
    } else {
      partQuestions.push(questionObj);
    }

    updatedParts[editingPartIndex] = {
      ...targetPart,
      questions: partQuestions
    };

    updateFormData({ parts: updatedParts });

    if (addMore) {
      setEditingQuestionIndex(null);
    } else {
      resetQuestionForm();
    }
  };

  // Delete Question handler
  const confirmDeleteQuestion = () => {
    if (!deletingTarget) return;
    const { partIndex, qIdx } = deletingTarget;

    const updatedParts = [...parts];
    const partQuestions = (updatedParts[partIndex].questions || []).filter((_, idx) => idx !== qIdx);

    updatedParts[partIndex] = {
      ...updatedParts[partIndex],
      questions: partQuestions
    };

    updateFormData({ parts: updatedParts });
    setDeletingTarget(null);
  };

  // Reorder Question handler
  const handleReorderQuestion = (pIdx, qIdx, direction) => {
    const updatedParts = [...parts];
    const qList = [...(updatedParts[pIdx].questions || [])];
    const targetIdx = direction === 'up' ? qIdx - 1 : qIdx + 1;

    if (targetIdx < 0 || targetIdx >= qList.length) return;

    const temp = qList[qIdx];
    qList[qIdx] = qList[targetIdx];
    qList[targetIdx] = temp;

    updatedParts[pIdx] = {
      ...updatedParts[pIdx],
      questions: qList
    };

    updateFormData({ parts: updatedParts });
  };

  // Format Helper for Question Count
  const getQuestionCountText = (count) => {
    if (count === 1) return '1 Q';
    return `${count} Qs`;
  };

  // Validation before proceed
  const handleCompleteAllQuestions = () => {
    setError('');

    let totalQuestions = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const qList = p.questions || [];
      totalQuestions += qList.length;

      if (qList.length === 0) {
        setError(`Part ${i + 1} ("${p.title || `Part ${i + 1}`}") has no questions added. Please click "+ Add Question" to add questions.`);
        return;
      }

      if (isExam) {
        const missingMarks = qList.some((q) => q.marks === null || q.marks === undefined || q.marks <= 0);
        if (missingMarks) {
          setError(`All questions in Part ${i + 1} ("${p.title || `Part ${i + 1}`}") must have compulsory marks for an Exam.`);
          return;
        }
      }

      const targetPartTotal = parts.length === 1
        ? (Number(formData.totalMarks) || 0)
        : (Number(p.partTotalMarks) || 0);

      const partQuestionSum = qList.reduce((acc, q) => acc + (Number(q.marks) || 0), 0);

      if (targetPartTotal > 0 && partQuestionSum !== targetPartTotal) {
        if (partQuestionSum < targetPartTotal) {
          setError(`Part ${i + 1} ("${p.title || `Part ${i + 1}`}") total question marks (${partQuestionSum} pts) is less than configured total marks (${targetPartTotal} pts).`);
        } else {
          setError(`Part ${i + 1} ("${p.title || `Part ${i + 1}`}") total question marks (${partQuestionSum} pts) exceeds configured total marks (${targetPartTotal} pts).`);
        }
        return;
      }
    }

    if (totalQuestions === 0) {
      setError('Please add at least one question to your activity.');
      return;
    }

    onNext();
  };

  return (
    <div className="wizard-step-container fade-in">
      <div className="wizard-step-header">
        <h2 className="wizard-step-title">Question Creation &amp; Setup</h2>
        <p className="wizard-step-subtitle">
          Add and manage questions for each part of your activity.
        </p>
      </div>

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

      {/* PARTS & QUESTIONS LIST WORKSPACE */}
      <div className="parts-questions-workspace">
        {parts.map((part, pIdx) => {
          const qList = part.questions || [];
          const qCount = qList.length;

          return (
            <div key={part.id || pIdx} className="part-questions-box mb-6">
              {/* PART HEADER ROW */}
              <div className="part-header-card">
                <div className="part-header-left">
                  <h3 className="part-name-text">
                    {part.title || `Part ${pIdx + 1}`}
                    <span className="part-q-count"> ({getQuestionCountText(qCount)})</span>
                  </h3>
                </div>
                <div className="part-header-right-container">
                  <button
                    type="button"
                    className="add-question-header-title-btn"
                    onClick={() => openTypeSelector(pIdx)}
                  >
                    + Add Question
                  </button>
                  <div className="quick-question-type-buttons">
                    <button
                      type="button"
                      className="btn btn-type-quick mcq"
                      onClick={() => openEditor(pIdx, 'mcq')}
                    >
                      + MCQ
                    </button>
                    <button
                      type="button"
                      className="btn btn-type-quick written"
                      onClick={() => openEditor(pIdx, 'written')}
                    >
                      + Written
                    </button>
                    <button
                      type="button"
                      className="btn btn-type-quick upload-icon"
                      onClick={() => openEditor(pIdx, 'upload_paper')}
                      title="Upload IMG/PDF Question Paper"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <span>+ Upload IMG/PDF</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* QUESTION CARDS LIST FOR THIS PART */}
              <div className="part-questions-body">
                {qCount === 0 ? (
                  <div className="empty-questions-card">
                    <p>No questions added yet.</p>
                  </div>
                ) : (
                  <div className="questions-card-grid">
                    {qList.map((q, qIdx) => (
                      <div key={q.id || qIdx} className="question-display-card">
                        <div className="q-card-main-content">
                          <div className="q-card-title-row">
                            <span className="q-number-label">Q{qIdx + 1}</span>
                            <span className={`q-type-badge-styled ${q.type}`}>
                              {q.type === 'mcq' ? '[MCQ]' : q.type === 'written' ? '[Written]' : '[Uploaded]'}
                            </span>
                          </div>

                          <div className="q-card-text-body mt-1">
                            <p className="q-text-prompt">
                              {q.type === 'upload_paper'
                                ? (q.paperFileName ? `Question Paper: ${q.paperFileName}` : 'Question Paper file')
                                : q.questionText}
                            </p>
                          </div>

                          <div className="q-card-meta-row mt-2">
                            <span className="q-marks-label">
                              Marks: <strong>{q.marks !== null && q.marks !== undefined && q.marks !== '' ? q.marks : '0'}</strong>
                            </span>
                          </div>
                        </div>

                        {/* EDIT / DELETE ACTIONS ON RIGHT SIDE */}
                        <div className="q-card-actions-right">
                          {qList.length > 1 && (
                            <div className="q-reorder-btns">
                              <button
                                type="button"
                                className="btn-reorder"
                                onClick={() => handleReorderQuestion(pIdx, qIdx, 'up')}
                                disabled={qIdx === 0}
                                title="Move Up"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                className="btn-reorder"
                                onClick={() => handleReorderQuestion(pIdx, qIdx, 'down')}
                                disabled={qIdx === qList.length - 1}
                                title="Move Down"
                              >
                                ▼
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            className="btn-q-action edit"
                            onClick={() => openEditor(pIdx, q.type, q, qIdx)}
                            title="Edit Question"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="btn-q-action delete"
                            onClick={() => setDeletingTarget({ partIndex: pIdx, qIdx, question: q })}
                            title="Delete Question"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" style={{ marginRight: '4px' }}>
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              <line x1="10" y1="11" x2="10" y2="17"/>
                              <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal when clicking Cancel on Question Setup */}
      {showCancelQuestionsModal && (
        <div className="modal-backdrop" onClick={() => setShowCancelQuestionsModal(false)}>
          <div className="modal-card small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar flex-between">
              <h4 className="modal-title-text text-danger font-bold">⚠️ Confirm Reset & Cancel Questions</h4>
              <button type="button" className="modal-close-btn" onClick={() => setShowCancelQuestionsModal(false)}>×</button>
            </div>
            <div className="modal-body-content py-3">
              <p className="text-sm font-semibold mb-2" style={{ color: '#0f172a' }}>
                Are you sure you want to cancel and go back?
              </p>
              <p className="text-xs text-muted">
                Going back will <strong>reset and delete all configured questions</strong> for this activity. You will have to set up your questions again.
              </p>
            </div>
            <div className="modal-footer-bar flex-end gap-2 pt-3 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCancelQuestionsModal(false)}
              >
                No, Stay Here
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => {
                  setShowCancelQuestionsModal(false);
                  // Reset all questions in parts
                  const resetParts = parts.map((p) => ({ ...p, questions: [] }));
                  updateFormData({ parts: resetParts });
                  if (onBack) onBack();
                }}
              >
                Yes, Delete All Questions & Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WIZARD BOTTOM ACTIONS BAR */}
      <div className="wizard-actions-bar mt-6">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setShowCancelQuestionsModal(true)}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={handleCompleteAllQuestions}
          disabled={saving}
        >
          <span>NEXT: PARTICIPANT FORM &rarr;</span>
        </button>
      </div>

      {/* MODAL 1: QUESTION TYPE SELECTION */}
      {typeSelectorPartIndex !== null && (
        <div className="modal-backdrop" onClick={() => setTypeSelectorPartIndex(null)}>
          <div className="modal-card type-selection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header flex-between">
              <h3 className="modal-title">Add Question</h3>
              <button className="modal-close-btn" onClick={() => setTypeSelectorPartIndex(null)}>&times;</button>
            </div>
            <div className="type-options-grid mt-4">
              <button
                type="button"
                className="type-select-card"
                onClick={() => openEditor(typeSelectorPartIndex, 'mcq')}
              >
                <div className="type-icon-box mcq-bg">+</div>
                <div className="type-details">
                  <h4>+ MCQ</h4>
                  <p>Multiple Choice Question with options</p>
                </div>
              </button>

              <button
                type="button"
                className="type-select-card"
                onClick={() => openEditor(typeSelectorPartIndex, 'written')}
              >
                <div className="type-icon-box written-bg">+</div>
                <div className="type-details">
                  <h4>+ Written</h4>
                  <p>Short or long written answer format</p>
                </div>
              </button>

              <button
                type="button"
                className="type-select-card"
                onClick={() => openEditor(typeSelectorPartIndex, 'upload_paper')}
              >
                <div className="type-icon-box paper-bg">+</div>
                <div className="type-details">
                  <h4>+ Upload Question Paper</h4>
                  <p>Attach PDF or Image file question paper</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN MCQ EDITOR PAGE */}
      {editorMode === 'mcq' && (
        <MCQEditorPage
          activityId={activityId}
          formData={formData}
          part={parts[editingPartIndex]}
          partIndex={editingPartIndex}
          questionToEdit={editingQuestionIndex !== null ? parts[editingPartIndex]?.questions?.[editingQuestionIndex] : null}
          editingQuestionIndex={editingQuestionIndex}
          onSaveQuestion={handleSaveMCQQuestion}
          onCancel={resetQuestionForm}
        />
      )}

      {/* MODAL 2: QUESTION EDITOR FOR WRITTEN AND UPLOAD PAPER */}
      {editorMode !== null && editorMode !== 'mcq' && (
        <div className="modal-backdrop" onClick={resetQuestionForm}>
          <div className="modal-card question-editor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header flex-between">
              <div>
                <span className="badge badge-primary">
                  {parts[editingPartIndex]?.title || `Part ${editingPartIndex + 1}`}
                </span>
                <h3 className="modal-title mt-1">
                  {editingQuestionIndex !== null ? 'Edit Question' : 'Add New Question'} (
                  {editorMode === 'written' ? 'Written' : 'Question Paper'}
                  )
                </h3>
              </div>
              <button className="modal-close-btn" onClick={resetQuestionForm}>&times;</button>
            </div>

            <div className="modal-body-scroll mt-3">

              {/* WRITTEN EDITOR */}
              {editorMode === 'written' && (
                <div className="written-editor">
                  <div className="form-group">
                    <label className="form-label" htmlFor="written-prompt">
                      Question Text <span className="req-star">*</span>
                    </label>
                    <textarea
                      id="written-prompt"
                      className="form-input text-area"
                      rows="3"
                      placeholder="Enter question prompt..."
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                    />
                  </div>

                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">
                        Question Image <span className="optional-tag">(Optional)</span>
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        className="form-input file-input"
                        onChange={handleQuestionImageChange}
                      />
                      {questionImageUrl && (
                        <div className="image-preview-sm mt-2">
                          <img src={questionImageUrl} alt="Attachment" />
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="written-marks">
                        Marks {isExam ? <span className="req-star">*</span> : <span className="optional-tag">(Optional)</span>}
                      </label>
                      <input
                        type="number"
                        id="written-marks"
                        className="form-input num-input"
                        min="1"
                        step="0.5"
                        value={marks}
                        onChange={(e) => setMarks(e.target.value)}
                        placeholder="e.g. 5"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="written-desc">
                      Description / Answer Guidelines <span className="optional-tag">(Optional)</span>
                    </label>
                    <textarea
                      id="written-desc"
                      className="form-input text-area"
                      rows="2"
                      placeholder="Add guidelines for students responding to this question..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* UPLOAD QUESTION PAPER EDITOR */}
              {editorMode === 'upload_paper' && (
                <div className="paper-upload-editor">
                  <div className="form-group">
                    <label className="form-label">
                      Question Paper File (JPG, JPEG, PNG, or PDF) <span className="req-star">*</span>
                    </label>
                    <input
                      type="file"
                      accept=".jpg, .jpeg, .png, .pdf"
                      className="form-input file-input"
                      onChange={handlePaperFileChange}
                    />
                    <span className="file-hint block mt-1">Allowed: PDF, PNG, JPG (Max 15MB)</span>
                    {paperFileName && <div className="selected-file-badge mt-2">Selected: {paperFileName}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="instructions">
                      Instructions / Description for Answer <span className="optional-tag">(Optional)</span>
                    </label>
                    <textarea
                      id="instructions"
                      className="form-input text-area"
                      rows="3"
                      placeholder="Enter instructions for students..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  {isExam && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="paper-marks">
                        Total Marks for Paper <span className="req-star">*</span>
                      </label>
                      <input
                        type="number"
                        id="paper-marks"
                        className="form-input num-input"
                        min="1"
                        value={marks}
                        onChange={(e) => setMarks(e.target.value)}
                        placeholder="e.g. 50"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-actions flex-between mt-4">
              <button type="button" className="btn btn-secondary" onClick={resetQuestionForm}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveQuestion}
                disabled={fileUploading}
              >
                {fileUploading ? (
                  <div className="spinner-container">
                    <div className="spinner"></div>
                    <span>Uploading...</span>
                  </div>
                ) : (
                  <span>{editingQuestionIndex !== null ? 'Save Changes' : 'Save Question'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deletingTarget !== null && (
        <div className="modal-backdrop" onClick={() => setDeletingTarget(null)}>
          <div className="modal-card delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title text-danger">Delete Question</h3>
            </div>
            <div className="modal-body mt-3">
              <p>Are you sure you want to delete this question?</p>
              {deletingTarget?.question?.questionText && (
                <p className="delete-preview-quote mt-2">
                  "{deletingTarget.question.questionText}"
                </p>
              )}
            </div>
            <div className="modal-actions flex-between mt-4">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDeleteQuestion}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
