import { useState, useEffect, useRef } from 'react';
import Step2BasicInfo from './Step2BasicInfo';
import Step3QuestionsSetup from './Step3QuestionsSetup';
import Step4ParticipantForm from './Step4ParticipantForm';
import Step5FinalizeShare from './Step5FinalizeShare';
import { generateActivityId, saveActivityDraft, publishActivity, updateExistingActivity } from '../../services/activityService';
import logoImg from '../../assets/logo.png';

export default function CreateActivityWizard({
  user,
  profileData,
  onClose,
  onActivityCreated,
  initialActivity = null,
  onActivityUpdated = null
}) {
  const isEditMode = Boolean(initialActivity);

  // Starts directly at Basic Info (Step 1 of creation wizard)
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [activityId] = useState(() => initialActivity?.activityId || generateActivityId());
  const [publishedUrl, setPublishedUrl] = useState(() => {
    if (initialActivity?.shareUrl) return initialActivity.shareUrl;
    if (initialActivity?.activityId && typeof window !== 'undefined') {
      return `${window.location.origin}/activity/${initialActivity.activityId}`;
    }
    return '';
  });

  const submissionCount = initialActivity?.participantSubmissionsCount ?? (Array.isArray(initialActivity?.submissions) ? initialActivity.submissions.length : 0);
  const hasSubmissions = isEditMode && submissionCount > 0;

  // Main Activity Form Data State
  const [formData, setFormData] = useState(() => {
    if (initialActivity) {
      return {
        purpose: initialActivity.purpose || 'Exam',
        institutionName: initialActivity.institutionName || initialActivity.organization || '',
        adminUid: initialActivity.adminUid || user.uid,
        adminName: initialActivity.adminName || profileData?.fullName || user.displayName || user.email?.split('@')[0] || 'Admin',
        title: initialActivity.title || '',
        subject: initialActivity.subject || '',
        totalMarks: initialActivity.totalMarks ?? '',
        startTime: initialActivity.startTime || '',
        endTime: initialActivity.endTime || '',
        partMode: initialActivity.partMode || (Array.isArray(initialActivity.sections) && initialActivity.sections.length > 0 ? 'sections' : 'parts'),
        partNavigationMode: initialActivity.partNavigationMode || 'sequential',
        isMultiPart: initialActivity.isMultiPart ?? (Array.isArray(initialActivity.parts) && initialActivity.parts.length > 1),
        parts: (Array.isArray(initialActivity.parts) && initialActivity.parts.length > 0)
          ? initialActivity.parts
          : [
              {
                id: 'part_1',
                title: 'Part 1',
                partTotalMarks: '',
                individualStartTime: '',
                individualEndTime: '',
                questions: []
              }
            ],
        sections: Array.isArray(initialActivity.sections) ? initialActivity.sections : [],
        timeConfiguration: initialActivity.timeConfiguration || 'start_on_begin',
        duration: initialActivity.duration || { months: 0, hours: 1, minutes: 0, seconds: 0 },
        password: initialActivity.password || '',
        participantLimit: initialActivity.participantLimit ?? '',
        autoGradeMCQ: initialActivity.autoGradeMCQ ?? true,
        enableNegativeMarking: initialActivity.enableNegativeMarking ?? false,
        negativeMarkValue: initialActivity.negativeMarkValue ?? '0.25',
        showPercentageScore: initialActivity.showPercentageScore ?? true,
        participantForm: (Array.isArray(initialActivity.participantForm) && initialActivity.participantForm.length > 0)
          ? initialActivity.participantForm
          : [
              { id: 'field_name', label: 'Name', isOptional: false, required: true }
            ],
        createdAt: initialActivity.createdAt,
        shareUrl: initialActivity.shareUrl,
        status: initialActivity.status || 'published'
      };
    }

    return {
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
    };
  });

  const formDataRef = useRef(formData);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  const updateFormData = (updates) => {
    setFormData((prev) => {
      const next = { ...prev, ...updates };
      formDataRef.current = next;
      return next;
    });
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

  // Step 1 (Basic Info) -> Step 2 (Questions): Save draft or in-place update
  const handleStep1Next = async (customData) => {
    const payload = (customData && typeof customData === 'object' && !customData.nativeEvent) ? customData : formDataRef.current;
    setSaving(true);
    try {
      if (isEditMode) {
        await updateExistingActivity(activityId, payload, user, profileData);
      } else {
        await saveActivityDraft(activityId, payload);
      }
      window.history.pushState({ wizardStep: 2, wizardOpen: true }, '', window.location.href);
      setCurrentStep(2);
    } catch (err) {
      console.error("Save step 1 error:", err);
    } finally {
      setSaving(false);
    }
  };

  // Step 2 (Questions) -> Step 3 (Participant Form): Save draft or in-place update
  const handleStep2Next = async (customData) => {
    const payload = (customData && typeof customData === 'object' && !customData.nativeEvent) ? customData : formDataRef.current;
    setSaving(true);
    try {
      if (isEditMode) {
        await updateExistingActivity(activityId, payload, user, profileData);
      } else {
        await saveActivityDraft(activityId, payload);
      }
      window.history.pushState({ wizardStep: 3, wizardOpen: true }, '', window.location.href);
      setCurrentStep(3);
    } catch (err) {
      console.error("Save questions step 2 error:", err);
    } finally {
      setSaving(false);
    }
  };

  // Step 3 (Participant Form) -> Step 4 (Share Link): Finalize and Save / Publish
  const handleStep3Complete = async (customData) => {
    const payload = (customData && typeof customData === 'object' && !customData.nativeEvent) ? customData : formDataRef.current;
    setSaving(true);
    try {
      if (isEditMode) {
        const updatedPayload = await updateExistingActivity(activityId, payload, user, profileData);
        setPublishedUrl(updatedPayload.shareUrl || publishedUrl);
        if (onActivityUpdated) {
          onActivityUpdated(updatedPayload);
        }
      } else {
        const publishedPayload = await publishActivity(activityId, payload);
        setPublishedUrl(publishedPayload.shareUrl);
        if (onActivityCreated) {
          onActivityCreated(publishedPayload);
        }
      }
      window.history.pushState({ wizardStep: 4, wizardOpen: true }, '', window.location.href);
      setCurrentStep(4);
    } catch (err) {
      console.error("Publish/Update activity error:", err);
    } finally {
      setSaving(false);
    }
  };

  // Reset questions and return to Step 1 when Cancel is confirmed in Question Setup or Participant Form
  const handleResetQuestionsAndGoToStep1 = () => {
    if (isEditMode) {
      // In edit mode, do not delete existing questions - simply return or close
      if (currentStep > 1) {
        setCurrentStep((prev) => prev - 1);
      } else {
        onClose();
      }
      return;
    }

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
              <img src={logoImg} alt="Task Grade" className="brand-logo-img" />
              <span className="wizard-header-title">
                {isEditMode ? `Edit Activity${formData.title ? `: ${formData.title}` : ''}` : 'Activity Creator'}
              </span>
            </div>
          </div>
        </div>

        {/* Notice banner if editing an activity that already has student submissions */}
        {hasSubmissions && (
          <div
            className="alert alert-warning edit-submission-warning fade-in"
            style={{
              margin: '12px 24px 0',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div style={{ fontSize: '0.875rem' }}>
              <strong>Notice:</strong> This activity already has <strong>{submissionCount} participant submission{submissionCount === 1 ? '' : 's'}</strong>. Modifying questions, choices, or total marks may affect existing evaluation records.
            </div>
          </div>
        )}

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
              isEditMode={isEditMode}
            />
          )}

          {currentStep === 4 && (
            <Step5FinalizeShare
              activityId={activityId}
              shareUrl={publishedUrl}
              activityData={formData}
              onClose={onClose}
              isEditMode={isEditMode}
            />
          )}
        </div>
      </div>
    </div>
  );
}
