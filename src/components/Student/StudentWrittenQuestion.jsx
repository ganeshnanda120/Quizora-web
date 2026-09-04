export default function StudentWrittenQuestion({
  question,
  questionNumber,
  value,
  onChange,
  disabled = false
}) {
  if (!question) return null;

  const isRequired = question.answerRequired !== false;
  const guidelines = question.answerGuidelines || question.description;
  const attachedFiles = question.attachedFiles || [];

  return (
    <div className="student-written-question-card">
      {/* Question Header */}
      <div className="student-q-header flex-between align-center mb-3">
        <div className="student-q-title-group flex-align-center gap-2">
          {questionNumber !== undefined && (
            <span className="student-q-num font-bold">Q{questionNumber}.</span>
          )}
          <span className="badge-written-type-pill font-bold text-xs uppercase">
            Written
          </span>
        </div>

        {question.marks !== null && question.marks !== undefined && (
          <span className="student-q-marks-pill font-semibold text-xs">
            {question.marks} {Number(question.marks) === 1 ? 'Mark' : 'Marks'}
          </span>
        )}
      </div>

      {/* Question Text */}
      <div className="student-q-prompt mb-3">
        <p className="student-q-text font-medium text-base text-dark leading-relaxed">
          {question.questionText}
        </p>
      </div>

      {/* Attachments (Image or PDF) */}
      {attachedFiles.length > 0 && (
        <div className="student-q-attachments-grid mb-4">
          {attachedFiles.map((fileItem, fIdx) => (
            <div key={fileItem.id || fIdx} className="student-attachment-card">
              {fileItem.type === 'image' || (!fileItem.type && fileItem.url?.match(/\.(jpg|jpeg|png|gif|webp)/i)) ? (
                <div className="attachment-image-wrapper">
                  <img
                    src={fileItem.url}
                    alt={fileItem.name || 'Question attachment'}
                    className="attachment-img"
                    onClick={() => window.open(fileItem.url, '_blank')}
                  />
                  <span className="click-to-expand-hint">Click image to expand ↗</span>
                </div>
              ) : (
                <div className="attachment-pdf-row flex-align-center gap-3">
                  <div className="pdf-icon-badge">PDF</div>
                  <a
                    href={fileItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pdf-download-link font-semibold text-sm hover-underline"
                  >
                    📄 {fileItem.name || 'View PDF Attachment'} ↗
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Single legacy attachment fallback */}
      {attachedFiles.length === 0 && question.imageUrl && (
        <div className="student-q-attachment-single mb-4">
          <img
            src={question.imageUrl}
            alt="Question illustration"
            className="attachment-img"
            onClick={() => window.open(question.imageUrl, '_blank')}
          />
        </div>
      )}

      {/* DESCRIPTION / ANSWER GUIDELINES BOX FOR THE USER ATTENDING THE EXAM */}
      {guidelines && (
        <div className="student-guidelines-box mb-4">
          <div className="guidelines-header flex-align-center gap-2 mb-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span className="guidelines-title font-bold text-xs uppercase tracking-wider">
              Instructions / Description
            </span>
          </div>
          <p className="guidelines-content text-sm text-dark leading-normal">
            {guidelines}
          </p>
        </div>
      )}

      {/* STUDENT ANSWER AREA */}
      <div className="student-answer-input-container">
        <label className="form-label font-bold text-sm mb-2 block" htmlFor={`student-answer-${question.id}`}>
          Your Answer {isRequired ? <span className="req-star">*</span> : <span className="optional-tag font-normal">(Optional)</span>}
        </label>
        <textarea
          id={`student-answer-${question.id}`}
          className="form-input text-area student-written-textarea"
          rows="6"
          placeholder="Write your answer here..."
          value={value || ''}
          onChange={(e) => onChange && onChange(e.target.value)}
          disabled={disabled}
          required={isRequired}
        />
      </div>
    </div>
  );
}
