import { useState } from 'react';
import Step2BasicInfo from './Step2BasicInfo';
import Step3QuestionsSetup from './Step3QuestionsSetup';
import Step4ParticipantForm from './Step4ParticipantForm';
import Step5FinalizeShare from './Step5FinalizeShare';
import { generateActivityId, saveActivityDraft, publishActivity } from '../../services/activityService';

export default function CreateActivityWizard({ user, profileData, onClose, onActivityCreated }) {
  // Starts directly at Basic Info (Step 1 of creation wizard)
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [activityId] = useState(() => generateActivityId());
  const [publishedUrl, setPublishedUrl] = useState('');

  // Main Activity Form Data State
  const [formData, setFormData] = useState({
    purpose: 'Exam',
    institutionName: '',
    adminUid: user.uid,
    adminName: profileData?.fullName || user.displayName || user.email?.split('@')[0] || 'Admin',
    title: '',
    subject: '',
    totalMarks: '',
    startTime: '',
    endTime: '',
    partNavigationMode: 'sequential', // 'sequential' (A), 'free' (B), 'individualTime' (C)
    isMultiPart: false,
    parts: [
      {
        id: 'part_1',
        title: 'Part 1',
        partTotalMarks: '',
        individualStartTime: '',
        individualEndTime: '',
        questions: []
      }
    ],
    timeConfiguration: 'start_on_begin',
    duration: { months: 0, hours: 1, minutes: 0, seconds: 0 },
    password: '',
    participantLimit: '',
    autoGradeMCQ: true,
    enableNegativeMarking: false,
    negativeMarkValue: '0.25',
    showPercentageScore: true,
    participantForm: [
      { id: 'field_name', label: 'Name', required: true, isDefault: true }
    ]
  });

  const updateFormData = (updates) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  // Step 1 (Basic Info) -> Step 2 (Questions): Save draft
  const handleStep1Next = async () => {
    setSaving(true);
    try {
      await saveActivityDraft(activityId, formData);
      setCurrentStep(2);
    } catch (err) {
      console.error("Save draft error:", err);
    } finally {
      setSaving(false);
    }
  };

  // Step 2 (Questions) -> Step 3 (Participant Form): Save draft with questions
  const handleStep2Next = async () => {
    setSaving(true);
    try {
      await saveActivityDraft(activityId, formData);
      setCurrentStep(3);
    } catch (err) {
      console.error("Save questions draft error:", err);
    } finally {
      setSaving(false);
    }
  };

  // Step 3 (Participant Form) -> Step 4 (Share Link): Finalize and Publish
  const handleStep3Complete = async () => {
    setSaving(true);
    try {
      const publishedPayload = await publishActivity(activityId, formData);
      setPublishedUrl(publishedPayload.shareUrl);
      if (onActivityCreated) {
        onActivityCreated(publishedPayload);
      }
      setCurrentStep(4);
    } catch (err) {
      console.error("Publish activity error:", err);
    } finally {
      setSaving(false);
    }
  };

  // Reset all questions in all parts and return to Questions Setup (Step 2)
  const handleResetQuestionsAndBack = () => {
    const resetParts = (formData.parts || []).map((p) => ({
      ...p,
      questions: []
    }));
    updateFormData({ parts: resetParts });
    setCurrentStep(2);
  };

  return (
    <div className="fullscreen-wizard-overlay fade-in">
      <div className="fullscreen-wizard-container">
        {/* Wizard Top Header Bar with Circular Back Button on top-left corner */}
        <div className="fullscreen-wizard-header">
          <div className="header-left-actions">
            <button
              type="button"
              className="btn-back-circular"
              onClick={() => {
                if (currentStep === 1) {
                  onClose();
                } else if (currentStep === 2) {
                  setCurrentStep(1);
                } else if (currentStep === 3) {
                  const confirmReset = window.confirm(
                    "Are you sure you want to cancel and go back? Going back from Participant Form will reset and delete all configured questions for this activity."
                  );
                  if (confirmReset) {
                    handleResetQuestionsAndBack();
                  }
                } else {
                  setCurrentStep(currentStep - 1);
                }
              }}
              title={currentStep === 1 ? "Return to Admin Dashboard" : "Go to previous step"}
              aria-label="Back"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
          </div>

          <div className="brand-badge-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Quizora Activity Creator</span>
          </div>

          <button className="modal-close-btn" onClick={onClose} aria-label="Exit wizard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Step Progress Bar (4 Streamlined Steps) */}
        <div className="wizard-progress-bar">
          {[
            { num: 1, label: 'Basic Info' },
            { num: 2, label: 'Questions' },
            { num: 3, label: 'Participant Form' },
            { num: 4, label: 'Share Link' }
          ].map((s) => {
            const isActive = currentStep === s.num;
            const isDone = currentStep > s.num;
            return (
              <div key={s.num} className={`progress-step-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                <div className="step-num-circle">{isDone ? '✓' : s.num}</div>
                <span className="step-label-text">{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Wizard Content Body */}
        <div className="wizard-body-content fullscreen-wizard-body">
          {currentStep === 1 && (
            <Step2BasicInfo
              user={user}
              profileData={profileData}
              formData={formData}
              updateFormData={updateFormData}
              onNext={handleStep1Next}
              onBack={onClose}
              saving={saving}
            />
          )}

          {currentStep === 2 && (
            <Step3QuestionsSetup
              activityId={activityId}
              formData={formData}
              updateFormData={updateFormData}
              onNext={handleStep2Next}
              onBack={() => setCurrentStep(1)}
              saving={saving}
            />
          )}

          {currentStep === 3 && (
            <Step4ParticipantForm
              formData={formData}
              updateFormData={updateFormData}
              onNext={handleStep3Complete}
              onBack={() => setCurrentStep(2)}
              onResetAndBack={handleResetQuestionsAndBack}
              saving={saving}
            />
          )}

          {currentStep === 4 && (
            <Step5FinalizeShare
              activityId={activityId}
              shareUrl={publishedUrl}
              activityData={formData}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
