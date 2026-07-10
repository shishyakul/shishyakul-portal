import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

export default function TabPerformance({ student, allFeedbacks = [] }) {
  const [exams, setExams] = useState([]);
  const [selfStudyLogs, setSelfStudyLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPerformance() {
      if (!student.batch) {
        setLoading(false);
        return;
      }
      try {
        const q = query(collection(db, 'test_marks'), where('batch', '==', student.batch));
        const snap = await getDocs(q);
        const fetchedExams = [];
        
        snap.forEach(doc => {
          const data = doc.data();
          const studentResult = data.results?.find(r => r.studentId === student.id);
          
          if (studentResult) {
            fetchedExams.push({
              id: doc.id,
              date: data.testDate,
              subject: `${data.subject} (${data.topic})`,
              maxMarks: data.maxMarks,
              marksObtained: studentResult.marks,
              percentage: studentResult.percentage,
              batchRank: studentResult.batchRank,
              remarks: studentResult.percentage >= 80 ? 'Excellent performance!' : studentResult.percentage >= 50 ? 'Good, but needs improvement.' : 'Requires urgent attention.'
            });
          }
        });
        
        // Sort by date descending
        fetchedExams.sort((a, b) => new Date(b.date.split('/').reverse().join('-')) - new Date(a.date.split('/').reverse().join('-')));
        setExams(fetchedExams);

        // Fetch Self-Study Logs from Attendance
        const qAtt = query(collection(db, 'attendance'), where('batch', '==', student.batch), where('sessionType', '==', 'Self-Study'));
        const attSnap = await getDocs(qAtt);
        const fetchedSelfStudy = [];
        attSnap.forEach(doc => {
          const data = doc.data();
          if (data.selfStudyLogs && data.selfStudyLogs[student.id]) {
            fetchedSelfStudy.push({
              id: doc.id,
              date: data.date,
              inOutTime: data.inOutTimes ? data.inOutTimes[student.id] : null,
              log: data.selfStudyLogs[student.id]
            });
          }
        });
        fetchedSelfStudy.sort((a, b) => new Date(b.date) - new Date(a.date));
        setSelfStudyLogs(fetchedSelfStudy);

      } catch (err) {
        console.error('Error fetching performance:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPerformance();
  }, [student.id, student.batch]);

  return (
    <div className="sd-profile-body">
      <div className="sd-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="sd-section-title" style={{ margin: 0 }}>
            <span className="material-symbols-outlined">psychology</span>
            Performance & Achievements
          </h3>
          <button className="btn-ghost btn-sm" disabled style={{ opacity: 0.5 }}>
            + Add Score
          </button>
        </div>

        {loading ? (
          <div className="spinner" style={{ margin: '20px auto' }} />
        ) : exams.length === 0 ? (
          <div className="empty-state">No test records found for this student.</div>
        ) : (
          <table className="sd-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Subject / Test</th>
                <th>Score</th>
                <th>Rank</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {exams.map(exam => (
                <tr key={exam.id}>
                  <td>{exam.date}</td>
                  <td style={{ fontWeight: 500 }}>{exam.subject}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: exam.percentage >= 80 ? 'var(--status-success)' : exam.percentage < 50 ? 'var(--status-danger)' : 'inherit' }}>
                      {exam.marksObtained}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}> / {exam.maxMarks}</span>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{exam.percentage}%</div>
                  </td>
                  <td>
                    <span style={{ 
                      background: exam.batchRank === 1 ? '#fff8e1' : exam.batchRank <= 3 ? '#f3e5f5' : 'transparent',
                      color: exam.batchRank === 1 ? '#f57f17' : exam.batchRank <= 3 ? '#7b1fa2' : 'inherit',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontWeight: exam.batchRank <= 3 ? 'bold' : 'normal',
                      border: exam.batchRank <= 3 ? '1px solid currentColor' : 'none'
                    }}>
                      #{exam.batchRank}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{exam.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        
        {/* Feedbacks Section */}
        <div className="sd-section" style={{ marginTop: '24px', background: 'var(--surface-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: '#1976d2' }}>feedback</span>
            Weekly Performance Reviews
          </h3>
          {allFeedbacks.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 14 }}>No feedbacks received yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {[...allFeedbacks].reverse().map((fb, idx) => {
                const isRecent = (Date.now() - new Date(fb.date).getTime()) < 7 * 24 * 60 * 60 * 1000;
                return (
                  <div key={idx} style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid var(--surface-border)', position: 'relative', overflow: 'hidden' }}>
                    {isRecent && <div style={{ position: 'absolute', top: 0, right: 0, background: '#4caf50', color: 'white', fontSize: 10, padding: '2px 8px', borderBottomLeftRadius: 8, fontWeight: 'bold' }}>NEW</div>}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <strong style={{ display: 'block', fontSize: 15 }}>{fb.teacherName}</strong>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(fb.date).toLocaleDateString()}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {[1,2,3,4,5].map(star => (
                          <span key={star} className="material-symbols-outlined" style={{ fontSize: 18, color: star <= fb.rating ? '#fbc02d' : '#e0e0e0' }}>star</span>
                        ))}
                      </div>
                    </div>
                    
                    <p style={{ margin: '0 0 12px 0', fontSize: 14, lineHeight: 1.5 }}>"{fb.review}"</p>
                    
                    {fb.focusArea && (
                      <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 8, fontSize: 13 }}>
                        <strong style={{ color: '#e65100', display: 'block', marginBottom: 4 }}>Areas of Focus:</strong>
                        <span style={{ color: 'var(--text-secondary)' }}>{fb.focusArea}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Manager Remarks */}
        <div className="sd-section" style={{ marginTop: '24px', background: 'var(--surface-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: '#f57c00' }}>emoji_events</span>
            Branch Manager Remarks
          </h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>{student.bmRemarks || 'No special remarks or achievements logged yet.'}</p>
        </div>
        
        {/* Self Study Section */}
        <div className="sd-section" style={{ marginTop: '24px', background: 'var(--surface-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>menu_book</span>
            Self-Study Logs
          </h3>
          {selfStudyLogs.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 14 }}>No self-study activity logged yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {selfStudyLogs.map(att => (
                <div key={att.id} style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid var(--surface-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid var(--surface-border)', paddingBottom: 8 }}>
                    <strong style={{ fontSize: 14 }}>{new Date(att.date).toLocaleDateString()}</strong>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
                      <span>In: {att.inOutTime?.in || '--'}</span>
                      <span>Out: {att.inOutTime?.out || '--'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--brand-primary)', marginTop: 2 }}>subject</span>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Subject</div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{att.log.subject || 'Not specified'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f97316', marginTop: 2 }}>import_contacts</span>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Topic / Syllabus</div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{att.log.topic || 'No details provided'}</div>
                      </div>
                    </div>
                  </div>
                  {att.log.teacherScore !== undefined && (
                    <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px dashed var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f57c00' }}>star</span>
                        Teacher Review
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-primary)' }}>
                        {att.log.teacherScore} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>/ 10</span>
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
