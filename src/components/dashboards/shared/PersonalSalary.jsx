import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function PersonalSalary({ profile }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = profile?.id || user?.uid;
  const userRole = profile?.role || 'admin';
  
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());

  // FAQ Accordion State
  const [activeFaq, setActiveFaq] = useState(null);

  // Determine Base Pay by Role
  const getBaseSalaryByRole = (role) => {
    switch (role) {
      case 'admin':
        return 55000;
      case 'branch_manager':
        return 50000;
      case 'service_manager':
        return 45000;
      case 'front_desk_manager':
        return 30000;
      case 'inventory_manager':
        return 30000;
      default:
        return 30000;
    }
  };

  const basePay = profile?.baseSalary || getBaseSalaryByRole(userRole);

  // Fetch Attendance Records
  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'teacher_attendance'),
      where('teacherId', '==', userId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAttendanceRecords(records);
    });
    return () => unsub();
  }, [userId]);

  // Fetch Leave Requests
  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'leave_requests'),
      where('teacherId', '==', userId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeaveRequests(records);
    });
    return () => unsub();
  }, [userId]);

  const currentYear = calendarDate.getFullYear();

  // Dynamic Holiday Analytics
  const yearlyHolidayStats = {
    summer: { quota: 15, used: 0 },
    sick: { quota: 5, used: 0 },
    festival: { quota: 5, used: 0 },
    travel: { quota: 5, used: 0 },
  };

  leaveRequests.forEach(req => {
    if (req.status === 'approved' && yearlyHolidayStats[req.type]) {
      yearlyHolidayStats[req.type].used += parseInt(req.totalDays || 0);
    }
  });

  const totalHolidaysUsed = Object.values(yearlyHolidayStats).reduce((acc, curr) => acc + curr.used, 0);

  // Calculate Yearly Attendance Statistics
  const calculateYearlyStats = (year) => {
    let presentDays = 0, absentDays = 0, lateMarks = 0, sundays = 0, holidaysTook = 0;
    const today = new Date();

    let academicYearStart;
    if (today.getMonth() < 3) {
      academicYearStart = new Date(today.getFullYear() - 1, 3, 1);
    } else {
      academicYearStart = new Date(today.getFullYear(), 3, 1);
    }

    const timeDiff = today.getTime() - academicYearStart.getTime();
    let daysPassed = Math.ceil(timeDiff / (1000 * 3600 * 24));
    if (daysPassed < 0) daysPassed = 0;

    for (let i = 0; i < daysPassed; i++) {
      const d = new Date(academicYearStart);
      d.setDate(d.getDate() + i);
      if (d.getDay() === 0) sundays++;
    }

    leaveRequests.forEach(lr => {
      if (lr.status === 'approved') {
        const start = new Date(lr.startDate);
        const end = lr.endDate ? new Date(lr.endDate) : start;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (d >= academicYearStart && d <= today) {
            if (d.getDay() !== 0) {
              holidaysTook++;
            }
          }
        }
      }
    });

    const filtered = attendanceRecords.filter(r => {
      const d = new Date(r.date);
      return d >= academicYearStart && d <= today;
    });

    filtered.forEach(r => {
      if (r.status === 'Present' || r.status === 'On Time') {
        presentDays++;
      } else if (r.status === 'Late') {
        presentDays++;
        lateMarks++;
      } else {
        absentDays++;
      }
    });

    return { absentDays };
  };

  const yearlyStats = calculateYearlyStats(currentYear);

  // Deductions & Salary calculation
  const dailyRate = Math.round(basePay / 30);
  const absentDeduction = (yearlyStats.absentDays || 0) * dailyRate;
  
  const annualHolidayQuota = 15;
  const hasExceededHolidays = totalHolidaysUsed > annualHolidayQuota;
  const extraHolidayDeduction = hasExceededHolidays ? (totalHolidaysUsed - annualHolidayQuota) * dailyRate : 0;
  
  const totalDeductions = absentDeduction + extraHolidayDeduction;
  const netPay = basePay - totalDeductions;

  // Format currency
  const inr = (num) => `₹${Math.round(num).toLocaleString('en-IN')}`;

  // Donut Chart Data
  const salaryChartData = [
    { name: 'Base Pay', value: netPay > 0 ? netPay : 0, color: '#10b981' },
    { name: 'Deductions', value: totalDeductions, color: '#ef4444' }
  ].filter(d => d.value > 0);

  // Dummy Payslip History
  const payslipHistory = [
    { month: 'June 2026', gross: basePay, deductions: 0, net: basePay, status: 'Credited' },
    { month: 'May 2026', gross: basePay, deductions: 0, net: basePay, status: 'Credited' },
    { month: 'April 2026', gross: basePay, deductions: 0, net: basePay, status: 'Credited' },
  ];

  const toggleFaq = (idx) => {
    setActiveFaq(activeFaq === idx ? null : idx);
  };

  return (
    <div style={{ padding: '0 8px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')} style={{ padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 style={{ margin: 0, fontSize: 24, color: 'var(--text-primary)' }}>Salary Dashboard</h2>
      </div>

      {/* Top Metrics Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="portal-card" style={{ padding: '24px 20px', background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: 13, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Net Pay</p>
              <h3 style={{ margin: 0, fontSize: 28, color: 'white', fontWeight: 900 }}>{inr(netPay)}</h3>
            </div>
            <div style={{ padding: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 12 }}>
              <span className="material-symbols-outlined" style={{ color: '#38bdf8' }}>account_balance_wallet</span>
            </div>
          </div>
        </div>

        <div className="portal-card" style={{ padding: '24px 20px', background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lost to Absences</p>
              <h3 style={{ margin: 0, fontSize: 28, color: '#ef4444', fontWeight: 900 }}>-{inr(totalDeductions)}</h3>
            </div>
            <div style={{ padding: 8, background: 'rgba(239,68,68,0.1)', borderRadius: 12 }}>
              <span className="material-symbols-outlined" style={{ color: '#ef4444' }}>trending_down</span>
            </div>
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            {yearlyStats.absentDays} Absences + {hasExceededHolidays ? totalHolidaysUsed - annualHolidayQuota : 0} Over-Quota Leaves
          </p>
        </div>

        <div className="portal-card" style={{ padding: '24px 20px', background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Performance Bonus</p>
              <h3 style={{ margin: 0, fontSize: 28, color: '#94a3b8', fontWeight: 900 }}>{inr(0)}</h3>
            </div>
            <div style={{ padding: 8, background: 'rgba(148,163,184,0.1)', borderRadius: 12 }}>
              <span className="material-symbols-outlined" style={{ color: '#64748b' }}>trending_up</span>
            </div>
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>Disabled for Manager roles</p>
        </div>

        <div className="portal-card" style={{ padding: '24px 20px', background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</p>
              <h3 style={{ margin: 0, fontSize: 28, color: '#f59e0b', fontWeight: 900 }}>Processing</h3>
            </div>
            <div style={{ padding: 8, background: 'rgba(245,158,11,0.1)', borderRadius: 12 }}>
              <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>pending_actions</span>
            </div>
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>Disbursal on 1st of next month</p>
        </div>
      </div>

      {/* Split View: Math & Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 24 }}>
        {/* The Math (Digital Receipt Design) */}
        <div className="portal-card" style={{ padding: 24, background: '#faf9f6', border: '1px solid #e4e2dd', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'var(--brand-primary)' }}></div>
          <h3 style={{ margin: '8px 0 20px 0', fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '2px solid #e4e2dd', paddingBottom: 12 }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>receipt_long</span>
            CURRENT PAYROLL STATEMENT
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Base Salary Package</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{inr(basePay)}</span>
            </div>
            
            {absentDeduction > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Absent Deductions ({yearlyStats.absentDays} days)</span>
                <span style={{ fontWeight: 'bold', color: '#ef4444' }}>-{inr(absentDeduction)}</span>
              </div>
            )}
            
            {extraHolidayDeduction > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Over-Quota Leave Deductions</span>
                <span style={{ fontWeight: 'bold', color: '#ef4444' }}>-{inr(extraHolidayDeduction)}</span>
              </div>
            )}

            <div style={{ borderTop: '2px dashed #cbd5e1', paddingTop: 14, marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: '900', color: 'var(--text-primary)' }}>ESTIMATED NET PAYOUT</span>
              <span style={{ fontSize: 26, fontWeight: '900', color: 'var(--brand-primary)' }}>{inr(netPay)}</span>
            </div>

            {/* Dotted border line */}
            <div style={{ borderTop: '2px dashed #cbd5e1', marginTop: 12, paddingTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {/* CSS mock Barcode */}
              <div style={{ display: 'flex', height: 40, width: '80%', gap: 2, background: 'transparent' }}>
                {Array.from({ length: 48 }).map((_, i) => (
                  <div key={i} style={{
                    flex: 1,
                    background: '#1e293b',
                    opacity: (i % 3 === 0 || i % 7 === 0) ? 0.3 : 0.9,
                    height: '100%',
                    borderRadius: 1
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', letterSpacing: 2 }}>PAYROLL-ID: SHISH-MGR-{userId?.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* The Chart */}
        <div className="portal-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: 'var(--text-primary)' }}>Earnings vs Deductions</h3>
          <div style={{ flex: 1, minHeight: 220, position: 'relative' }}>
            {salaryChartData.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                No breakdown available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salaryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {salaryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => inr(val)}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Payslip History */}
      <div className="portal-card" style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 20px 0' }}>Payslip Vault</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="portal-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--surface-border)' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Pay Period</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Gross Earnings</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Total Deductions</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Net Paid</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Payslip</th>
              </tr>
            </thead>
            <tbody>
              {payslipHistory.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{row.month}</td>
                  <td style={{ padding: '12px 16px' }}>{inr(row.gross)}</td>
                  <td style={{ padding: '12px 16px', color: row.deductions > 0 ? '#ef4444' : 'inherit' }}>
                    {row.deductions > 0 ? `-${inr(row.deductions)}` : inr(0)}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--brand-primary)' }}>{inr(row.net)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 'bold' }}>
                      {row.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12 }} onClick={() => alert('Downloading payslip PDF...')}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQs & Guidelines */}
      <div className="portal-card" style={{ padding: 24 }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>gavel</span>
          Institution Payroll Rules & Guidelines
        </h3>
        <p style={{ margin: '0 0 20px 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          Click on any guidelines question below to expand the official policy details for Shishyakul staff.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            {
              q: "How is the daily salary rate computed for deductions?",
              a: "Standard daily wages are computed using the calendar formula: Base Salary divided by 30 days. Any unapproved absence day results in a direct deduction of one daily wage rate."
            },
            {
              q: "What are the yearly leave quotas and limits?",
              a: "Shishyakul provides 30 days of approved holidays annually (15 Summer, 5 Sick, 5 Festival, 5 Travel). To keep payroll cycles stable, a maximum limit of 15 days is allowed annually without deduction. Leaves exceeding 15 days trigger pro-rata deductions."
            },
            {
              q: "What is the check-in grace period policy?",
              a: "Biometric check-ins must be completed by 10:00 AM. A check-in between 10:01 AM and 10:15 AM is logged as 'On Time' but flagged. Any check-in after 10:15 AM is marked 'Late'. Accumulating 3 'Late' check-ins results in a half-day salary deduction."
            },
            {
              q: "When are payroll calculations finalized and disbursed?",
              a: "Attendance records lock on the 25th of the month. Bridging calculations are audited and finalized on the 28th. Direct bank disbursal processing takes place on the 1st of the subsequent month."
            }
          ].map((faq, idx) => (
            <div key={idx} style={{ border: '1px solid var(--surface-border)', borderRadius: 8, overflow: 'hidden', background: '#f8fafc' }}>
              <button
                onClick={() => toggleFaq(idx)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 20px',
                  background: 'white',
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: activeFaq === idx ? 'var(--brand-primary)' : 'var(--text-primary)'
                }}
              >
                <span>{faq.q}</span>
                <span className="material-symbols-outlined" style={{ fontSize: 20, transition: 'transform 0.2s', transform: activeFaq === idx ? 'rotate(180deg)' : 'none' }}>
                  expand_more
                </span>
              </button>
              {activeFaq === idx && (
                <div style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-secondary)', borderTop: '1px solid var(--surface-border)', background: '#f8fafc', lineHeight: 1.5 }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
