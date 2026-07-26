import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

export default function TabPerformance({ student, allFeedbacks = [] }) {
  const [exams, setExams] = useState([]);
  const [schoolExams, setSchoolExams] = useState([]);
  const [selfStudyLogs, setSelfStudyLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editSchoolModal, setEditSchoolModal] = useState({ isOpen: false, selectedExamId: '', marksData: {} });
  const [savingMarks, setSavingMarks] = useState(false);
  const { profile } = useAuth();
  const isServiceManager = profile?.role === 'service_manager';
  const classTeacherBatches = profile?.classTeacherBatch ? (Array.isArray(profile.classTeacherBatch) ? profile.classTeacherBatch : [profile.classTeacherBatch]) : [];
  const isClassTeacher = profile?.role === 'teacher' && classTeacherBatches.includes(student.batch);
  const canEditMarks = isServiceManager || isClassTeacher;

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

        // Fetch School Exams
        const qSchool = query(collection(db, 'school_test_marks'), where('studentId', '==', student.id));
        const snapSchool = await getDocs(qSchool);
        const fetchedSchoolExams = [];
        snapSchool.forEach(doc => {
          fetchedSchoolExams.push({ id: doc.id, ...doc.data() });
        });
        fetchedSchoolExams.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setSchoolExams(fetchedSchoolExams);

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

        {/* Official School Exam Records */}
        <div className="sd-section" style={{ marginTop: '24px', background: 'var(--surface-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: '#8b5cf6' }}>history_edu</span>
            Official School Exam Records
          </h3>
          {schoolExams.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 14 }}>No school exam records found.</p>
          ) : (
            <div className="table-responsive">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Exam Type</th>
                    <th>Subjects & Marks</th>
                    <th>Overall %</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolExams.map(exam => {
                    const subjects = Object.keys(exam.marks || {});
                    let validSubjectsCount = 0;
                    let totalMarksObtained = 0;
                    let totalMaxMarks = 0;
                    
                    subjects.forEach(sub => {
                      const mkData = exam.marks[sub];
                      let obtained, max;
                      if (typeof mkData === 'object' && mkData !== null) {
                        obtained = mkData.obtained;
                        max = mkData.max;
                      } else {
                        obtained = mkData;
                        max = exam.maxMarks || 0;
                      }
                      
                      if (obtained !== null && obtained !== undefined && obtained !== '') {
                        validSubjectsCount++;
                        totalMarksObtained += Number(obtained);
                        totalMaxMarks += Number(max);
                      }
                    });
                    
                    const overallPercentage = totalMaxMarks > 0 ? ((totalMarksObtained / totalMaxMarks) * 100).toFixed(1) : 0;
                    
                    return (
                      <tr key={exam.id}>
                        <td>{new Date(exam.createdAt).toLocaleDateString()}</td>
                        <td style={{ fontWeight: '600', color: '#8b5cf6' }}>{exam.testType}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {subjects.map(sub => {
                              const mkData = exam.marks[sub];
                              let obtained, max;
                              if (typeof mkData === 'object' && mkData !== null) {
                                obtained = mkData.obtained;
                                max = mkData.max;
                              } else {
                                obtained = mkData;
                                max = exam.maxMarks || 0;
                              }
                              
                              const isValid = obtained !== null && obtained !== undefined && obtained !== '';
                              const pct = isValid && max > 0 ? (obtained / max) * 100 : 0;
                              return (
                                <span key={sub} style={{ fontSize: 12, background: '#f8fafc', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                  {sub}: {isValid ? <strong style={{ color: pct >= 80 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444' }}>{obtained}</strong> : <strong style={{ color: '#94a3b8' }}>NA</strong>}/{max}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontWeight: 'bold', color: overallPercentage >= 80 ? '#10b981' : overallPercentage >= 40 ? '#f59e0b' : '#ef4444' }}>
                              {overallPercentage}%
                            </span>
                            {canEditMarks && (
                              <button 
                                className="btn-ghost btn-sm" 
                                onClick={() => {
                                  const initialMarks = {};
                                  Object.keys(exam.marks || {}).forEach(sub => {
                                    const mkData = exam.marks[sub];
                                    if (typeof mkData === 'object' && mkData !== null) {
                                      initialMarks[`${sub}_obtained`] = mkData.obtained !== null ? mkData.obtained : '';
                                      initialMarks[`${sub}_max`] = mkData.max !== null ? mkData.max : '';
                                    } else {
                                      initialMarks[`${sub}_obtained`] = mkData !== null ? mkData : '';
                                      initialMarks[`${sub}_max`] = exam.maxMarks || '';
                                    }
                                  });
                                  setEditSchoolModal({ isOpen: true, selectedExamId: exam.id, marksData: initialMarks });
                                }}
                                style={{ padding: '4px', display: 'flex', alignItems: 'center' }}
                                title="Edit Marks"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
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
      
      {/* Edit School Exam Modal */}
      {editSchoolModal.isOpen && (
        <div className="modal-overlay" onClick={() => setEditSchoolModal({ isOpen: false, selectedExamId: '', marksData: {} })}>
          <div className="modal-box" style={{ maxWidth: '500px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 className="modal-title">Edit School Exam Marks</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditSchoolModal({ isOpen: false, selectedExamId: '', marksData: {} })}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label className="form-label" style={{ margin: 0 }}>Select Exam to Edit</label>
                <select 
                  className="input-field"
                  value={editSchoolModal.selectedExamId}
                  onChange={(e) => {
                    const exId = e.target.value;
                    if (!exId) {
                      setEditSchoolModal(prev => ({ ...prev, selectedExamId: '', marksData: {} }));
                      return;
                    }
                    const exam = schoolExams.find(x => x.id === exId);
                    const initialMarks = {};
                    if (exam) {
                      Object.keys(exam.marks || {}).forEach(sub => {
                        const mkData = exam.marks[sub];
                        if (typeof mkData === 'object' && mkData !== null) {
                          initialMarks[`${sub}_obtained`] = mkData.obtained !== null ? mkData.obtained : '';
                          initialMarks[`${sub}_max`] = mkData.max !== null ? mkData.max : '';
                        } else {
                          initialMarks[`${sub}_obtained`] = mkData !== null ? mkData : '';
                          initialMarks[`${sub}_max`] = exam.maxMarks || '';
                        }
                      });
                    }
                    setEditSchoolModal(prev => ({ ...prev, selectedExamId: exId, marksData: initialMarks }));
                  }}
                >
                  <option value="">-- Select Exam --</option>
                  {schoolExams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.testType} ({new Date(ex.createdAt).toLocaleDateString()})</option>
                  ))}
                </select>
              </div>

              {editSchoolModal.selectedExamId && (
                <div style={{ background: 'var(--surface-bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Update Subjects (Leave blank for NA)</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(() => {
                      const activeExam = schoolExams.find(x => x.id === editSchoolModal.selectedExamId);
                      if (!activeExam) return null;
                      const subjects = Object.keys(activeExam.marks || {});
                      return subjects.map(sub => {
                        return (
                          <div key={sub} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 500, fontSize: '14px' }}>{sub}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input 
                                type="number" 
                                className="input-field" 
                                style={{ width: '60px', padding: '6px 8px', textAlign: 'center' }}
                                placeholder="Marks"
                                value={editSchoolModal.marksData[`${sub}_obtained`] !== undefined ? editSchoolModal.marksData[`${sub}_obtained`] : ''}
                                onChange={(e) => setEditSchoolModal(prev => ({
                                  ...prev,
                                  marksData: { ...prev.marksData, [`${sub}_obtained`]: e.target.value }
                                }))}
                              />
                              <span style={{ color: 'var(--text-secondary)' }}>/</span>
                              <input 
                                type="number" 
                                className="input-field" 
                                style={{ width: '60px', padding: '6px 8px', textAlign: 'center', background: 'var(--surface-bg)' }}
                                placeholder="Max"
                                value={editSchoolModal.marksData[`${sub}_max`] !== undefined ? editSchoolModal.marksData[`${sub}_max`] : ''}
                                onChange={(e) => setEditSchoolModal(prev => ({
                                  ...prev,
                                  marksData: { ...prev.marksData, [`${sub}_max`]: e.target.value }
                                }))}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button className="btn btn-ghost" onClick={() => setEditSchoolModal({ isOpen: false, selectedExamId: '', marksData: {} })}>Cancel</button>
              <button 
                className="btn btn-brand"
                disabled={!editSchoolModal.selectedExamId || savingMarks}
                onClick={async () => {
                  setSavingMarks(true);
                  try {
                    const activeExam = schoolExams.find(x => x.id === editSchoolModal.selectedExamId);
                    const subjects = Object.keys(activeExam.marks || {});
                    const finalMarks = {};
                    subjects.forEach(sub => {
                      const obtainedVal = editSchoolModal.marksData[`${sub}_obtained`];
                      const maxVal = editSchoolModal.marksData[`${sub}_max`];
                      if (obtainedVal !== '' && obtainedVal !== undefined && maxVal !== '' && maxVal !== undefined) {
                        finalMarks[sub] = {
                          obtained: Number(obtainedVal),
                          max: Number(maxVal)
                        };
                      } else {
                        finalMarks[sub] = null;
                      }
                    });
                    
                    await updateDoc(doc(db, 'school_test_marks', editSchoolModal.selectedExamId), {
                      marks: finalMarks
                    });
                    
                    // Update local state to reflect instantly
                    setSchoolExams(prev => prev.map(ex => {
                      if (ex.id === editSchoolModal.selectedExamId) {
                        return { ...ex, marks: finalMarks };
                      }
                      return ex;
                    }));
                    
                    setEditSchoolModal({ isOpen: false, selectedExamId: '', marksData: {} });
                  } catch (e) {
                    console.error("Error updating marks", e);
                    alert("Failed to update marks");
                  }
                  setSavingMarks(false);
                }}
              >
                {savingMarks ? 'Saving...' : 'Save Marks'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
