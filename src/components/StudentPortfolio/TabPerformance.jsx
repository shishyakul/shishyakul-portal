import React from 'react';

export default function TabPerformance({ student }) {
  // Placeholder for future Exam & Test tracking system
  const exams = student.exams || [
    { id: 1, date: '2026-05-15', subject: 'Mathematics (Algebra)', maxMarks: 50, marksObtained: 42, remarks: 'Good grasp of polynomials.' },
    { id: 2, date: '2026-06-01', subject: 'Science (Physics)', maxMarks: 50, marksObtained: 38, remarks: 'Needs work on light reflection concepts.' },
  ];

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

        <table className="sd-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Subject / Test</th>
              <th>Score</th>
              <th>Teacher Remarks</th>
            </tr>
          </thead>
          <tbody>
            {exams.map(exam => (
              <tr key={exam.id}>
                <td>{exam.date}</td>
                <td style={{ fontWeight: 500 }}>{exam.subject}</td>
                <td>
                  <span style={{ fontWeight: 600, color: exam.marksObtained / exam.maxMarks >= 0.8 ? 'var(--status-success)' : 'inherit' }}>
                    {exam.marksObtained}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}> / {exam.maxMarks}</span>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{exam.remarks}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
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
