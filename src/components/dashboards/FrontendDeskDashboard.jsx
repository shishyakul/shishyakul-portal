import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../NotificationBell';

export default function FrontendDeskDashboard({ profile }) {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [demos, setDemos] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0 });
  const [inventoryLog, setInventoryLog] = useState([]);

  useEffect(() => {
    // 1. Listen for completed demos needing follow-up
    const qDemos = query(
      collection(db, 'students'), 
      where('status', '==', 'demo'),
      where('demoCompletionStatus', '==', 'completed')
    );
    const unsubDemos = onSnapshot(qDemos, (snap) => {
      setDemos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 2. Listen for all enquiries (to calculate funnel)
    const qEnquiries = query(collection(db, 'students'), where('status', '==', 'enquiry'));
    const unsubEnquiries = onSnapshot(qEnquiries, (snap) => {
      setEnquiries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 3. Listen for today's attendance
    const todayStr = new Date().toISOString().split('T')[0];
    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snap) => {
      let pres = 0;
      let abs = 0;
      snap.forEach(doc => {
        const data = doc.data();
        if (data.date === todayStr) {
          abs += (data.absentCount || 0);
          pres += ((data.totalStudents || 0) - (data.absentCount || 0));
        }
      });
      setAttendanceStats({ present: pres, absent: abs });
    });

    // 4. Listen for Inventory checkouts
    const unsubInventory = onSnapshot(collection(db, 'asset_assignments'), (snap) => {
      const items = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      items.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setInventoryLog(items.slice(0, 5));
      setLoading(false);
    });

    return () => {
      unsubDemos();
      unsubEnquiries();
      unsubAttendance();
      unsubInventory();
    };
  }, []);

  const totalAttendance = attendanceStats.present + attendanceStats.absent;
  const attendancePercent = totalAttendance === 0 ? 0 : Math.round((attendanceStats.present / totalAttendance) * 100);

  // Funnel Stats
  const recentEnquiries = enquiries.filter(e => {
    if (!e.createdAt) return false;
    const date = e.createdAt.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
    return (new Date() - date) < 7 * 24 * 60 * 60 * 1000;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, {profile?.fullName?.split(' ')[0] ?? 'Shruti Maam'} 👋</h1>
          <p className="page-subtitle">Front Desk Reception Hub</p>
        </div>
        <div>
          <NotificationBell />
        </div>
      </div>

      {/* Quick Access Buttons */}
      <div className="grid-auto-200" style={{ gap: '16px', marginBottom: '24px' }}>
        <button className="portal-card" style={{ padding: '20px', cursor: 'pointer', textAlign: 'left', border: '1px solid var(--brand-primary)', background: 'linear-gradient(135deg, rgba(253,180,42,0.1), transparent)' }} onClick={() => navigate('/enquiries')}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--brand-primary)', marginBottom: '8px' }}>person_add</span>
          <h3 style={{ fontSize: 16 }}>New Enquiry</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Log a walk-in student</p>
        </button>
        <button className="portal-card" style={{ padding: '20px', cursor: 'pointer', textAlign: 'left', border: '1px solid #10b981', background: 'linear-gradient(135deg, rgba(16,185,129,0.1), transparent)' }} onClick={() => navigate('/pending-admissions')}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#10b981', marginBottom: '8px' }}>how_to_reg</span>
          <h3 style={{ fontSize: 16 }}>Process Admissions</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Convert demos to admitted</p>
        </button>
        <button className="portal-card" style={{ padding: '20px', cursor: 'pointer', textAlign: 'left', border: '1px solid #6366f1', background: 'linear-gradient(135deg, rgba(99,102,241,0.1), transparent)' }} onClick={() => navigate('/attendance')}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#6366f1', marginBottom: '8px' }}>fact_check</span>
          <h3 style={{ fontSize: 16 }}>Daily Attendance</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Mark student presence</p>
        </button>
        <button className="portal-card" style={{ padding: '20px', cursor: 'pointer', textAlign: 'left', border: '1px solid #ef4444', background: 'linear-gradient(135deg, rgba(239,68,68,0.1), transparent)' }} onClick={() => navigate('/inventory')}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#ef4444', marginBottom: '8px' }}>inventory_2</span>
          <h3 style={{ fontSize: 16 }}>Asset Ledger</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Manage library & gear</p>
        </button>
      </div>

      <div className="grid-2-1" style={{ gap: '24px', marginBottom: '24px' }}>
        
        {/* Left Column: Alerts & Attendance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Action Alerts */}
          <div className="portal-card" style={{ borderLeft: '4px solid var(--status-error)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--status-error)', fontSize: '28px' }}>warning</span>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--status-error)', margin: 0 }}>Action Required</h2>
            </div>
            
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1, background: 'var(--surface-bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                <h3 style={{ fontSize: 24, margin: 0, color: 'var(--status-error)' }}>{demos.length}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Completed Demos Needing Follow-up</p>
              </div>
              <div style={{ flex: 1, background: 'var(--surface-bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                <h3 style={{ fontSize: 24, margin: 0, color: 'var(--brand-primary)' }}>{enquiries.length}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Pending Enquiries in Pipeline</p>
              </div>
            </div>
            
            {demos.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: 14, marginBottom: 8 }}>Students to call today:</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {demos.map(d => (
                    <span key={d.id} className="badge badge-error">{d.studentName} ({d.contactNo})</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Daily Attendance Tracker */}
          <div className="portal-card">
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>👥 Today's Attendance Snapshot</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: `conic-gradient(#10b981 ${attendancePercent}%, var(--surface-bg) ${attendancePercent}%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                  <span style={{ fontSize: 24, fontWeight: 'bold' }}>{attendancePercent}%</span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Present</span>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--surface-bg)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Present</span>
                  <span style={{ fontWeight: 'bold', color: '#10b981' }}>{attendanceStats.present}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--surface-bg)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Absent</span>
                  <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{attendanceStats.absent}</span>
                </div>
              </div>
            </div>
            {totalAttendance === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, fontStyle: 'italic' }}>* Attendance has not been marked for today yet.</p>}
          </div>

        </div>

        {/* Right Column: Funnel & Asset Ledger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Enquiry Funnel */}
          <div className="portal-card" style={{ background: 'linear-gradient(180deg, var(--bg-main) 0%, var(--surface-bg) 100%)' }}>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>📈 Walk-in Funnel (Last 7 Days)</h2>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--brand-primary)', lineHeight: 1 }}>{recentEnquiries.length}</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>New Enquiries Generated</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid var(--surface-border)', paddingTop: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Total Pipeline Size:</span>
              <span style={{ fontWeight: 'bold' }}>{enquiries.length}</span>
            </div>
          </div>

          {/* Asset Ledger Log */}
          <div className="portal-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: 'var(--surface-bg)', borderBottom: '1px solid var(--surface-border)' }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>🗃️ Recently Checked Out</h2>
            </div>
            <div style={{ padding: 20 }}>
              {inventoryLog.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}>No assets currently assigned.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {inventoryLog.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--surface-border)', paddingBottom: '12px' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)' }}>
                        {item.type === 'book' ? 'menu_book' : 'devices'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{item.itemName}</div>
                        <div style={{ fontSize: 12, color: 'var(--brand-primary)' }}>To: {item.recipientName || 'Unknown'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
