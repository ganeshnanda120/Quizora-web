import { useState, useEffect } from 'react';
import { uploadActivityFile } from '../../services/activityService';
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

  const [error, setError] = useState('');
  const [fileUploading, setFileUploading] = useState(false);

  // Form states for active question editor
  const [questionText, setQuestionText] = useState('');
  const [marks, setMarks] = useState('');
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
    setMarks('');
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
      setQuestionText(questionToEdit.questionText || '');
      setMarks(questionToEdit.marks !== undefined && questionToEdit.marks !== null ? String(questionToEdit.marks) : '');
      setDescription(questionToEdit.description || '');
      setQuestionImageUrl(questionToEdit.imageUrl || '');
      setPaperFileUrl(questionToEdit.paperFileUrl || '');
      setPaperFileName(questionToEdit.paperFileName || '');
    }

    // Push history state so Android Back returns from sub-editor to questions list
    window.history.pushState({ wizardStep: 2, subEditor: type, wizardOpen: true }, '', window.location.href);
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

  // Save Question into active section/part
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

      const isSecMode = partMode === 'sections' && editingSecIdx !== null && editingSecIdx !== undefined;

      const activePartsList = isSecMode
        ? (sections[editingSecIdx]?.parts || [])
        : parts;

      const currentPartQuestions = activePartsList[editingPartIndex]?.questions || [];

      const questionObj = {
        id: editingQuestionIndex !== null ? currentPartQuestions[editingQuestionIndex].id : `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: editorMode,
        questionText: questionText.trim(),
        marks: marks ? parseFloat(marks) : null,
        description: description.trim(),
        imageUrl: finalImageUrl,
        paperFileUrl: finalPaperUrl,
        paperFileName: paperFileName || (paperFile ? paperFile.name : ''),
        createdAt: new Date().toISOString()
      };

      if (isSecMode) {
        const updatedSections = [...sections];
        const secParts = [...(updatedSections[editingSecIdx]?.parts || [])];
        const targetPart = secParts[editingPartIndex] || { id: `sec_${editingSecIdx}_p_${editingPartIndex}`, title: `Part ${editingPartIndex + 1}`, questions: [] };
        const partQuestions = [...(targetPart.questions || [])];

        if (editingQuestionIndex !== null) {
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
        const partQuestions = [...(updatedParts[editingPartIndex]?.questions || [])];

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
      }

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
      <div className="wizard-step-header">
        <h2 className="wizard-step-title">Question Creation &amp; Setup</h2>
        <p className="wizard-step-subtitle">
          {partMode === 'sections'
            ? 'Add and configure independent questions for each Section and Part.'
            : 'Add and manage questions for each part of your activity.'}
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

      {/* MODAL 1: QUESTION TYPE SELECTION */}
      {typeSelectorTarget !== null && (
        <div className="modal-backdrop" onClick={() => setTypeSelectorTarget(null)}>
          <div className="modal-card type-selection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header flex-between">
              <div>
                <span className="badge badge-primary">
                  {activeModalSection ? `Section: ${activeModalSection.name || 'Section'} • ` : ''}
                  {activeModalPart?.title || `Part ${(typeSelectorTarget.partIndex || 0) + 1}`}
                </span>
                <h3 className="modal-title mt-1">Add Question</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setTypeSelectorTarget(null)}>&times;</button>
            </div>
            <div className="type-options-grid mt-4">
              <button
                type="button"
                className="type-select-card"
                onClick={() => openEditor(typeSelectorTarget.partIndex, 'mcq', null, null, typeSelectorTarget.secIdx)}
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
                onClick={() => openEditor(typeSelectorTarget.partIndex, 'written', null, null, typeSelectorTarget.secIdx)}
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
                onClick={() => openEditor(typeSelectorTarget.partIndex, 'upload', null, null, typeSelectorTarget.secIdx)}
              >
                <div className="type-icon-box paper-bg">+</div>
                <div className="type-details">
                  <h4>+ Upload</h4>
                  <p>Upload one or more Image or PDF files</p>
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


