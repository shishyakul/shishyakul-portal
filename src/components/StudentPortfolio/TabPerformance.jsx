import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

export default function TabPerformance({ student }) {
  const [exams, setExams] = useState([]);
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
        
        <div style={{ marginTop: '24px', padding: '16px', background: 'var(--surface-bg)', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
          <h4 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#eab308' }}>emoji_events</span>
            Branch Manager Remarks
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            {student.bmRemarks || 'No special remarks or achievements logged yet.'}
          </p>
        </div>
      </div>
    </div>
  );
}
