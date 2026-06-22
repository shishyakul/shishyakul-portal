import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

export default function TabAssets({ student }) {
  const [callLogs, setCallLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const q = query(collection(db, 'absentee_followups'), where('studentId', '==', student.id));
        const snapshot = await getDocs(q);
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        logs.sort((a, b) => new Date(b.date) - new Date(a.date));
        setCallLogs(logs);
      } catch (err) {
        console.error('Failed to fetch call logs', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (student.id) fetchLogs();
  }, [student]);

  const kit = student.kitHandover || {};

  return (
    <div className="sd-profile-body">
      
      {/* Kit Handover Section */}
      <div className="sd-section">
        <h3 className="sd-section-title">
          <span className="material-symbols-outlined">inventory_2</span>
          Asset & Kit Handover Status
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
          
          <div style={{ padding: '16px', background: 'var(--surface-bg)', borderRadius: '8px', border: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Uniform T-Shirt</span>
            {kit.tshirt ? (
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{kit.tshirt.style} ({kit.tshirt.size})</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Handed over: {kit.tshirt.date}</div>
              </div>
            ) : (
              <div style={{ color: 'var(--status-error)', fontSize: '14px', fontWeight: 500 }}>Pending</div>
            )}
          </div>

          <div style={{ padding: '16px', background: 'var(--surface-bg)', borderRadius: '8px', border: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Shishyakul Bag</span>
            {kit.bag ? (
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '4px' }}><span className="material-symbols-outlined" style={{fontSize:16}}>check_circle</span> Delivered</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Handed over: {kit.bag.date}</div>
              </div>
            ) : (
              <div style={{ color: 'var(--status-error)', fontSize: '14px', fontWeight: 500 }}>Pending</div>
            )}
          </div>

          <div style={{ padding: '16px', background: 'var(--surface-bg)', borderRadius: '8px', border: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Oswal Question Bank</span>
            {kit.oswalKit ? (
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '4px' }}><span className="material-symbols-outlined" style={{fontSize:16}}>check_circle</span> Delivered</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Handed over: {kit.oswalKit.date}</div>
              </div>
            ) : (
              <div style={{ color: 'var(--status-error)', fontSize: '14px', fontWeight: 500 }}>Pending</div>
            )}
          </div>

          <div style={{ padding: '16px', background: 'var(--surface-bg)', borderRadius: '8px', border: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Hanuman Chalisa</span>
            {kit.hanumanChalisa ? (
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '4px' }}><span className="material-symbols-outlined" style={{fontSize:16}}>check_circle</span> Delivered</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Handed over: {kit.hanumanChalisa.date}</div>
              </div>
            ) : (
              <div style={{ color: 'var(--status-error)', fontSize: '14px', fontWeight: 500 }}>Pending</div>
            )}
          </div>

          <div style={{ padding: '16px', background: 'var(--surface-bg)', borderRadius: '8px', border: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Self Help Book</span>
            {kit.selfHelpBook ? (
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '4px' }}><span className="material-symbols-outlined" style={{fontSize:16}}>check_circle</span> Delivered</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Handed over: {kit.selfHelpBook.date}</div>
              </div>
            ) : (
              <div style={{ color: 'var(--status-error)', fontSize: '14px', fontWeight: 500 }}>Pending</div>
            )}
          </div>

        </div>
      </div>

      {/* Communication Log Section */}
      <div className="sd-section" style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="sd-section-title" style={{ margin: 0 }}>
            <span className="material-symbols-outlined">support_agent</span>
            Parent Communication & Call Logs
          </h3>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Logs generated from Absentee Follow-ups</span>
        </div>

        {loading ? (
          <div style={{ padding: '24px', color: 'var(--text-secondary)' }}>Loading communication history...</div>
        ) : callLogs.length === 0 ? (
          <div className="sd-empty-state" style={{ minHeight: '120px' }}>
            <span className="material-symbols-outlined">speaker_notes_off</span>
            <div>No calls logged for this student yet.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {callLogs.map(log => (
              <div key={log.id} style={{ background: '#fff', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--brand-primary)' }}>call_made</span>
                    Absentee Follow-up Call
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{log.date}</span>
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                  <strong>Note: </strong> {log.reason || <span style={{ color: 'var(--text-muted)' }}>No detailed remarks recorded during the call.</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
    </div>
  );
}
