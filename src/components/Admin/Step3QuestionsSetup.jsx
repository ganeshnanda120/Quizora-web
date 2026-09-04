import { useState, useEffect } from 'react';
import MCQEditorPage from './MCQEditorPage';
import WrittenEditorPage from './WrittenEditorPage';
import UploadEditorPage from './UploadEditorPage';

export default function Step3QuestionsSetup({
  activityId,
  formData,
  updateFormData,
  onNext,
  onBack,
  onResetQuestions,
  saving
}) {
  const partMode = formData.partMode || 'parts'; // 'parts' | 'sections'

  // Normal parts (Tab 1)
  const parts = formData.parts || [{ id: 'part_1', title: 'Part 1', questions: [] }];

  // Sections (Tab 2)
  const sections = formData.sections || [];

  // Modal & Selection States
  const [typeSelectorTarget, setTypeSelectorTarget] = useState(null); // { secIdx, partIndex }
  const [editorMode, setEditorMode] = useState(null); // null, 'mcq', 'written', 'upload_paper'
  const [editingSecIdx, setEditingSecIdx] = useState(null);
  const [editingPartIndex, setEditingPartIndex] = useState(0);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  const [deletingTarget, setDeletingTarget] = useState(null); // { secIdx, partIndex, qIdx, question }
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewActiveSectionIdx, setPreviewActiveSectionIdx] = useState(0);
  const [previewActivePartIdx, setPreviewActivePartIdx] = useState(0);

  const [error, setError] = useState('');

  const isExam = formData.purpose === 'Exam';

  const resetQuestionForm = () => {
    setEditingQuestionIndex(null);
    setEditorMode(null);
    setError('');
  };

  // Sync sub-editor mode with browser history (Android Back inside editor returns to questions list)
  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state;
      if (editorMode && (!state || !state.subEditor)) {
        resetQuestionForm();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [editorMode]);

  const handleEditorCancel = () => {
    if (window.history.state?.subEditor) {
      window.history.back();
    } else {
      resetQuestionForm();
    }
  };

  const openTypeSelector = (pIdx, sIdx = null) => {
    setError('');
    setTypeSelectorTarget({ secIdx: sIdx, partIndex: pIdx });
  };

  const openEditor = (pIdx, type, questionToEdit = null, qIdx = null, sIdx = null) => {
    resetQuestionForm();
    setTypeSelectorTarget(null);
    setEditingSecIdx(sIdx);
    setEditingPartIndex(pIdx);
    setEditorMode(type);

    if (questionToEdit) {
      setEditingQuestionIndex(qIdx);
    }

    // Push history state so Android Back returns from sub-editor to questions list
    window.history.pushState({ wizardStep: 2, subEditor: type, wizardOpen: true }, '', window.location.href);
  };

  // Dedicated Save Handler for Full-Screen Editors (MCQ, Written, Upload)
  const handleSaveMCQQuestion = (questionObj, addMore = false) => {
    const isSecMode = partMode === 'sections' && editingSecIdx !== null && editingSecIdx !== undefined;

    if (isSecMode) {
      const updatedSections = [...sections];
      const secParts = [...(updatedSections[editingSecIdx]?.parts || [])];
      const targetPart = secParts[editingPartIndex] || { id: `sec_${editingSecIdx}_p_${editingPartIndex}`, title: `Part ${editingPartIndex + 1}`, questions: [] };
      const partQuestions = [...(targetPart.questions || [])];

      if (editingQuestionIndex !== null && editingQuestionIndex !== undefined) {
        partQuestions[editingQuestionIndex] = questionObj;
      } else {
        partQuestions.push(questionObj);
      }

      secParts[editingPartIndex] = {
        ...targetPart,
        questions: partQuestions
      };

      updatedSections[editingSecIdx] = {
        ...updatedSections[editingSecIdx],
        parts: secParts
      };

      updateFormData({ sections: updatedSections });
    } else {
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
    }

    if (addMore) {
      setEditingQuestionIndex(null);
    } else {
      if (window.history.state?.subEditor) {
        window.history.back();
      } else {
        resetQuestionForm();
      }
    }
  };

  // Delete Question handler
  const confirmDeleteQuestion = () => {
    if (!deletingTarget) return;
    const { secIdx, partIndex, qIdx } = deletingTarget;

    if (partMode === 'sections' && secIdx !== undefined && secIdx !== null) {
      const updatedSections = [...sections];
      const secParts = [...(updatedSections[secIdx]?.parts || [])];
      const partQuestions = (secParts[partIndex]?.questions || []).filter((_, idx) => idx !== qIdx);

      secParts[partIndex] = {
        ...secParts[partIndex],
        questions: partQuestions
      };

      updatedSections[secIdx] = {
        ...updatedSections[secIdx],
        parts: secParts
      };

      updateFormData({ sections: updatedSections });
    } else {
      const updatedParts = [...parts];
      const partQuestions = (updatedParts[partIndex]?.questions || []).filter((_, idx) => idx !== qIdx);

      updatedParts[partIndex] = {
        ...updatedParts[partIndex],
        questions: partQuestions
      };

      updateFormData({ parts: updatedParts });
    }

    setDeletingTarget(null);
  };

  // Reorder Question handler
  const handleReorderQuestion = (pIdx, qIdx, direction, sIdx = null) => {
    if (partMode === 'sections' && sIdx !== null && sIdx !== undefined) {
      const updatedSections = [...sections];
      const secParts = [...(updatedSections[sIdx]?.parts || [])];
      const qList = [...(secParts[pIdx]?.questions || [])];
      const targetIdx = direction === 'up' ? qIdx - 1 : qIdx + 1;

      if (targetIdx < 0 || targetIdx >= qList.length) return;

      const temp = qList[qIdx];
      qList[qIdx] = qList[targetIdx];
      qList[targetIdx] = temp;

      secParts[pIdx] = {
        ...secParts[pIdx],
        questions: qList
      };

      updatedSections[sIdx] = {
        ...updatedSections[sIdx],
        parts: secParts
      };

      updateFormData({ sections: updatedSections });
    } else {
      const updatedParts = [...parts];
      const qList = [...(updatedParts[pIdx]?.questions || [])];
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
    }
  };

  // Format Helper for Question Count
  const getQuestionCountText = (count) => {
    if (count === 1) return '1 Q';
    return `${count} Qs`;
  };

  // Validation before proceed
  const handleCompleteAllQuestions = () => {
    setError('');

    if (partMode === 'sections') {
      if (sections.length === 0) {
        setError('Please create at least one section with parts and questions.');
        return;
      }

      for (let s = 0; s < sections.length; s++) {
        const sec = sections[s];
        const secParts = sec.parts || [];

        if (secParts.length === 0) {
          setError(`Section ${s + 1} ("${sec.name || `Section ${s + 1}`}") has no parts configured.`);
          return;
        }

        for (let i = 0; i < secParts.length; i++) {
          const p = secParts[i];
          const qList = p.questions || [];

          if (qList.length === 0) {
            setError(`In section "${sec.name || `Section ${s + 1}`}", Part ${i + 1} ("${p.title || `Part ${i + 1}`}") has no questions added. Please add questions.`);
            return;
          }

          if (isExam) {
            const missingMarks = qList.some((q) => q.marks === null || q.marks === undefined || q.marks <= 0);
            if (missingMarks) {
              setError(`In section "${sec.name || `Section ${s + 1}`}", all questions in Part ${i + 1} ("${p.title || `Part ${i + 1}`}") must have compulsory marks for an Exam.`);
              return;
            }
          }

          const targetPartTotal = Number(p.partTotalMarks) || 0;
          const partQuestionSum = qList.reduce((acc, q) => acc + (Number(q.marks) || 0), 0);

          if (targetPartTotal > 0 && partQuestionSum !== targetPartTotal) {
            if (partQuestionSum < targetPartTotal) {
              setError(`In section "${sec.name || `Section ${s + 1}`}", Part ${i + 1} ("${p.title || `Part ${i + 1}`}") total question marks (${partQuestionSum} pts) is less than configured marks (${targetPartTotal} pts).`);
            } else {
              setError(`In section "${sec.name || `Section ${s + 1}`}", Part ${i + 1} ("${p.title || `Part ${i + 1}`}") total question marks (${partQuestionSum} pts) exceeds configured marks (${targetPartTotal} pts).`);
            }
            return;
          }
        }
      }
    } else {
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
    }

    onNext();
  };

  const handleConfirmCancel = () => {
    setShowCancelModal(false);
    if (onResetQuestions) {
      onResetQuestions();
    } else if (onBack) {
      onBack();
    }
  };

  // Determine active section/part for modal badges
  const activeModalSection = (partMode === 'sections' && editingSecIdx !== null && editingSecIdx !== undefined)
    ? sections[editingSecIdx]
    : (typeSelectorTarget?.secIdx !== null && typeSelectorTarget?.secIdx !== undefined ? sections[typeSelectorTarget.secIdx] : null);

  const activeModalPart = activeModalSection
    ? (activeModalSection.parts?.[editingPartIndex] || activeModalSection.parts?.[typeSelectorTarget?.partIndex])
    : parts[editingPartIndex || typeSelectorTarget?.partIndex || 0];

  return (
    <div className="wizard-step-container fade-in">
      <div className="wizard-step-header flex-between align-center flex-wrap gap-3">
        <div>
          <h2 className="wizard-step-title">Question Creation &amp; Setup</h2>
          <p className="wizard-step-subtitle">
            {partMode === 'sections'
              ? 'Add and configure independent questions for each Section and Part.'
              : 'Add and manage questions for each part of your activity.'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-preview-toggle"
          onClick={() => {
            setPreviewActiveSectionIdx(0);
            setPreviewActivePartIdx(0);
            setShowPreviewModal(true);
          }}
          title="Preview questions as they appear on the student screen"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>Preview Questions</span>
        </button>
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

      {/* SECTIONS MODE: RENDER SECTIONS SEQUENTIALLY ONE BY ONE */}
      {partMode === 'sections' ? (
        <div className="all-sections-questions-container">
          {sections.map((sec, sIdx) => {
            const secParts = sec.parts || [];
            const totalSecQuestions = secParts.reduce((acc, p) => acc + (p.questions?.length || 0), 0);

            return (
              <div key={sec.id || sIdx} className="section-questions-block mb-8 p-5 border rounded-lg bg-white shadow-sm">
                <div className="section-block-header flex-between align-center pb-3 mb-4 border-bottom">
                  <div>
                    <span className="text-xs uppercase font-bold text-primary tracking-wider block">
                      SECTION {sIdx + 1}
                    </span>
                    <h3 className="section-block-title font-bold text-dark text-xl m-0">
                      {sec.name || `Section ${sIdx + 1}`}
                    </h3>
                  </div>
                  <span className="badge badge-info text-xs font-semibold px-3 py-1 bg-light text-primary border rounded-full">
                    {secParts.length} {secParts.length === 1 ? 'Part' : 'Parts'} • {totalSecQuestions} {totalSecQuestions === 1 ? 'Question' : 'Questions'}
                  </span>
                </div>

                {/* Parts within this Section */}
                <div className="parts-questions-workspace">
                  {secParts.map((part, pIdx) => {
                    const qList = part.questions || [];
                    const qCount = qList.length;

                    return (
                      <div key={part.id || pIdx} className="part-questions-box mb-5">
                        {/* PART HEADER ROW */}
                        <div className="part-header-card">
                          <div className="part-header-left">
                            <h4 className="part-name-text">
                              <span className="sec-prefix-badge mr-2">[{sec.name || `Section ${sIdx + 1}`}]</span>
                              {part.title || `Part ${pIdx + 1}`}
                              <span className="part-q-count"> ({getQuestionCountText(qCount)})</span>
                            </h4>
                          </div>
                          <div className="part-header-right-container">
                            <button
                              type="button"
                              className="add-question-header-title-btn"
                              onClick={() => openTypeSelector(pIdx, sIdx)}
                            >
                              + Add Question
                            </button>
                            <div className="quick-question-type-buttons">
                              <button
                                type="button"
                                className="btn btn-type-quick mcq"
                                onClick={() => openEditor(pIdx, 'mcq', null, null, sIdx)}
                              >
                                + MCQ
                              </button>
                              <button
                                type="button"
                                className="btn btn-type-quick written"
                                onClick={() => openEditor(pIdx, 'written', null, null, sIdx)}
                              >
                                + Written
                              </button>
                              <button
                                type="button"
                                className="btn btn-type-quick upload-icon"
                                onClick={() => openEditor(pIdx, 'upload', null, null, sIdx)}
                                title="Upload Image/PDF Question"
                                aria-label="Upload Image/PDF Question"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                  <polyline points="17 8 12 3 7 8"/>
                                  <line x1="12" y1="3" x2="12" y2="15"/>
                                </svg>
                                <span>+ Upload</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* QUESTION CARDS LIST FOR THIS PART */}
                        <div className="part-questions-body">
                          {qCount === 0 ? (
                            <div className="empty-questions-card">
                              <p>No questions added yet to this part.</p>
                            </div>
                          ) : (
                            <div className="questions-card-grid">
                              {qList.map((q, qIdx) => (
                                <div key={q.id || qIdx} className="question-display-card">
                                  <div className="q-card-main-content">
                                    <div className="q-card-title-row">
                                      <span className="q-number-label">Q{qIdx + 1}</span>
                                      <span className={`q-type-badge-styled ${q.type}`}>
                                        {q.type === 'mcq' ? '[MCQ]' : q.type === 'written' ? '[Written]' : '[UPLOAD]'}
                                      </span>
                                    </div>

                                    <div className="q-card-text-body mt-1">
                                      <p className="q-text-prompt">
                                        {(q.type === 'upload' || q.type === 'upload_paper')
                                          ? (q.attachedFiles?.length
                                              ? `Uploaded: ${q.attachedFiles.map((f) => f.name).join(', ')}`
                                              : (q.fileName || q.paperFileName ? `Uploaded: ${q.fileName || q.paperFileName}` : 'Uploaded Image/PDF file(s)'))
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
                                          onClick={() => handleReorderQuestion(pIdx, qIdx, 'up', sIdx)}
                                          disabled={qIdx === 0}
                                          title="Move Up"
                                        >
                                          ▲
                                        </button>
                                        <button
                                          type="button"
                                          className="btn-reorder"
                                          onClick={() => handleReorderQuestion(pIdx, qIdx, 'down', sIdx)}
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
                                      onClick={() => openEditor(pIdx, q.type, q, qIdx, sIdx)}
                                      title="Edit Question"
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-q-action delete"
                                      onClick={() => setDeletingTarget({ secIdx: sIdx, partIndex: pIdx, qIdx, question: q })}
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
              </div>
            );
          })}
        </div>
      ) : (
        /* NORMAL PARTS MODE */
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
                        onClick={() => openEditor(pIdx, 'upload')}
                        title="Upload Image/PDF Question"
                        aria-label="Upload Image/PDF Question"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <span>+ Upload</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* QUESTION CARDS LIST FOR THIS PART */}
                <div className="part-questions-body">
                  {qCount === 0 ? (
                    <div className="empty-questions-card">
                      <p>No questions added yet to this part.</p>
                    </div>
                  ) : (
                    <div className="questions-card-grid">
                      {qList.map((q, qIdx) => (
                        <div key={q.id || qIdx} className="question-display-card">
                          <div className="q-card-main-content">
                            <div className="q-card-title-row">
                              <span className="q-number-label">Q{qIdx + 1}</span>
                              <span className={`q-type-badge-styled ${q.type}`}>
                                {q.type === 'mcq' ? '[MCQ]' : q.type === 'written' ? '[Written]' : '[UPLOAD]'}
                              </span>
                            </div>

                            <div className="q-card-text-body mt-1">
                              <p className="q-text-prompt">
                                {(q.type === 'upload' || q.type === 'upload_paper')
                                  ? (q.attachedFiles?.length
                                      ? `Uploaded: ${q.attachedFiles.map((f) => f.name).join(', ')}`
                                      : (q.fileName || q.paperFileName ? `Uploaded: ${q.fileName || q.paperFileName}` : 'Uploaded Image/PDF file(s)'))
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
                              onClick={() => setDeletingTarget({ secIdx: undefined, partIndex: pIdx, qIdx, question: q })}
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
      )}

      {/* Cancel Questions Confirmation Dialog Modal */}
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
                Canceling will <strong>delete and reset all configured questions, parts, and marks</strong> set for this activity and return you to Basic Info.
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
                Yes, Cancel & Reset Questions
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
          onClick={() => setShowCancelModal(true)}
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

      {/* MODAL 1: QUESTION TYPE SELECTION (POPUP) */}
      {typeSelectorTarget !== null && (
        <div className="modal-backdrop" onClick={() => setTypeSelectorTarget(null)}>
          <div className="modal-card type-selection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bar flex-between align-center">
              <div>
                <span className="badge badge-primary">
                  {activeModalSection ? `Section: ${activeModalSection.name || 'Section'} • ` : ''}
                  {activeModalPart?.title || `Part ${(typeSelectorTarget.partIndex || 0) + 1}`}
                </span>
                <h3 className="modal-title-text mt-1 font-bold text-dark text-lg">Select Question Type</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setTypeSelectorTarget(null)}
                title="Close"
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            
            <div className="modal-body-content py-3">
              <p className="text-xs text-muted mb-3">
                Choose the format of the question you want to create for this part.
              </p>
              <div className="type-options-grid">
                <button
                  type="button"
                  className="type-select-card"
                  onClick={() => openEditor(typeSelectorTarget.partIndex, 'mcq', null, null, typeSelectorTarget.secIdx)}
                >
                  <div className="type-icon-box mcq-bg">+</div>
                  <div className="type-details">
                    <h4>Multiple Choice (MCQ)</h4>
                    <p>Single or multiple correct answers with optional auto-grading</p>
                  </div>
                  <span className="type-arrow-icon">&rarr;</span>
                </button>

                <button
                  type="button"
                  className="type-select-card"
                  onClick={() => openEditor(typeSelectorTarget.partIndex, 'written', null, null, typeSelectorTarget.secIdx)}
                >
                  <div className="type-icon-box written-bg">+</div>
                  <div className="type-details">
                    <h4>Written Question</h4>
                    <p>Descriptive, short, or long-form typed answers from students</p>
                  </div>
                  <span className="type-arrow-icon">&rarr;</span>
                </button>

                <button
                  type="button"
                  className="type-select-card"
                  onClick={() => openEditor(typeSelectorTarget.partIndex, 'upload', null, null, typeSelectorTarget.secIdx)}
                >
                  <div className="type-icon-box paper-bg">+</div>
                  <div className="type-details">
                    <h4>Upload Image / PDF</h4>
                    <p>Question paper attachment where students upload handwritten answer files</p>
                  </div>
                  <span className="type-arrow-icon">&rarr;</span>
                </button>
              </div>
            </div>
            
            <div className="modal-footer-bar flex-end pt-3 border-top">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setTypeSelectorTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION PREVIEW MODAL (FULL USER SCREEN PREVIEW) */}
      {showPreviewModal && (
        <div className="modal-backdrop preview-modal-backdrop" onClick={() => setShowPreviewModal(false)}>
          <div className="modal-card wide-modal admin-preview-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="preview-modal-header flex-between align-center">
              <div className="preview-header-info">
                <span className="preview-mode-tag">👁️ ADMIN PREVIEW MODE</span>
                <h3 className="preview-activity-title font-bold text-lg text-dark mt-1">
                  {formData.title || 'Untitled Activity'}
                </h3>
                <div className="preview-meta-chips flex-align-center gap-2 mt-1">
                  <span className="badge badge-primary text-xs">{formData.purpose || 'Exam'}</span>
                  {formData.subject && <span className="badge badge-secondary text-xs">{formData.subject}</span>}
                  {formData.totalMarks && <span className="badge badge-outline text-xs">Total Marks: {formData.totalMarks}</span>}
                </div>
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
              <div className="preview-viewport-container">
                {/* SECTION TABS (IF SECTIONS MODE) */}
                {partMode === 'sections' && sections.length > 0 && (
                  <div className="preview-section-tabs mb-4">
                    <div className="preview-tab-label text-xs font-bold text-muted uppercase mb-2">Sections</div>
                    <div className="preview-tabs-row flex-wrap gap-2">
                      {sections.map((sec, sIdx) => (
                        <button
                          key={sec.id || sIdx}
                          type="button"
                          className={`preview-tab-btn ${previewActiveSectionIdx === sIdx ? 'active' : ''}`}
                          onClick={() => {
                            setPreviewActiveSectionIdx(sIdx);
                            setPreviewActivePartIdx(0);
                          }}
                        >
                          {sec.name || `Section ${sIdx + 1}`}
                          <span className="preview-tab-badge">
                            {(sec.parts || []).reduce((acc, p) => acc + (p.questions?.length || 0), 0)} Qs
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* PART TABS */}
                {(() => {
                  const currentSec = partMode === 'sections' ? sections[previewActiveSectionIdx] : null;
                  const currentPartsList = partMode === 'sections' ? (currentSec?.parts || []) : parts;
                  const activePart = currentPartsList[previewActivePartIdx] || currentPartsList[0];
                  const qList = activePart?.questions || [];

                  return (
                    <div className="preview-part-workspace">
                      {currentPartsList.length > 1 && (
                        <div className="preview-part-tabs mb-4">
                          <div className="preview-tab-label text-xs font-bold text-muted uppercase mb-2">Parts in this Section</div>
                          <div className="preview-tabs-row flex-wrap gap-2">
                            {currentPartsList.map((p, pIdx) => (
                              <button
                                key={p.id || pIdx}
                                type="button"
                                className={`preview-part-pill ${previewActivePartIdx === pIdx ? 'active' : ''}`}
                                onClick={() => setPreviewActivePartIdx(pIdx)}
                              >
                                {p.title || `Part ${pIdx + 1}`}
                                <span className="preview-pill-count">({(p.questions || []).length})</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* PART BANNER */}
                      <div className="preview-part-banner mb-4">
                        <div className="flex-between align-center flex-wrap gap-2">
                          <h4 className="font-bold text-dark text-base m-0">
                            {activePart?.title || `Part ${previewActivePartIdx + 1}`}
                          </h4>
                          {activePart?.partTotalMarks && (
                            <span className="badge badge-primary text-xs">
                              Part Marks: {activePart.partTotalMarks}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* QUESTIONS LIST */}
                      {qList.length === 0 ? (
                        <div className="preview-empty-questions p-5 text-center bg-light border rounded-lg">
                          <p className="text-muted font-medium m-0">
                            No questions added yet to this part. Add questions in the editor to preview them here.
                          </p>
                        </div>
                      ) : (
                        <div className="preview-questions-list flex flex-col gap-4">
                          {qList.map((q, qIdx) => {
                            const isMcq = q.type === 'mcq';
                            const isWritten = q.type === 'written';
                            const isUpload = q.type === 'upload' || q.type === 'upload_paper';
                            const optionsList = q.options || [];

                            return (
                              <div key={q.id || qIdx} className="student-question-card preview-card p-4 border rounded-xl bg-white shadow-sm">
                                {/* QUESTION HEADER */}
                                <div className="student-q-header flex-between align-center mb-3">
                                  <div className="student-q-title-group flex-align-center gap-2">
                                    <span className="student-q-num font-bold text-dark text-base">Q{qIdx + 1}.</span>
                                    <span className={`badge-type-pill text-xs uppercase font-bold ${q.type}`}>
                                      {isMcq ? 'MCQ' : isWritten ? 'Written' : 'Upload'}
                                    </span>
                                  </div>
                                  <div className="student-q-marks-group flex-align-center gap-2">
                                    {q.marks !== null && q.marks !== undefined && q.marks !== '' && (
                                      <span className="student-q-marks-pill font-semibold text-xs bg-primary-light text-primary px-2 py-1 rounded">
                                        {q.marks} {Number(q.marks) === 1 ? 'Mark' : 'Marks'}
                                      </span>
                                    )}
                                    {isMcq && q.negativeMark && Number(q.negativeMark) > 0 && (
                                      <span className="student-q-neg-marks-pill font-semibold text-xs bg-red-50 text-danger px-2 py-1 rounded">
                                        -{q.negativeMark} Neg
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* QUESTION TEXT */}
                                {q.questionText && (
                                  <div className="student-q-prompt mb-3">
                                    <p className="student-q-text font-medium text-base text-dark leading-relaxed m-0">
                                      {q.questionText}
                                    </p>
                                  </div>
                                )}

                                {/* ATTACHMENTS (IMAGES OR PDFS) */}
                                {(q.attachedFiles?.length > 0 || q.imageUrl || q.paperFileUrl) && (
                                  <div className="student-q-attachments-grid mb-3">
                                    {(q.attachedFiles || []).map((fileItem, fIdx) => (
                                      <div key={fileItem.id || fIdx} className="student-attachment-card mb-2">
                                        {fileItem.type === 'image' || (!fileItem.type && fileItem.url?.match(/\.(jpg|jpeg|png|webp)/i)) ? (
                                          <div className="attachment-image-wrapper">
                                            <img
                                              src={fileItem.url}
                                              alt={fileItem.name || 'Question attachment'}
                                              className="attachment-img max-h-64 object-contain rounded border"
                                            />
                                          </div>
                                        ) : (
                                          <div className="attachment-pdf-row flex-align-center gap-2 p-2 bg-light border rounded">
                                            <span className="pdf-icon-badge text-xs font-bold bg-danger text-white px-2 py-1 rounded">PDF</span>
                                            <a
                                              href={fileItem.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="pdf-download-link text-sm font-semibold text-primary"
                                            >
                                              📄 {fileItem.name || 'View Attached PDF'} ↗
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    ))}

                                    {/* Legacy Single Attachment Fallback */}
                                    {(!q.attachedFiles || q.attachedFiles.length === 0) && (q.imageUrl || q.paperFileUrl) && (
                                      <div className="student-attachment-card mb-2">
                                        {q.imageUrl ? (
                                          <img
                                            src={q.imageUrl}
                                            alt="Question attachment"
                                            className="attachment-img max-h-64 object-contain rounded border"
                                          />
                                        ) : (
                                          <div className="attachment-pdf-row flex-align-center gap-2 p-2 bg-light border rounded">
                                            <span className="pdf-icon-badge text-xs font-bold bg-danger text-white px-2 py-1 rounded">PDF</span>
                                            <a
                                              href={q.paperFileUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="pdf-download-link text-sm font-semibold text-primary"
                                            >
                                              📄 {q.paperFileName || 'View Attached PDF'} ↗
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* GUIDELINES / DESCRIPTION */}
                                {(q.answerGuidelines || q.description || q.explanation) && (
                                  <div className="student-guidelines-box mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                    <div className="guidelines-header flex-align-center gap-2 mb-1">
                                      <span className="guidelines-title font-bold text-xs uppercase tracking-wider text-muted">
                                        📌 Instructions / Description
                                      </span>
                                    </div>
                                    <p className="guidelines-content text-sm text-dark m-0">
                                      {q.answerGuidelines || q.description || q.explanation}
                                    </p>
                                  </div>
                                )}

                                {/* QUESTION TYPE SPECIFIC INTERACTIVE INPUT PREVIEWS */}
                                {isMcq && (
                                  <div className="student-mcq-options-grid mt-3 flex flex-col gap-2">
                                    {optionsList.map((opt, optIdx) => {
                                      const optLetter = String.fromCharCode(65 + optIdx);
                                      const isCorrectAdmin = (q.correctIndices || []).includes(optIdx);

                                      return (
                                        <div
                                          key={optIdx}
                                          className={`student-mcq-option-item flex-align-center gap-3 p-3 border rounded-lg transition-all ${isCorrectAdmin ? 'preview-admin-correct' : 'bg-white'}`}
                                        >
                                          <span className="option-letter-circle font-bold text-xs">
                                            {optLetter}
                                          </span>
                                          <span className="option-text text-sm font-medium text-dark flex-1">
                                            {typeof opt === 'string' ? opt : opt?.text || `Option ${optIdx + 1}`}
                                          </span>
                                          {isCorrectAdmin && (
                                            <span className="badge badge-success text-xs font-semibold">
                                              ✓ Correct Answer
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {isWritten && (
                                  <div className="student-written-answer-area mt-3">
                                    <label className="form-label text-xs font-bold text-muted mb-1 block">
                                      Student Answer Box:
                                    </label>
                                    <textarea
                                      className="form-input text-area"
                                      rows="4"
                                      placeholder="Student will type their descriptive answer here..."
                                      disabled
                                    />
                                  </div>
                                )}

                                {isUpload && (
                                  <div className="student-upload-answer-area mt-3 p-4 border-2 border-dashed border-slate-300 rounded-lg text-center bg-slate-50">
                                    <svg className="mx-auto mb-2 text-primary" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                      <polyline points="17 8 12 3 7 8"/>
                                      <line x1="12" y1="3" x2="12" y2="15"/>
                                    </svg>
                                    <p className="text-sm font-semibold text-dark m-0">
                                      Student Upload Area (Images / PDFs)
                                    </p>
                                    <span className="text-xs text-muted block mt-1">
                                      Students will click or drag their handwritten answer sheet files here to upload.
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="modal-footer-bar flex-between align-center pt-3 border-top">
              <span className="text-xs text-muted">
                Admins can review how the questions appear to students. No student answers are recorded in preview mode.
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

      {/* FULL-SCREEN MCQ EDITOR PAGE */}
      {editorMode === 'mcq' && (
        <MCQEditorPage
          activityId={activityId}
          formData={formData}
          sectionName={activeModalSection?.name}
          part={activeModalPart}
          partIndex={editingPartIndex}
          questionToEdit={editingQuestionIndex !== null ? activeModalPart?.questions?.[editingQuestionIndex] : null}
          editingQuestionIndex={editingQuestionIndex}
          onSaveQuestion={handleSaveMCQQuestion}
          onCancel={handleEditorCancel}
        />
      )}

      {/* FULL-SCREEN WRITTEN EDITOR PAGE */}
      {editorMode === 'written' && (
        <WrittenEditorPage
          activityId={activityId}
          formData={formData}
          sectionName={activeModalSection?.name}
          part={activeModalPart}
          partIndex={editingPartIndex}
          questionToEdit={editingQuestionIndex !== null ? activeModalPart?.questions?.[editingQuestionIndex] : null}
          editingQuestionIndex={editingQuestionIndex}
          onSaveQuestion={handleSaveMCQQuestion}
          onCancel={handleEditorCancel}
        />
      )}

      {/* FULL-SCREEN UPLOAD QUESTION EDITOR PAGE */}
      {(editorMode === 'upload' || editorMode === 'upload_paper') && (
        <UploadEditorPage
          activityId={activityId}
          formData={formData}
          sectionName={activeModalSection?.name}
          part={activeModalPart}
          partIndex={editingPartIndex}
          questionToEdit={editingQuestionIndex !== null ? activeModalPart?.questions?.[editingQuestionIndex] : null}
          editingQuestionIndex={editingQuestionIndex}
          onSaveQuestion={handleSaveMCQQuestion}
          onCancel={handleEditorCancel}
        />
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


