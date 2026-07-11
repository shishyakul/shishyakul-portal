import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToInbox, subscribeToSent, createTickets, updateTicketStatus, updateTicketProgress, addTicketRemark } from '../services/tickets';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import './TicketDrawer.css';

const PORTAL_ROLES = [
  { id: 'inventory_manager', label: 'Inventory Manager' },
  { id: 'front_desk_manager', label: 'Front Desk Manager' },
  { id: 'admin', label: 'Admin Manager' },
  { id: 'service_manager', label: 'Service Manager' },
  { id: 'branch_manager', label: 'Branch Manager' },
  { id: 'teacher', label: 'Teacher' }
];

const formatStatus = (status) => {
  if (status === 'completed') return 'Completed';
  if (status === 'in_process') return 'In Process';
  if (status === 'seen') return 'Seen';
  return 'Pending';
};

const getStatusColor = (status) => {
  if (status === 'completed') return '#388e3c'; // Green
  if (status === 'in_process') return '#fbc02d'; // Yellow
  if (status === 'seen') return '#1976d2'; // Blue
  return '#d32f2f'; // Red (Pending)
};

const formatDate = (timestamp) => {
  if (!timestamp) return 'Just now';
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleDateString();
  }
  return 'Just now';
};

const TicketItem = ({ ticket, isInbox, getRoleLabel, user, profile }) => {
  const [expanded, setExpanded] = useState(false);
  const [remarkText, setRemarkText] = useState('');
  
  const handleProgressChange = async (newStatus, newProgress) => {
    await updateTicketProgress(ticket.id, newStatus, newProgress);
  };
  
  const handleAddRemark = async (e) => {
    e.preventDefault();
    if (!remarkText.trim()) return;
    
    // Determine the target user/role for the notification
    const targetUserId = user.uid === ticket.senderUid ? ticket.targetRole : ticket.senderUid;
    
    await addTicketRemark(ticket.id, user.uid, profile.fullName || profile.displayName || 'User', remarkText, targetUserId);
    setRemarkText('');
  };

  return (
    <div className={`ticket-item status-${ticket.status}`}>
      <div className="ticket-item-header" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <div className="ticket-sender" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="material-symbols-outlined" style={{ color: isInbox ? 'var(--brand-primary)' : 'var(--text-muted)' }}>
            {isInbox ? 'person' : 'forward_to_inbox'}
          </span>
          <div>
            {isInbox ? (
              <>
                <strong style={{ display: 'block', fontSize: 14 }}>{ticket.senderName}</strong>
                <small className="ticket-item-dept">{getRoleLabel(ticket.senderRole)}</small>
              </>
            ) : (
              <strong style={{ fontSize: 14 }}>To: {getRoleLabel(ticket.targetRole)}</strong>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="ticket-item-date">{formatDate(ticket.createdAt)}</span>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-muted)' }}>
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </div>
      <div className="ticket-item-title" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>{ticket.subject}</div>
      <div className="ticket-item-message">{ticket.message}</div>
      
      <div className="ticket-item-footer">
        <span className={`status-badge ${ticket.status}`}>
          {formatStatus(ticket.status)} {ticket.status === 'in_process' && `(${ticket.progress || 0}%)`}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
          {isInbox && (
            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>UPDATE STATUS</label>
              <select 
                style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid var(--border-color)', fontSize: 13 }}
                value={ticket.status}
                onChange={(e) => handleProgressChange(e.target.value, ticket.progress || 0)}
              >
                <option value="pending">Pending</option>
                <option value="seen">Seen</option>
                <option value="in_process">In Process</option>
                <option value="completed">Completed</option>
              </select>
              
              {ticket.status === 'in_process' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  <input 
                    type="range" 
                    min="0" max="100" step="5"
                    value={ticket.progress || 0}
                    onChange={(e) => handleProgressChange(ticket.status, parseInt(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{ticket.progress || 0}%</span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>REMARKS THREAD</label>
            <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ticket.remarks && ticket.remarks.length > 0 ? (
                ticket.remarks.map((rmk, idx) => (
                  <div key={idx} style={{ background: rmk.senderUid === user.uid ? 'rgba(253,180,42,0.1)' : 'var(--bg-color)', padding: 10, borderRadius: 8, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ color: rmk.senderUid === user.uid ? 'var(--brand-primary)' : 'var(--text-main)' }}>{rmk.senderName}</strong>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(rmk.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div>{rmk.message}</div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No remarks yet.</div>
              )}
            </div>
            <form onSubmit={handleAddRemark} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input 
                type="text" 
                value={remarkText}
                onChange={e => setRemarkText(e.target.value)}
                placeholder="Type a reply..."
                style={{ flex: 1, padding: '8px 12px', borderRadius: 20, border: '1px solid var(--border-color)', fontSize: 13 }}
              />
              <button type="submit" disabled={!remarkText.trim()} style={{ background: 'var(--brand-primary)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default function TicketDrawer({ isOpen, onClose }) {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox', 'sent', 'compose'
  
  const [inboxTickets, setInboxTickets] = useState([]);
  const [sentTickets, setSentTickets] = useState([]);
  
  // Compose form state
  const [targetRoles, setTargetRoles] = useState([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [teacherList, setTeacherList] = useState([]);

  useEffect(() => {
    if (!profile?.role || !user?.uid) return;
    
    const unsubInbox = subscribeToInbox(profile.role, user.uid, setInboxTickets);
    const unsubSent = subscribeToSent(user.uid, setSentTickets);
    
    // If user is NOT a teacher, fetch actual teachers for targeting
    if (profile.role !== 'teacher') {
      const fetchTeachers = async () => {
        try {
          const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
          const snap = await getDocs(q);
          const teachers = snap.docs.map(doc => ({ id: doc.id, label: doc.data().fullName || doc.data().displayName || 'Unknown Teacher' }));
          setTeacherList(teachers);
        } catch (err) {
          console.error("Failed to fetch teachers", err);
        }
      };
      fetchTeachers();
    }
    
    return () => {
      unsubInbox();
      unsubSent();
    };
  }, [profile, user]);

  const availableTargets = profile?.role === 'teacher' 
    ? PORTAL_ROLES.filter(r => r.id !== 'teacher') 
    : teacherList;

  const getRoleLabel = (id) => {
    const role = PORTAL_ROLES.find(r => r.id === id);
    if (role) return role.label;
    const teacher = teacherList.find(t => t.id === id);
    if (teacher) return teacher.label;
    return id;
  };

  const toggleRole = (roleId) => {
    setTargetRoles(prev => 
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  const handleComposeSubmit = async (e) => {
    e.preventDefault();
    if (targetRoles.length === 0 || !subject.trim() || !message.trim()) return;
    
    setIsSubmitting(true);
    try {
      await createTickets(
        user.uid,
        profile.fullName || profile.displayName || 'Unknown',
        profile.role,
        targetRoles,
        subject.trim(),
        message.trim()
      );
      setTargetRoles([]);
      setSubject('');
      setMessage('');
      setActiveTab('sent');
    } catch (err) {
      console.error('Error creating tickets:', err);
      alert('Failed to send request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (ticketId, currentStatus) => {
    const nextStatus = currentStatus === 'pending' ? 'seen' : 'pending';
    try {
      await updateTicketStatus(ticketId, nextStatus);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  return createPortal(
    <>
      <div className={`ticket-drawer-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`ticket-drawer ${isOpen ? 'open' : ''}`}>
        <div className="ticket-header">
          <h2>Anurodh Samvad</h2>
          <button className="ticket-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="ticket-tabs">
          <button 
            className={`ticket-tab ${activeTab === 'inbox' ? 'active' : ''}`}
            onClick={() => setActiveTab('inbox')}
          >
            Inbox {inboxTickets.length > 0 && <span className="ticket-badge">{inboxTickets.length}</span>}
          </button>
          <button 
            className={`ticket-tab ${activeTab === 'sent' ? 'active' : ''}`}
            onClick={() => setActiveTab('sent')}
          >
            Sent
          </button>
          <button 
            className={`ticket-tab ${activeTab === 'compose' ? 'active' : ''}`}
            onClick={() => setActiveTab('compose')}
          >
            Compose
          </button>
          <div className="ticket-legend" title="Pending: Red&#10;In Process: Yellow&#10;Seen: Blue&#10;Completed: Green" style={{ display: 'flex', alignItems: 'center', padding: '0 16px', cursor: 'help', color: 'var(--text-muted)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>info</span>
          </div>
        </div>

        <div className="ticket-content">
          {activeTab === 'compose' && (
            <form className="ticket-form" onSubmit={handleComposeSubmit}>
              <div className="form-group">
                <label className="form-label">To (Target Roles):</label>
                <div className="dept-chips">
                  {availableTargets.map(role => (
                    <button
                      key={role.id}
                      type="button"
                      className={`dept-chip ${targetRoles.includes(role.id) ? 'selected' : ''}`}
                      onClick={() => toggleRole(role.id)}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Subject:</label>
                <input 
                  className="form-input"
                  type="text" 
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="E.g., Need syllabus update"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Message:</label>
                <textarea 
                  className="form-textarea"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Describe your request..."
                  required
                  rows={6}
                />
              </div>
              <button 
                type="submit" 
                className="submit-btn" 
                style={{ width: '100%', marginTop: 'auto' }}
                disabled={isSubmitting || targetRoles.length === 0 || !subject.trim() || !message.trim()}
              >
                {isSubmitting ? 'Sending...' : 'Send Request'}
              </button>
            </form>
          )}

          {activeTab === 'inbox' && (
            <div className="ticket-list">
              {inboxTickets.length === 0 ? (
                <div className="empty-state">No incoming requests.</div>
              ) : (
                inboxTickets.map(ticket => (
                  <TicketItem key={ticket.id} ticket={ticket} isInbox={true} getRoleLabel={getRoleLabel} user={user} profile={profile} />
                ))
              )}
            </div>
          )}

          {activeTab === 'sent' && (
            <div className="ticket-list">
              {sentTickets.length === 0 ? (
                <div className="empty-state">No sent requests.</div>
              ) : (
                sentTickets.map(ticket => (
                  <TicketItem key={ticket.id} ticket={ticket} isInbox={false} getRoleLabel={getRoleLabel} user={user} profile={profile} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
