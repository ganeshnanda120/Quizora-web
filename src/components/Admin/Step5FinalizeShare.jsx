import { useState } from 'react';

export default function Step5FinalizeShare({ activityId, shareUrl, activityData, onClose }) {
  const [copied, setCopied] = useState(false);
  const [shareNotice, setShareNotice] = useState('');

  const finalUrl = shareUrl || `${window.location.origin}/activity/${activityId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(finalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setShareNotice('Failed to copy. Please copy manually from the link box.');
    }
  };

  const handleShare = async () => {
    setShareNotice('');
    const sharePayload = {
      title: activityData?.title || 'Quizora Activity',
      text: `Join "${activityData?.title || 'Quizora Activity'}" on Quizora:`,
      url: finalUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(sharePayload);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn("Web Share API notice:", err);
        }
      }
    } else {
      // Fallback: Copy link and show social sharing options
      handleCopy();
      setShareNotice('Link copied! You can now paste and share it on WhatsApp, Telegram, Instagram, or email.');
    }
  };

  return (
    <div className="wizard-step-container fade-in text-center">
      <div className="success-icon-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="40" height="40">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>

      <h2 className="wizard-step-title">Activity Created Successfully!</h2>
      <p className="wizard-step-subtitle">
        Your activity is now live and ready. The activity URL below is permanent and will not change.
      </p>

      {/* Summary Pill Details */}
      <div className="activity-summary-pill-box">
        <div className="summary-pill">
          <span className="pill-label">Title</span>
          <span className="pill-val">{activityData?.title}</span>
        </div>
        <div className="summary-pill">
          <span className="pill-label">Type</span>
          <span className="pill-val">{activityData?.purpose}</span>
        </div>
        <div className="summary-pill">
          <span className="pill-label">Parts</span>
          <span className="pill-val">{(activityData?.parts || []).length}</span>
        </div>
      </div>

      {/* Share Card */}
      <div className="share-card-container">
        <label className="form-label block text-left">Your Activity Permanent Link:</label>

        <div className="share-input-group">
          <input
            type="text"
            className="form-input share-url-input"
            value={finalUrl}
            readOnly
          />
          <button
            type="button"
            className={`btn ${copied ? 'btn-success' : 'btn-secondary'}`}
            onClick={handleCopy}
          >
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleShare}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span>Share</span>
          </button>
        </div>

        {shareNotice && <div className="alert alert-info mt-3">{shareNotice}</div>}

        <div className="share-apps-hint mt-3">
          <span>Supported Apps:</span> WhatsApp • Telegram • Instagram • Email • Web Share
        </div>
      </div>

      <div className="wizard-actions-bar flex-center mt-6">
        <button type="button" className="btn btn-primary btn-lg" onClick={onClose}>
          Return to Admin Dashboard
        </button>
      </div>
    </div>
  );
}
