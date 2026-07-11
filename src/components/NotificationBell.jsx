import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToNotifications, markNotificationRead } from '../services/notifications';
import NotificationDrawer from './NotificationDrawer';

export default function NotificationBell({ dynamicNotifications = [] }) {
  const { profile, user } = useAuth();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [dbNotifications, setDbNotifications] = useState([]);

  useEffect(() => {
    if (!user?.uid || !profile?.role) return;
    const unsub = subscribeToNotifications(user.uid, profile.role, setDbNotifications);
    return () => unsub();
  }, [user, profile]);

  const allNotifications = React.useMemo(() => {
    return [...dbNotifications, ...dynamicNotifications];
  }, [dbNotifications, dynamicNotifications]);

  const handleDismissNotification = async (id) => {
    if (id.startsWith('local-')) {
      alert("Please complete the required action to dismiss this reminder.");
    } else {
      await markNotificationRead(id);
    }
  };

  return (
    <>
      <button 
        className="btn btn-ghost"
        onClick={() => setIsNotifOpen(true)}
        style={{ position: 'relative', width: 42, height: 42, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid var(--surface-border)', background: 'white', color: '#f59e0b', transition: 'transform 0.2s' }}
        title="Notifications"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>notifications</span>
        {allNotifications.length > 0 && (
          <span style={{
            position: 'absolute', top: 8, right: 10, width: 8, height: 8, 
            backgroundColor: '#ef4444', borderRadius: '50%', boxShadow: '0 0 0 2px #fff'
          }} />
        )}
      </button>

      <NotificationDrawer 
        isOpen={isNotifOpen} 
        onClose={() => setIsNotifOpen(false)} 
        notifications={allNotifications}
        onDismiss={handleDismissNotification}
      />
    </>
  );
}
