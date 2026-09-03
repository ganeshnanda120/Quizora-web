import { useState } from 'react';
import { saveSubmissionGrade } from '../../services/adminService';

export default function SubmissionChecker({ submission, activity, onClose, onGraded }) {
  const [grades, setGrades] = useState(() => {
    // Initialized per-question marks awarded and feedback from submission if existing
    const initMap = {};
    const existingGrades = submission.questionGrades || {};

    const parts = activity?.parts || [];
    parts.forEach((p) => {
      (p.questions || []).forEach((q) => {
        const prev = existingGrades[q.id] || {};
        initMap[q.id] = {
          marksAwarded: prev.marksAwarded !== undefined ? prev.marksAwarded : (q.type === 'mcq' && activity.autoGradeMCQ ? (submission.autoMcqMarks?.[q.id] || 0) : ''),
          feedback: prev.feedback || ''
        };
      });
    });
    return initMap;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleGradeChange = (questionId, field, value) => {
    setGrades((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value
      }
    }));
  };

  const handlePublishResults = async () => {
    setError('');
    setSaving(true);

    try {
      let totalMaxMarks = 0;
      let totalObtainedMarks = 0;
      let correctCount = 0;
      let incorrectCount = 0;
      let unansweredCount = 0;

      const parts = activity?.parts || [];

      parts.forEach((p) => {
        (p.questions || []).forEach((q) => {
          const maxM = q.marks ? parseFloat(q.marks) : 0;
          totalMaxMarks += maxM;

          const studentAns = submission.answers?.[q.id];

          if (studentAns === undefined || studentAns === null || studentAns === '') {
            unansweredCount++;
          }

          const qGrade = grades[q.id] || {};
          const awarded = parseFloat(qGrade.marksAwarded || 0);
          totalObtainedMarks += awarded;

          if (awarded === maxM && maxM > 0) {
            correctCount++;
          } else if (awarded < maxM && maxM > 0) {
            incorrectCount++;
          }
        });
      });

      const percentage = totalMaxMarks > 0 ? ((totalObtainedMarks / totalMaxMarks) * 100).toFixed(1) : '100.0';

      const gradeResultPayload = {
        ...submission,
        questionGrades: grades,
        score: totalObtainedMarks,
        totalMarks: totalMaxMarks,
        percentage: parseFloat(percentage),
        correctAnswers: correctCount,
        incorrectAnswers: incorrectCount,
        unansweredQuestions: unansweredCount,
        status: 'Checked',
        checkedBy: activity.adminName || 'Admin'
      };

      await saveSubmissionGrade(submission.submissionId, gradeResultPayload);

      if (onGraded) {
        onGraded(gradeResultPayload);
      }
      onClose();
    } catch (err) {
      console.error("Save grade error:", err);
      setError("Failed to save grading results. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const participantDetails = submission.participantDetails || { Name: submission.participantName || 'Student' };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card submission-checker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="badge badge-primary">{activity?.purpose || 'Exam'} Submission</span>
            <h3 className="modal-title mt-1">Submission Review - {activity?.title}</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="alert alert-error mb-4">{error}</div>}

        {/* Participant Identification Details Box */}
        <div className="participant-info-box mb-4">
          <h4 className="box-subtitle mb-2">Participant Details:</h4>
          <div className="participant-details-grid">
            {Object.entries(participantDetails).map(([key, val]) => (
              <div key={key} className="detail-item">
                <span className="detail-key">{key}:</span>
                <span className="detail-val">{val || 'N/A'}</span>
              </div>
            ))}
            <div className="detail-item">
              <span className="detail-key">Submitted At:</span>
              <span className="detail-val">
                {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Questions and Answers Review Workspace */}
        <div className="questions-checker-list">
          {(activity?.parts || []).map((part, pIdx) => (
            <div key={part.id || pIdx} className="part-checker-block mb-4">
              <h4 className="part-checker-title">{part.title || `Part ${pIdx + 1}`}</h4>

              {(part.questions || []).map((q, qIdx) => {
                const studentAnswer = submission.answers?.[q.id];
                const currentGrade = grades[q.id] || { marksAwarded: '', feedback: '' };

                return (
                  <div key={q.id || qIdx} className="question-check-item">
                    <div className="check-item-header">
                      <span className="q-num">Q{qIdx + 1}.</span>
                      <span className={`q-type-badge ${q.type}`}>{q.type.toUpperCase()}</span>
                      <span className="q-max-marks">Max Marks: {q.marks || 'N/A'}</span>
                    </div>

                    <div className="q-prompt mt-2">
                      <p className="q-text">{q.questionText || q.paperFileName}</p>
                      {q.attachedFiles && q.attachedFiles.length > 0 && (
                        <div className="checker-attached-files-list flex-align-center gap-2 mt-2 flex-wrap">
                          {q.attachedFiles.map((af, afIdx) => (
                            <a
                              key={af.id || afIdx}
                              href={af.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-sm"
                            >
                              {af.type === 'image' ? '🖼️' : '📄'} {af.name || 'View Attachment'} ↗
                            </a>
                          ))}
                        </div>
                      )}
                      {q.paperFileUrl && !q.attachedFiles?.length && (
                        <div className="paper-link-box mt-2">
                          <a href={q.paperFileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                            📄 View Question Paper File
                          </a>
                        </div>
                      )}
                      {(q.answerGuidelines || q.description) && q.type === 'written' && (
                        <div className="checker-guidelines-box mt-2 p-2 bg-light rounded text-xs text-muted">
                          <strong>Guidelines:</strong> {q.answerGuidelines || q.description}
                        </div>
                      )}
                    </div>

                    {/* Student Submitted Answer Display */}
                    <div className="student-answer-box mt-3">
                      <span className="answer-lbl">Participant Answer:</span>
                      <div className="answer-content">
                        {q.type === 'mcq' ? (
                          <div className="mcq-answer-display">
                            <span>Selected Option: <strong>{studentAnswer !== undefined ? (q.options?.[studentAnswer] || studentAnswer) : 'No answer'}</strong></span>
                            {q.correctIndices && (
                              <div className="correct-ans-tag mt-1">
                                Correct Choice(s): {q.correctIndices.map((ci) => q.options?.[ci]).join(', ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="written-answer-text">{studentAnswer || 'No response provided.'}</p>
                        )}
                      </div>
                    </div>

                    {/* Admin Grading Controls */}
                    <div className="grading-controls-row mt-3">
                      <div className="form-group marks-input-group">
                        <label className="form-label" htmlFor={`marks_${q.id}`}>Marks Awarded:</label>
                        <input
                          type="number"
                          id={`marks_${q.id}`}
                          className="form-input num-input"
                          min="0"
                          max={q.marks || 100}
                          step="0.5"
                          value={currentGrade.marksAwarded}
                          onChange={(e) => handleGradeChange(q.id, 'marksAwarded', e.target.value)}
                          placeholder="0"
                        />
                      </div>

                      <div className="form-group feedback-input-group">
                        <label className="form-label" htmlFor={`fb_${q.id}`}>Feedback / Comments:</label>
                        <input
                          type="text"
                          id={`fb_${q.id}`}
                          className="form-input"
                          placeholder="Add feedback for student..."
                          value={currentGrade.feedback}
                          onChange={(e) => handleGradeChange(q.id, 'feedback', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Save & Publish Actions */}
        <div className="modal-actions flex-between mt-4">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Close
          </button>
          <button type="button" className="btn btn-primary" onClick={handlePublishResults} disabled={saving}>
            {saving ? (
              <div className="spinner-container">
                <div className="spinner"></div>
                <span>Publishing Results...</span>
              </div>
            ) : (
              <span>Publish Result &amp; Save Marks &rarr;</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
