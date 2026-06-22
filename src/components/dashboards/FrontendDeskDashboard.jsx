import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';

export default function FrontendDeskDashboard({ profile }) {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query for demo students who have completed their 3-day demo but aren't converted yet
    const q = query(
      collection(db, 'students'), 
      where('status', '==', 'demo'),
      where('demoCompletionStatus', '==', 'completed')
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      setFollowups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, {profile?.fullName?.split(' ')[0] ?? 'Manager'} 👋</h1>
          <p className="page-subtitle">Frontend Desk Dashboard</p>
        </div>
      </div>
      
      {loading ? (
        <p>Loading alerts...</p>
      ) : followups.length > 0 ? (
        <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '24px', borderRadius: '12px', border: '1px solid var(--status-error)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--status-error)', fontSize: '28px' }}>warning</span>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--status-error)', margin: 0 }}>Action Required: {followups.length} Demos Completed</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>The following students have completed their scheduled demo lectures. You must call them to confirm admission or drop them.</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {followups.map(student => (
              <div key={student.id} style={{ background: 'var(--surface-bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>{student.studentName}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{student.standard} - {student.board}</div>
                <div style={{ fontSize: '14px' }}>
                  <strong>Parent:</strong> {student.parentName || 'N/A'}<br/>
                  <strong>Phone:</strong> {student.parentContact || student.contactNo}
                </div>
                <a href="/demo-dashboard" className="btn btn-ghost btn-sm" style={{ marginTop: '12px', width: '100%', justifyContent: 'center' }}>Go to Demo Dashboard</a>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="portal-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--status-success)' }}>
            <span className="material-symbols-outlined">check_circle</span>
            <h3 style={{ margin: 0 }}>All clear!</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            There are no pending demo conversions right now.
          </p>
        </div>
      )}
    </div>
  );
}
