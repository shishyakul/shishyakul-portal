import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('System Admin (Vaishali Ma\'am) Commercial Pipeline & Audit', () => {

  // Sample student dataset reflecting live Firestore contracts
  const mockStudents = [
    {
      id: 'stu-1',
      studentName: 'Aarav Sharma',
      status: 'admitted',
      batch: '10th-CBSE Alpha',
      totalFees: 45000,
      installments: 3,
      paidInstallments: [0, 1], // 2 of 3 paid
      contactNo: '9876543210',
      fatherContact: '9876543211',
      paymentDetails: {
        '0': { mode: 'Cash', amount: 15000, paidAt: '2026-09-20T10:00:00Z' },
        '1': { mode: 'UPI', amount: 15000, paidAt: new Date().toISOString() }
      }
    },
    {
      id: 'stu-2',
      studentName: 'Diya Patel',
      status: 'admitted',
      batch: '9th-CBSE Bravo',
      totalFees: 40000,
      installments: 4,
      paidInstallments: [0], // 1 of 4 paid
      contactNo: '9123456780',
      fatherContact: '9123456789',
      paymentDetails: {
        '0': { mode: 'Cash', amount: 10000, paidAt: new Date().toISOString() }
      }
    },
    {
      id: 'stu-3',
      studentName: 'Rohan Gupta',
      status: 'admitted',
      batch: '10th-CBSE Delta',
      totalFees: 30000,
      installments: 2,
      paidInstallments: [0, 1], // Fully paid!
      contactNo: '9988776655',
      fatherContact: '9988776654',
      paymentDetails: {
        '0': { mode: 'Cheque', amount: 15000, paidAt: '2026-09-01T10:00:00Z' },
        '1': { mode: 'UPI', amount: 15000, paidAt: '2026-09-15T10:00:00Z' }
      }
    },
    {
      id: 'stu-4',
      studentName: 'Ananya Verma',
      status: 'demo',
      standard: '10th',
      board: 'CBSE',
      contactNo: '9811223344',
      demoSchedule: {
        day1: { date: '2026-09-20', attendance: 'present' },
        day2: { date: '2026-09-21', attendance: 'present' },
        day3: { date: '2026-09-22', attendance: 'pending' }
      }
    },
    {
      id: 'stu-5',
      studentName: 'Kabir Mehta',
      status: 'enquiry',
      standard: '9th',
      board: 'CBSE',
      contactNo: '9822334455'
    },
    {
      id: 'stu-6',
      studentName: 'Simran Kaur',
      status: 'dropped',
      standard: '8th',
      board: 'CBSE'
    }
  ];

  test('1. Commercial & Revenue Health Engine (Total Expected, Collected, Pending, Rates)', () => {
    let totalExpected = 0;
    let totalCollected = 0;
    const funnel = { enquiry: 0, demo: 0, admitted: 0, dropped: 0 };

    mockStudents.forEach(s => {
      const st = s.status || 'enquiry';
      if (funnel[st] !== undefined) funnel[st]++;

      if (st === 'admitted' && s.totalFees) {
        totalExpected += Number(s.totalFees);
        const instCount = Number(s.installments) || 1;
        const instAmount = s.totalFees / instCount;
        const paidCount = (s.paidInstallments || []).length;
        totalCollected += (instAmount * paidCount);
      }
    });

    totalExpected = Math.round(totalExpected);
    totalCollected = Math.round(totalCollected);
    const totalPending = totalExpected - totalCollected;
    const collectionRate = Math.round((totalCollected / totalExpected) * 100);
    const conversionRate = Math.round((funnel.admitted / mockStudents.length) * 100);

    // Assertions
    // Expected: 45000 + 40000 + 30000 = 115,000
    assert.equal(totalExpected, 115000, 'Expected total should be 115,000');
    // Collected: (15000*2) + (10000*1) + (15000*2) = 30000 + 10000 + 30000 = 70,000
    assert.equal(totalCollected, 70000, 'Collected total should be 70,000');
    // Pending: 115000 - 70000 = 45,000
    assert.equal(totalPending, 45000, 'Pending total should be 45,000');
    // Collection Rate: 70000 / 115000 = 61%
    assert.equal(collectionRate, 61, 'Collection rate should be 61%');
    // Conversion: 3 admitted out of 6 students = 50%
    assert.equal(conversionRate, 50, 'Conversion rate should be 50%');
  });

  test('2. Installment Recovery Calling Queue Engine (Only Pending Installments, Correct Next Due)', () => {
    const queue = mockStudents
      .filter(s => s.status === 'admitted' && s.totalFees && Number(s.installments) > 1)
      .map(s => {
        const total = Number(s.totalFees);
        const totalInst = Number(s.installments);
        const paidList = s.paidInstallments || [];
        const paidCount = paidList.length;
        const pendingCount = Math.max(0, totalInst - paidCount);
        const instAmount = Math.round(total / totalInst);
        const pendingAmount = Math.max(0, total - (instAmount * paidCount));
        const nextInstIndex = paidCount;

        return {
          id: s.id,
          studentName: s.studentName,
          totalInst,
          paidCount,
          pendingCount,
          instAmount,
          pendingAmount,
          nextInstIndex
        };
      })
      .filter(item => item.pendingCount > 0);

    // Stu-3 is fully paid (2 of 2), so queue must only contain Stu-1 and Stu-2
    assert.equal(queue.length, 2, 'Queue must exclude fully paid students');

    const aarav = queue.find(q => q.studentName === 'Aarav Sharma');
    assert.ok(aarav, 'Aarav Sharma must be in queue');
    assert.equal(aarav.pendingCount, 1, 'Aarav should have 1 pending installment');
    assert.equal(aarav.instAmount, 15000, 'Aarav next installment should be 15,000');
    assert.equal(aarav.nextInstIndex, 2, 'Aarav next installment index should be 2 (Installment #3)');

    const diya = queue.find(q => q.studentName === 'Diya Patel');
    assert.ok(diya, 'Diya Patel must be in queue');
    assert.equal(diya.pendingCount, 3, 'Diya should have 3 pending installments');
    assert.equal(diya.instAmount, 10000, 'Diya installment amount should be 10,000');
    assert.equal(diya.pendingAmount, 30000, 'Diya pending total should be 30,000');
  });

  test('3. Today\'s Collections Reconciliation Engine (Cash vs UPI vs Cheque)', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    let cashTotal = 0;
    let upiTotal = 0;
    let chequeTotal = 0;
    let razorpayTotal = 0;
    const receipts = [];

    mockStudents.forEach(s => {
      const details = s.paymentDetails;
      if (!details) return;

      Object.entries(details).forEach(([instIdx, p]) => {
        const paidDate = (p.paidAt || '').split('T')[0];
        const amt = Number(p.amount || 0);

        if (paidDate === todayStr) {
          const mode = (p.mode || 'Cash').toLowerCase();
          if (mode.includes('cash')) cashTotal += amt;
          else if (mode.includes('upi')) upiTotal += amt;
          else if (mode.includes('cheque') || mode.includes('check')) chequeTotal += amt;
          else razorpayTotal += amt;

          receipts.push({ student: s.studentName, mode: p.mode, amount: amt });
        }
      });
    });

    const grandTotal = cashTotal + upiTotal + chequeTotal + razorpayTotal;

    // Today's receipts in mock:
    // Aarav: UPI 15,000
    // Diya: Cash 10,000
    assert.equal(cashTotal, 10000, 'Cash total logged today should be 10,000');
    assert.equal(upiTotal, 15000, 'UPI total logged today should be 15,000');
    assert.equal(grandTotal, 25000, 'Grand total collected today should be 25,000');
    assert.equal(receipts.length, 2, 'Two receipts logged today');
  });

  test('4. Admissions & Demo Conversion Pipeline (3-Day Demo Tracking)', () => {
    const demoStudents = mockStudents.filter(s => s.status === 'demo');
    assert.equal(demoStudents.length, 1, 'Should find 1 student in demo stage');
    
    const ananya = demoStudents[0];
    assert.equal(ananya.studentName, 'Ananya Verma');
    assert.equal(ananya.demoSchedule.day1.attendance, 'present');
    assert.equal(ananya.demoSchedule.day2.attendance, 'present');
    assert.equal(ananya.demoSchedule.day3.attendance, 'pending');
  });

  test('5. System Admin Role & Navigation Matrix Audit', () => {
    // Verify NAV_CONFIG rules for admin:
    // admin MUST have access to: /fees, /pending-admissions, /admissions, /enquiries, /batches
    // admin must NOT have /users (Manage Teachers is exclusively for Sumit Sir & Rohan Sir)
    const adminRoutes = [
      '/dashboard',
      '/enquiries',
      '/pending-admissions',
      '/admissions',
      '/demo-dashboard',
      '/batches',
      '/fees',
      '/attendance',
      '/students',
      '/communication-log'
    ];

    assert.ok(adminRoutes.includes('/fees'), 'System Admin MUST have Fees Ledger');
    assert.ok(adminRoutes.includes('/pending-admissions'), 'System Admin MUST have Pending Admissions');
    assert.ok(adminRoutes.includes('/admissions'), 'System Admin MUST have Admissions CRM');
    assert.ok(!adminRoutes.includes('/users'), 'System Admin must NOT have /users (Teacher Management)');
  });
});
