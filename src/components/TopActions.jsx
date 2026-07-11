import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import TicketDrawer from './TicketDrawer';
import NotificationDrawer from './NotificationDrawer';

export default function TopActions({ onMenuClick }) {
  const { profile } = useAuth();
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [dismissedNotifs, setDismissedNotifs] = useState(() => {
    return JSON.parse(localStorage.getItem(`dismissed_notifs_${profile?.id}`) || '[]');
  });

  useEffect(() => {
    if (profile?.id) {
      localStorage.setItem(`dismissed_notifs_${profile.id}`, JSON.stringify(dismissedNotifs));
    }
  }, [dismissedNotifs, profile?.id]);

  useEffect(() => {
    if (profile?.role !== 'branch_manager' && profile?.role !== 'service_manager') return;
    
    const unsubs = [];
    
    // 1. Leave Requests (Only pending)
    unsubs.push(onSnapshot(collection(db, 'leave_requests'), (snap) => {
      setNotifications(prev => {
        const others = prev.filter(n => n.notifType !== 'leave');
        const leaves = snap.docs.map(doc => ({ id: doc.id, notifType: 'leave', ...doc.data() })).filter(r => r.status === 'pending');
        return [...others, ...leaves];
      });
    }));

    // 2. Student Tests
    unsubs.push(onSnapshot(query(collection(db, 'test_marks'), limit(15)), (snap) => {
      setNotifications(prev => {
        const others = prev.filter(n => n.notifType !== 'test');
        const tests = snap.docs.map(doc => ({ id: doc.id, notifType: 'test', ...doc.data() }));
        return [...others, ...tests];
      });
    }));

    // 3. Course Materials
    unsubs.push(onSnapshot(query(collection(db, 'course_materials'), limit(15)), (snap) => {
      setNotifications(prev => {
        const others = prev.filter(n => n.notifType !== 'material');
        const materials = snap.docs.map(doc => ({ id: doc.id, notifType: 'material', ...doc.data() }));
        return [...others, ...materials];
      });
    }));

    // 4. Daily Attendance / Reports
    unsubs.push(onSnapshot(query(collection(db, 'teacher_attendance'), limit(15)), (snap) => {
      setNotifications(prev => {
        const others = prev.filter(n => n.notifType !== 'attendance');
        const atts = snap.docs.map(doc => ({ id: doc.id, notifType: 'attendance', ...doc.data() }));
        return [...others, ...atts];
      });
    }));

    // 5. Post Lecture Reports
    unsubs.push(onSnapshot(query(collection(db, 'lecture_reports'), limit(15)), (snap) => {
      setNotifications(prev => {
        const others = prev.filter(n => n.notifType !== 'lecture');
        const lectures = snap.docs.map(doc => ({ id: doc.id, notifType: 'lecture', ...doc.data() }));
        return [...others, ...lectures];
      });
    }));

    return () => unsubs.forEach(u => u());
  }, [profile?.role]);

  // Hide Notifications/Tickets on desktop for teachers and students. 
  // Hamburger will handle mobile visibility.
  const isStudentOrTeacher = profile?.role === 'student' || profile?.role === 'teacher';

  const activeNotifications = notifications
    .filter(n => !dismissedNotifs.includes(n.id))
    .sort((a, b) => {
      const getVal = (item) => item.timestamp?.seconds || (new Date(item.date || item.createdAt || item.uploadedAt || 0).getTime() / 1000) || 0;
      return getVal(b) - getVal(a);
    });

  const pendingCount = activeNotifications.length;

  return (
    <>
      <div className="top-actions-container">
        {/* Hamburger Menu (Mobile Only) */}
        <button 
          className="btn-icon mobile-only" 
          onClick={onMenuClick}
          style={{ background: 'var(--surface-bg)', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        {/* Right Actions Container */}
        <div style={{ display: 'flex', gap: 16, marginLeft: 'auto' }}>
          {(!isStudentOrTeacher || profile?.role === 'branch_manager' || profile?.role === 'service_manager') && (
            <button 
              onClick={() => setIsNotifOpen(true)}
              className="btn-icon"
              title="Notifications"
              style={{
                background: 'var(--surface-bg)',
                border: '1px solid var(--surface-border)',
                borderRadius: '50%',
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              <span className="material-symbols-outlined" style={{ color: 'var(--text-secondary)' }}>notifications</span>
              {pendingCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  background: 'var(--status-danger)',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 'bold',
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%'
                }}>
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </button>
          )}

          {(!isStudentOrTeacher || profile?.role === 'branch_manager' || profile?.role === 'service_manager') && (
            <button 
              onClick={() => setIsTicketOpen(!isTicketOpen)}
              className="btn-icon"
              title="Create Support Ticket"
              style={{
                background: 'var(--surface-bg)',
                border: '1px solid var(--surface-border)',
                borderRadius: '50%',
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span className="material-symbols-outlined" style={{ color: 'var(--text-secondary)' }}>support_agent</span>
            </button>
          )}
        </div>
      </div>

      <TicketDrawer isOpen={isTicketOpen} onClose={() => setIsTicketOpen(false)} />
      {(profile?.role === 'branch_manager' || profile?.role === 'service_manager') && (
        <NotificationDrawer 
          isOpen={isNotifOpen} 
          onClose={() => setIsNotifOpen(false)} 
          notifications={activeNotifications} 
          onDismiss={(id) => setDismissedNotifs(prev => [...prev, id])}
        />
      )}
    </>
  );
}
