import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import TicketDrawer from './TicketDrawer';

export default function TopActions() {
  const { profile } = useAuth();
  const [isTicketOpen, setIsTicketOpen] = useState(false);

  // Hide TopActions entirely for students
  if (profile?.role === 'student') return null;

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 24,
        right: 32,
        display: 'flex',
        gap: 16,
        zIndex: 999
      }}>
        <button 
          onClick={() => setIsTicketOpen(true)}
          className="btn-icon"
          title="Open Tickets"
          style={{
            background: 'var(--surface-bg)',
            border: '1px solid var(--surface-border)',
            borderRadius: '50%',
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--brand-primary)',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}
        >
          <span className="material-symbols-outlined">confirmation_number</span>
        </button>
      </div>

      <TicketDrawer isOpen={isTicketOpen} onClose={() => setIsTicketOpen(false)} />
    </>
  );
}
