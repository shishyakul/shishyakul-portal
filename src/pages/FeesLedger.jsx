import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, limit } from 'firebase/firestore';
import { db } from '../firebase';
import './FeesLedger.css';

export default function FeesLedger() {
  const [admittedStudents, setAdmittedStudents] = useState([]);
  const [droppedStudents, setDroppedStudents] = useState([]);
  const [activeTab, setActiveTab] = useState('ledger');
  const [loadingPayment, setLoadingPayment] = useState(null);

  // Manual payment popup state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualPayStudentId, setManualPayStudentId] = useState(null);
  const [manualPayInstIndex, setManualPayInstIndex] = useState(null);
  const [manualPayAmount, setManualPayAmount] = useState(0);
  const [manualPayMode, setManualPayMode] = useState('Cash');
  const [manualPayProof, setManualPayProof] = useState('');

  // Refund processing state (studentId -> syllabus completed %)
  const [refundData, setRefundData] = useState({});

  // Input state for follow-up notes (studentId -> local text)
  const [followupInputs, setFollowupInputs] = useState({});

  useEffect(() => {
    // Listen to only admitted students
    const q = query(collection(db, 'students'), where('status', '==', 'admitted'), limit(100));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdmittedStudents(data);
    });

    const dropQ = query(collection(db, 'students'), where('status', '==', 'dropped'), limit(100));
    const unsubDrop = onSnapshot(dropQ, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDroppedStudents(data);
    });

    return () => { unsub(); unsubDrop(); };
  }, []);

  // Calculate totals across all students
  const totalExpected = admittedStudents.reduce((acc, s) => acc + (s.totalFees || 0), 0);
  
  let totalCollected = 0;
  admittedStudents.forEach(s => {
    if (s.totalFees && s.installments) {
      const instAmount = s.totalFees / s.installments;
      const paidCount = (s.paidInstallments || []).length;
      totalCollected += (instAmount * paidCount);
    }
  });

  const totalPending = totalExpected - totalCollected;

  const simulateRazorpay = async (studentId, installmentIndex, amount) => {
    setLoadingPayment(`${studentId}-${installmentIndex}`);
    
    // Simulate Razorpay Link Dispatch to parent email
    setTimeout(async () => {
      try {
        const student = admittedStudents.find(s => s.id === studentId);
        const existingDetails = student.paymentDetails || {};
        const updatedDetails = {
          ...existingDetails,
          [installmentIndex]: {
            mode: 'Razorpay (Auto)',
            paidAt: new Date().toISOString(),
            amount: amount
          }
        };

        await updateDoc(doc(db, 'students', studentId), {
          paidInstallments: arrayUnion(installmentIndex),
          paymentDetails: updatedDetails
        });

        alert(`✉️ Payment Link sent to parent's email. Simulating parent click...\n\n✅ Razorpay payment of ₹${amount.toFixed(0)} received!`);
      } catch (err) {
        console.error("Error updating ledger:", err);
      }
      setLoadingPayment(null);
    }, 1500);
  };

  const handleOpenManualPay = (studentId, installmentIndex, amount) => {
    setManualPayStudentId(studentId);
    setManualPayInstIndex(installmentIndex);
    setManualPayAmount(amount);
    setManualPayMode('Cash');
    setManualPayProof('');
    setShowManualModal(true);
  };

  const handleLogManualSubmit = async () => {
    if (!manualPayStudentId) return;
    try {
      const student = admittedStudents.find(s => s.id === manualPayStudentId);
      const existingDetails = student.paymentDetails || {};
      const updatedDetails = {
        ...existingDetails,
        [manualPayInstIndex]: {
          mode: manualPayMode,
          paidAt: new Date().toISOString(),
          amount: manualPayAmount,
          proof: manualPayProof
        }
      };

      await updateDoc(doc(db, 'students', manualPayStudentId), {
        paidInstallments: arrayUnion(manualPayInstIndex),
        paymentDetails: updatedDetails
      });

      setShowManualModal(false);
      setManualPayStudentId(null);
      setManualPayInstIndex(null);
      setManualPayProof('');
      alert(`✅ Ledger updated! Logged offline payment of ₹${manualPayAmount.toFixed(0)} via ${manualPayMode}.`);
    } catch (err) {
      console.error("Error logging manual payment:", err);
      alert("Failed to log payment.");
    }
  };

  const handleAddFollowupNote = async (studentId) => {
    const text = followupInputs[studentId] || '';
    if (!text.trim()) return;

    try {
      const newNote = {
        note: text.trim(),
        date: new Date().toLocaleString()
      };

      await updateDoc(doc(db, 'students', studentId), {
        feesFollowupNotes: arrayUnion(newNote)
      });

      // Clear input
      setFollowupInputs(prev => ({ ...prev, [studentId]: '' }));
    } catch (err) {
      console.error("Error saving fee follow-up:", err);
      alert("Failed to save follow-up log.");
    }
  };

  return (
    <div className="fees-container">
      <div className="fees-header">
        <div className="fees-header-text">
          <h1>Fees & Installment Ledger</h1>
          <p>Razorpay Link Dispatcher & Offline Payment Book</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={`btn ${activeTab === 'ledger' ? 'btn-brand' : 'btn-ghost'}`} onClick={() => setActiveTab('ledger')}>Fee Ledger</button>
          <button className={`btn ${activeTab === 'refunds' ? 'btn-brand' : 'btn-ghost'}`} onClick={() => setActiveTab('refunds')}>Refund Processing</button>
        </div>
      </div>

      <div className="fees-overview">
        <div className="fee-stat-card">
          <div className="fee-stat-icon total">
            <span className="material-symbols-outlined">account_balance_wallet</span>
          </div>
          <div className="fee-stat-info">
            <h3>Total Expected Revenue</h3>
            <div className="stat-amount">₹{totalExpected.toLocaleString()}</div>
          </div>
        </div>
        
        <div className="fee-stat-card">
          <div className="fee-stat-icon revenue">
            <span className="material-symbols-outlined">payments</span>
          </div>
          <div className="fee-stat-info">
            <h3>Total Collected</h3>
            <div className="stat-amount">₹{totalCollected.toLocaleString()}</div>
          </div>
        </div>

        <div className="fee-stat-card">
          <div className="fee-stat-icon pending">
            <span className="material-symbols-outlined">pending_actions</span>
          </div>
          <div className="fee-stat-info">
            <h3>Pending Dues</h3>
            <div className="stat-amount">₹{totalPending.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="ledger-grid">
        {admittedStudents.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No admitted students found in the ledger. Go to Admissions and enroll a student!</p>
        ) : (
          admittedStudents.map(student => {
            const instCount = student.installments || 1;
            const instAmount = (student.totalFees || 0) / instCount;
            const paidArr = student.paidInstallments || [];
            const details = student.paymentDetails || {};

            return (
              <div key={student.id} className="student-ledger-card">
                <div className="ledger-header">
                  <div className="ledger-student-info">
                    <h3>{student.studentName}</h3>
                    <p>Batch: {student.batch || 'Unassigned'} • Parent Phone: {student.fatherContact || student.contactNo || 'N/A'}</p>
                  </div>
                  <div className="ledger-summary">
                    <div className="total-fee">₹{student.totalFees?.toLocaleString()}</div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {instCount} Installment{instCount > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="installments-list">
                  {Array.from({ length: instCount }).map((_, idx) => {
                    const isPaid = paidArr.includes(idx);
                    const isLoading = loadingPayment === `${student.id}-${idx}`;
                    const payInfo = details[idx];

                    return (
                      <div key={idx} className={`installment-row ${isPaid ? 'paid' : ''}`}>
                        <div className="inst-details">
                          <span className="inst-name">Installment {idx + 1}</span>
                          <span className="inst-amount">₹{instAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          {isPaid && payInfo && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span className="payment-meta">
                                Paid via <strong>{payInfo.mode}</strong> on {new Date(payInfo.paidAt).toLocaleDateString()}
                              </span>
                              {payInfo.proof && (
                                <span className="payment-meta" style={{ color: 'var(--brand-primary)' }}>
                                  Proof: {payInfo.proof}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <span className={`inst-status ${isPaid ? 'paid' : 'pending'}`}>
                            {isPaid ? 'PAID' : 'PENDING'}
                          </span>
                          
                          {!isPaid && (
                            <div className="ledger-actions">
                              <button 
                                className={`btn-razorpay ${isLoading ? 'loading' : ''}`}
                                disabled={isLoading}
                                onClick={() => simulateRazorpay(student.id, idx, instAmount)}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send_money</span>
                                {isLoading ? 'Sending Link...' : 'Razorpay Link'}
                              </button>
                              
                              <button 
                                className="btn-manual-pay"
                                onClick={() => handleOpenManualPay(student.id, idx, instAmount)}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>point_of_sale</span>
                                Log Manual
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 📞 Fees Follow-up Notes inline log section */}
                <div className="ledger-followup-section">
                  <div className="followup-notes-title">
                    <span className="material-symbols-outlined">call</span>
                    Fee Collection Call Notes ({student.feesFollowupNotes?.length || 0})
                  </div>

                  <div className="followup-notes-list">
                    {(!student.feesFollowupNotes || student.feesFollowupNotes.length === 0) ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>No fees follow-up notes recorded yet.</p>
                    ) : (
                      student.feesFollowupNotes.map((noteObj, noteIdx) => (
                        <div key={noteIdx} className="followup-note-card">
                          <div className="followup-note-meta">
                            <span>Note #{noteIdx + 1}</span>
                            <span>{noteObj.date}</span>
                          </div>
                          <div className="followup-note-content">{noteObj.note}</div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="followup-note-form">
                    <input 
                      type="text" 
                      placeholder="Add fee calling note (e.g. Parent requested extension till Friday)" 
                      value={followupInputs[student.id] || ''}
                      onChange={(e) => setFollowupInputs({ ...followupInputs, [student.id]: e.target.value })}
                      className="portal-input followup-note-input"
                    />
                    <button 
                      className="btn btn-brand btn-sm"
                      onClick={() => handleAddFollowupNote(student.id)}
                      disabled={!(followupInputs[student.id] || '').trim()}
                    >
                      Save Log
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {activeTab === 'refunds' && (
        <div className="ledger-grid" style={{ marginTop: '32px' }}>
          {droppedStudents.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No dropped students found.</p>
          ) : (
            droppedStudents.map(student => {
              const instCount = student.installments || 1;
              const instAmount = (student.totalFees || 0) / instCount;
              const paidCount = (student.paidInstallments || []).length;
              const totalPaid = instAmount * paidCount;

              const completedPercent = refundData[student.id] || 0;
              const usedAmount = (student.totalFees || 0) * (completedPercent / 100);
              const eligibleRefund = Math.max(0, totalPaid - usedAmount);

              const handleProcessRefund = async () => {
                try {
                  await updateDoc(doc(db, 'students', student.id), {
                    refundProcessed: true,
                    refundAmount: eligibleRefund,
                    refundDate: new Date().toISOString()
                  });
                  alert(`Refund of ₹${eligibleRefund.toFixed(0)} marked as processed!`);
                } catch (err) {
                  console.error("Error processing refund:", err);
                  alert("Failed to process refund.");
                }
              };

              return (
                <div key={student.id} className="student-ledger-card">
                  <div className="ledger-header" style={{ borderBottom: '1px solid var(--surface-border)', paddingBottom: '16px', marginBottom: '16px' }}>
                    <div className="ledger-student-info">
                      <h3>{student.studentName}</h3>
                      <p>Dropped Reason: <strong style={{ color: 'var(--status-error)' }}>{student.dropReason}</strong></p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ background: 'var(--surface-bg)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Fees Paid</p>
                      <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>₹{totalPaid.toFixed(0)}</p>
                    </div>
                    <div style={{ background: 'var(--surface-bg)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Fees Cost</p>
                      <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>₹{(student.totalFees || 0).toLocaleString()}</p>
                    </div>
                  </div>

                  {student.refundProcessed ? (
                    <div style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--status-success)', padding: '16px', borderRadius: 'var(--radius-md)', fontWeight: 600, textAlign: 'center' }}>
                      Refund of ₹{student.refundAmount?.toFixed(0)} processed on {new Date(student.refundDate).toLocaleDateString()}
                    </div>
                  ) : (
                    <>
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label className="form-label">Syllabus % Completed (used for pro-rata)</label>
                        <input 
                          type="number" 
                          min="0" max="100" 
                          placeholder="e.g. 25"
                          value={refundData[student.id] || ''}
                          onChange={e => setRefundData({ ...refundData, [student.id]: Number(e.target.value) })}
                          className="portal-input"
                        />
                      </div>
                      
                      {completedPercent > 0 && (
                        <div style={{ background: 'var(--surface-bg)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '16px', borderLeft: '4px solid var(--brand-primary)' }}>
                          <p style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                            Calculated Used Amount: <strong>₹{usedAmount.toFixed(0)}</strong>
                          </p>
                          <p style={{ fontSize: '15px', color: eligibleRefund > 0 ? 'var(--status-success)' : 'var(--status-error)', fontWeight: 700 }}>
                            Eligible Refund: ₹{eligibleRefund.toFixed(0)}
                          </p>
                        </div>
                      )}

                      <button 
                        className="btn btn-brand" 
                        style={{ width: '100%' }}
                        onClick={handleProcessRefund}
                        disabled={!completedPercent || eligibleRefund === 0}
                      >
                        Mark Refund Processed
                      </button>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Manual Payment Log Popup */}
      {showManualModal && (
        <div className="fees-modal-overlay">
          <div className="fees-modal">
            <h2>💰 Log Manual Payment</h2>
            <p style={{ margin: '8px 0 20px 0' }}>Log an offline cash/check/UPI payment directly into the student ledger.</p>
            
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Payment Amount</label>
              <input 
                type="text" 
                value={`₹${manualPayAmount.toFixed(0)}`} 
                disabled 
                className="portal-input"
                style={{ background: 'var(--surface-bg)', fontWeight: '600' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <select 
                value={manualPayMode} 
                onChange={e => setManualPayMode(e.target.value)} 
                className="portal-select"
              >
                <option value="Cash">Cash</option>
                <option value="UPI (Manual)">UPI (GooglePay/PhonePe/Paytm)</option>
                <option value="Bank Check">Bank Check</option>
                <option value="Direct Bank Transfer">Direct Bank Transfer</option>
              </select>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">Transaction UTR / Image Link (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. UTR123456789 or Google Drive Link"
                value={manualPayProof} 
                onChange={e => setManualPayProof(e.target.value)} 
                className="portal-input"
              />
            </div>

            <div className="modal-footer" style={{ marginTop: '28px' }}>
              <button 
                className="btn btn-ghost" 
                onClick={() => {
                  setShowManualModal(false);
                  setManualPayStudentId(null);
                  setManualPayInstIndex(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-brand" 
                onClick={handleLogManualSubmit}
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
