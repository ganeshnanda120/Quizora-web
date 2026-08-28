import { useState, useEffect } from 'react';
import { getAdminSubmissions, getAdminActivities } from '../../services/adminService';
import SubmissionChecker from './SubmissionChecker';

export default function SubmissionsList({ user, onBack }) {
  const [submissions, setSubmissions] = useState([]);
  const [activitiesMap, setActivitiesMap] = useState({});
  const [loading, setLoading] = useState(true);

  // Search & Sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('Submission Time');

  // Selected submission for grading
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  const loadSubmissionsData = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const subList = await getAdminSubmissions(user.uid);
      const actList = await getAdminActivities(user.uid);

      const aMap = {};
      actList.forEach((a) => {
        aMap[a.activityId] = a;
      });

      setSubmissions(subList);
      setActivitiesMap(aMap);
    } catch (err) {
      console.warn("Load admin submissions error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      if (!user?.uid) return;
      setLoading(true);
      try {
        const subList = await getAdminSubmissions(user.uid);
        const actList = await getAdminActivities(user.uid);

        const aMap = {};
        actList.forEach((a) => {
          aMap[a.activityId] = a;
        });

        if (isMounted) {
          setSubmissions(subList);
          setActivitiesMap(aMap);
        }
      } catch (err) {
        console.warn("Load admin submissions error:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Filter and sort submissions
  const filteredSubmissions = submissions.filter((sub) => {
    const participantName = sub.participantDetails?.Name || sub.participantName || '';
    const rollNumber = sub.participantDetails?.['Roll Number'] || sub.participantDetails?.['Registration Number'] || '';
    const activityTitle = sub.activityTitle || activitiesMap[sub.activityId]?.title || '';

    const query = searchQuery.toLowerCase();
    return (
      !query ||
      participantName.toLowerCase().includes(query) ||
      rollNumber.toLowerCase().includes(query) ||
      activityTitle.toLowerCase().includes(query)
    );
  });

  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    if (sortBy === 'Name') {
      const nameA = a.participantDetails?.Name || a.participantName || '';
      const nameB = b.participantDetails?.Name || b.participantName || '';
      return nameA.localeCompare(nameB);
    }
    if (sortBy === 'Roll Number') {
      const rollA = a.participantDetails?.['Roll Number'] || '';
      const rollB = b.participantDetails?.['Roll Number'] || '';
      return rollA.localeCompare(rollB);
    }
    if (sortBy === 'Score') {
      return (b.score || 0) - (a.score || 0);
    }
    if (sortBy === 'Status') {
      const statusA = a.status || 'Pending';
      const statusB = b.status || 'Pending';
      return statusA.localeCompare(statusB);
    }
    // Default: Submission Time (newest first)
    const timeA = new Date(a.submittedAt || 0).getTime();
    const timeB = new Date(b.submittedAt || 0).getTime();
    return timeB - timeA;
  });

  return (
    <div className="submissions-list-container fade-in">
      <div className="view-header flex-between mb-4">
        <div>
          <button type="button" className="btn btn-ghost btn-sm mb-2" onClick={onBack}>
            &larr; Back to Admin Home
          </button>
          <h2 className="view-title">Participant Submissions</h2>
          <p className="view-subtitle">Review submitted answers, grade written responses, and publish final results.</p>
        </div>
      </div>

      {/* Search & Sort Toolbar */}
      <div className="submissions-toolbar mb-4">
        <div className="search-box">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search by participant name, roll #, or activity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="sort-box">
          <span className="sort-lbl">Sort By:</span>
          <select
            className="form-input select-input"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="Submission Time">Submission Time</option>
            <option value="Name">Name</option>
            <option value="Roll Number">Roll Number</option>
            <option value="Score">Score</option>
            <option value="Status">Status</option>
          </select>
        </div>
      </div>

      {/* Submissions List */}
      {loading ? (
        <div className="loading-center">
          <div className="spinner"></div>
          <span>Loading submissions...</span>
        </div>
      ) : sortedSubmissions.length === 0 ? (
        <div className="empty-state-card">
          <h3 className="empty-title">No submissions found</h3>
          <p className="empty-desc">
            {searchQuery
              ? 'No participant submissions match your search query.'
              : 'No participant submissions have been received for your activities yet.'}
          </p>
        </div>
      ) : (
        <div className="submissions-grid">
          {sortedSubmissions.map((sub) => {
            const act = activitiesMap[sub.activityId] || {};
            const participantName = sub.participantDetails?.Name || sub.participantName || 'Participant';
            const rollNo = sub.participantDetails?.['Roll Number'] || sub.participantDetails?.['Registration Number'] || sub.participantDetails?.['Student ID'] || 'N/A';
            const status = sub.status || 'Pending';
            const isChecked = status === 'Checked';

            return (
              <div key={sub.submissionId} className="submission-card">
                <div className="sub-card-header">
                  <div>
                    <h3 className="sub-participant-name">{participantName}</h3>
                    <span className="sub-roll-no">ID / Roll #: {rollNo}</span>
                  </div>
                  <span className={`checking-status-badge ${isChecked ? 'checked' : 'pending'}`}>
                    {status}
                  </span>
                </div>

                <div className="sub-card-body mt-3">
                  <div className="sub-meta-item">
                    <span className="lbl">Activity:</span>
                    <span className="val">{sub.activityTitle || act.title || 'Activity'}</span>
                  </div>
                  <div className="sub-meta-item">
                    <span className="lbl">Submitted At:</span>
                    <span className="val">
                      {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div className="sub-meta-item">
                    <span className="lbl">Score:</span>
                    <span className="val score-val">
                      {sub.score !== undefined ? `${sub.score} / ${sub.totalMarks || 'N/A'}` : 'Not Graded'}
                      {sub.percentage !== undefined && ` (${sub.percentage}%)`}
                    </span>
                  </div>
                </div>

                <div className="sub-card-actions mt-4">
                  <button
                    type="button"
                    className={`btn ${isChecked ? 'btn-secondary' : 'btn-primary'} btn-sm w-full`}
                    onClick={() => setSelectedSubmission(sub)}
                  >
                    {isChecked ? 'Review / Update Grade' : 'Check Answers & Grade &rarr;'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submission Checker Modal */}
      {selectedSubmission && (
        <SubmissionChecker
          submission={selectedSubmission}
          activity={activitiesMap[selectedSubmission.activityId] || { title: selectedSubmission.activityTitle }}
          onClose={() => setSelectedSubmission(null)}
          onGraded={() => {
            setSelectedSubmission(null);
            loadSubmissionsData();
          }}
        />
      )}
    </div>
  );
}
