import { useState, useEffect } from 'react';
import Step2BasicInfo from './Step2BasicInfo';
import Step3QuestionsSetup from './Step3QuestionsSetup';
import Step4ParticipantForm from './Step4ParticipantForm';
import Step5FinalizeShare from './Step5FinalizeShare';
import { generateActivityId, saveActivityDraft, publishActivity } from '../../services/activityService';
import logoImg from '../../assets/logo.png';

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
    partMode: 'parts', // 'parts' (Tab 1: Part Configuration) | 'sections' (Tab 2: Sections / Groups)
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
    sections: [],
    timeConfiguration: 'start_on_begin',
    duration: { months: 0, hours: 1, minutes: 0, seconds: 0 },
    password: '',
    participantLimit: '',
    autoGradeMCQ: true,
    enableNegativeMarking: false,
    negativeMarkValue: '0.25',
    showPercentageScore: true,
    participantForm: [
      { id: 'field_name', label: 'Name', isOptional: false, required: true }
    ]
  });

  const updateFormData = (updates) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  // Sync state with browser history (Android Back button, swipe-back gesture, browser back/forward)
  useEffect(() => {
    // Push initial step 1 state when wizard opens
    if (!window.history.state?.wizardOpen) {
      window.history.pushState({ wizardStep: 1, wizardOpen: true }, '', window.location.href);
    }

    const handlePopState = (event) => {
      const state = event.state;
      if (state && state.wizardOpen) {
        if (state.wizardStep) {
          setCurrentStep(state.wizardStep);
        }
      } else {
        // User backed out of the wizard to the dashboard
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onClose]);

  // Step 1 (Basic Info) -> Step 2 (Questions): Save draft
  const handleStep1Next = async () => {
    setSaving(true);
    try {
      await saveActivityDraft(activityId, formData);
      window.history.pushState({ wizardStep: 2, wizardOpen: true }, '', window.location.href);
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
      window.history.pushState({ wizardStep: 3, wizardOpen: true }, '', window.location.href);
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
      window.history.pushState({ wizardStep: 4, wizardOpen: true }, '', window.location.href);
      setCurrentStep(4);
    } catch (err) {
      console.error("Publish activity error:", err);
    } finally {
      setSaving(false);
    }
  };

  // Reset questions and return to Step 1 when Cancel is confirmed in Question Setup or Participant Form
  const handleResetQuestionsAndGoToStep1 = () => {
    const resetParts = (formData.parts || []).map((p) => ({
      ...p,
      questions: []
    }));
    const resetSections = (formData.sections || []).map((sec) => ({
      ...sec,
      parts: (sec.parts || []).map((p) => ({
        ...p,
        questions: []
      }))
    }));
    updateFormData({ parts: resetParts, sections: resetSections });
    
    if (currentStep > 1 && window.history.state?.wizardOpen) {
      window.history.go(-(currentStep - 1));
    } else {
      setCurrentStep(1);
    }
  };

  const handleHeaderBack = () => {
    if (window.history.state?.wizardOpen) {
      window.history.back();
    } else {
      if (currentStep === 1) {
        onClose();
      } else {
        setCurrentStep((prev) => prev - 1);
      }
    }
  };

  return (
    <div className="fullscreen-wizard-overlay fade-in">
      <div className="fullscreen-wizard-container">
        {/* Wizard Top Header Bar with Back Button on Left, and Logo + Activity Creator on Right */}
        <div className="fullscreen-wizard-header">
          <div className="wizard-header-left">
            <button
              type="button"
              className="btn-back-circular"
              onClick={handleHeaderBack}
              title={currentStep === 1 ? "Return to Admin Dashboard" : "Go to previous step"}
              aria-label="Back"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
          </div>

          <div className="wizard-header-right">
            <div className="brand-badge-sm">
              <img src={logoImg} alt="Quizora" className="brand-logo-img" />
              <span className="wizard-header-title">Activity Creator</span>
            </div>
          </div>
        </div>

        {/* Step Progress Bar (4 Streamlined Connected Steps) */}
        <div className="wizard-progress-bar">
          <div className="wizard-progress-track">
            {[
              { num: 1, label: 'Basic Info', mobileLabel: 'Info' },
              { num: 2, label: 'Questions', mobileLabel: 'Questions' },
              { num: 3, label: 'Participant Form', mobileLabel: 'Form' },
              { num: 4, label: 'Share Link', mobileLabel: 'Share' }
            ].map((s, index, arr) => {
              const isActive = currentStep === s.num;
              const isDone = currentStep > s.num;
              return (
                <div key={s.num} className={`wizard-step-node ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                  <div className="step-badge-pill">
                    <span className="step-circle">
                      {isDone ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="13" height="13">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        s.num
                      )}
                    </span>
                    <span className="step-text-desktop">{s.label}</span>
                    <span className="step-text-mobile">{s.mobileLabel}</span>
                  </div>
                  {index < arr.length - 1 && (
                    <div className={`step-connector ${isDone ? 'done' : ''}`} />
                  )}
                </div>
              );
            })}
          </div>
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
              onResetQuestions={handleResetQuestionsAndGoToStep1}
              saving={saving}
            />
          )}

          {currentStep === 3 && (
            <Step4ParticipantForm
              formData={formData}
              updateFormData={updateFormData}
              onNext={handleStep3Complete}
              onBack={() => setCurrentStep(2)}
              onResetQuestions={handleResetQuestionsAndGoToStep1}
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
