import React from 'react';
import { db } from '../firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import './TicketDrawer.css';

export default function NotificationDrawer({ isOpen, onClose, notifications = [], onDismiss }) {
  const { profile } = useAuth();

  return (
    <>
      <div 
        className={`ticket-drawer-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />
      <div className={`ticket-drawer ${isOpen ? 'open' : ''}`} style={{ width: 450 }}>
        <div className="ticket-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--surface-border)' }}>
          <h2 style={{ margin: 0, fontSize: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>notifications</span>
            Notifications
            {notifications.length > 0 && (
              <span className="badge" style={{ background: '#ef4444', color: 'white', fontSize: 12 }}>{notifications.length} New</span>
            )}
          </h2>
          <button className="btn-icon" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="ticket-body" style={{ padding: 24, overflowY: 'auto', height: 'calc(100% - 73px)', background: 'var(--surface-bg)' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {notifications.length === 0 ? (
               <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                 <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.2, marginBottom: 12 }}>done_all</span>
                 <p style={{ margin: 0, fontSize: 15 }}>You're all caught up!</p>
               </div>
            ) : notifications.map(req => {
               
               if (req.notifType === 'leave') {
                 return (
                   <div key={req.id} style={{ padding: 16, border: '1px solid #fecaca', borderRadius: 12, background: '#fffcfc', boxShadow: '0 2px 8px rgba(239,68,68,0.05)', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                         <div>
                           <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: '#ef4444' }}>{req.teacherName}</p>
                           <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
                             Leave Request: {req.type === 'summer' ? 'Summer Vacation' : req.type === 'sick' ? 'Sick Leave' : req.type === 'festival' ? 'Festival' : 'Travel'}
                           </p>
                         </div>
                         <div style={{ textAlign: 'right' }}>
                           <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{req.totalDays} Days</p>
                         </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fee2e2', borderRadius: 8, marginBottom: 12 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#dc2626' }}>date_range</span>
                        <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{req.startDate} <span>to</span> {req.endDate}</span>
                      </div>

                      {req.reason && (
                        <div style={{ marginBottom: 16 }}>
                          <p style={{ margin: 0, fontSize: 13, color: '#b91c1c' }}>Reason:</p>
                          <p style={{ margin: '4px 0 0 0', fontSize: 14, color: '#991b1b', fontStyle: 'italic', lineHeight: 1.4 }}>"{req.reason}"</p>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <button 
                          onClick={async () => {
                            if(window.confirm('Reject this leave request?')) {
                              await updateDoc(doc(db, 'leave_requests', req.id), { status: 'rejected', actedBy: profile.role });
                            }
                          }}
                          className="btn-ghost" style={{ padding: '8px 0', color: '#ef4444', fontSize: 13, cursor: 'pointer', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', fontWeight: 600 }}>Reject</button>
                        <button 
                          onClick={async () => {
                            if(window.confirm('Approve this leave request?')) {
                              await updateDoc(doc(db, 'leave_requests', req.id), { status: 'approved', actedBy: profile.role });
                            }
                          }}
                          className="btn-primary" style={{ padding: '8px 0', background: '#22c55e', border: 'none', fontSize: 13, cursor: 'pointer', borderRadius: 8, color: 'white', fontWeight: 600, boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)' }}>Approve</button>
                      </div>
                   </div>
                 );
               }

               if (req.notifType === 'test') {
                 return (
                   <div key={req.id} style={{ padding: 16, border: '1px solid #e9d5ff', borderRadius: 12, background: '#faf5ff', position: 'relative' }}>
                      <button onClick={() => onDismiss(req.id)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#a855f7' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                      </button>
                      <h4 style={{ margin: '0 0 8px 0', color: '#9333ea', display: 'flex', alignItems: 'center', gap: 6 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>quiz</span> Student Test Upload</h4>
                      <p style={{ margin: 0, fontWeight: 600 }}>Batch: {req.batch}</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#9333ea' }}>Teacher: {req.teacherName}</p>
                      <p style={{ margin: '8px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Date: {req.date}</p>
                   </div>
                 );
               }

               if (req.notifType === 'material') {
                 return (
                   <div key={req.id} style={{ padding: 16, border: '1px solid #bfdbfe', borderRadius: 12, background: '#eff6ff', position: 'relative' }}>
                      <button onClick={() => onDismiss(req.id)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                      </button>
                      <h4 style={{ margin: '0 0 8px 0', color: '#2563eb', display: 'flex', alignItems: 'center', gap: 6 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>description</span> Study Material</h4>
                      <p style={{ margin: 0, fontWeight: 600 }}>{req.title}</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#2563eb' }}>For {req.batch} | By {req.teacherName}</p>
                   </div>
                 );
               }

               if (req.notifType === 'attendance') {
                 return (
                   <div key={req.id} style={{ padding: 16, border: '1px solid #bbf7d0', borderRadius: 12, background: '#f0fdf4', position: 'relative' }}>
                      <button onClick={() => onDismiss(req.id)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                      </button>
                      <h4 style={{ margin: '0 0 8px 0', color: '#16a34a', display: 'flex', alignItems: 'center', gap: 6 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>today</span> Daily Report</h4>
                      <p style={{ margin: 0, fontWeight: 600 }}>{req.teacherName}</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#16a34a' }}>Date: {req.date} | Hours: {req.totalHours}</p>
                      <p style={{ margin: '8px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Tasks: {req.completedTasks}</p>
                   </div>
                 );
               }

               if (req.notifType === 'lecture') {
                 return (
                   <div key={req.id} style={{ padding: 16, border: '1px solid #c7d2fe', borderRadius: 12, background: '#eef2ff', position: 'relative' }}>
                      <button onClick={() => onDismiss(req.id)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                      </button>
                      <h4 style={{ margin: '0 0 8px 0', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 6 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>assignment</span> Post Lecture Report</h4>
                      <p style={{ margin: 0, fontWeight: 600 }}>{req.topicName}</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#4f46e5' }}>Batch: {req.batch} | Teacher: {req.teacherName}</p>
                      <p style={{ margin: '8px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Duration: {req.durationHours} hr</p>
                   </div>
                 );
               }

               return null;
            })}
          </div>

        </div>
      </div>
    </>
  );
}
