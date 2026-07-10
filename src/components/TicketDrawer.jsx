import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToInbox, subscribeToSent, createTickets, updateTicketStatus } from '../services/tickets';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import './TicketDrawer.css';

const PORTAL_ROLES = [
  { id: 'admin', label: 'System Admin' },
  { id: 'branch_manager', label: 'Branch Manager' },
  { id: 'service_manager', label: 'Service Manager' },
  { id: 'front_desk_manager', label: 'Front Desk' },
  { id: 'inventory_manager', label: 'Inventory Manager' },
  { id: 'teacher', label: 'Teacher' }
];

const formatStatus = (status) => {
  if (status === 'seen') return 'Seen';
  return 'Pending';
};

const formatDate = (timestamp) => {
  if (!timestamp) return 'Just now';
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleDateString();
  }
  return 'Just now';
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

  return (
    <>
      <div className={`ticket-drawer-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`ticket-drawer ${isOpen ? 'open' : ''}`}>
        <div className="ticket-header">
          <h2>Support Tickets</h2>
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
                  <div key={ticket.id} className={`ticket-item status-${ticket.status}`}>
                    <div className="ticket-item-header">
                      <div className="ticket-sender" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>person</span>
                        <div>
                          <strong style={{ display: 'block', fontSize: 14 }}>{ticket.senderName}</strong>
                          <small className="ticket-item-dept">{getRoleLabel(ticket.senderRole)}</small>
                        </div>
                      </div>
                      <span className="ticket-item-date">{formatDate(ticket.createdAt)}</span>
                    </div>
                    <div className="ticket-item-title">{ticket.subject}</div>
                    <div className="ticket-item-message">{ticket.message}</div>
                    <div className="ticket-item-footer">
                      <span className={`status-badge ${ticket.status}`}>
                        {formatStatus(ticket.status)}
                      </span>
                      <button 
                        className="btn-ghost btn-sm"
                        onClick={() => handleUpdateStatus(ticket.id, ticket.status)}
                      >
                        {ticket.status === 'seen' ? 'Mark Unseen' : 'Mark as Seen'}
                      </button>
                    </div>
                  </div>
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
                  <div key={ticket.id} className={`ticket-item status-${ticket.status}`}>
                    <div className="ticket-item-header">
                      <div className="ticket-sender" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)' }}>forward_to_inbox</span>
                        <div>
                          <strong style={{ fontSize: 14 }}>To: {getRoleLabel(ticket.targetRole)}</strong>
                        </div>
                      </div>
                      <span className="ticket-item-date">{formatDate(ticket.createdAt)}</span>
                    </div>
                    <div className="ticket-item-title">{ticket.subject}</div>
                    <div className="ticket-item-message">{ticket.message}</div>
                    <div className="ticket-item-footer">
                      <span className={`status-badge ${ticket.status}`}>
                        {formatStatus(ticket.status)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
