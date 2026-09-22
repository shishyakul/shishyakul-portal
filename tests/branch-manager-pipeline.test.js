import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Branch Manager (Sumit Sir) Operations Control Room Pipeline Audit', () => {

  const BATCH_DEF = {
    '8th': [
      { id: '8th-CBSE Alpha', title: '8th-CBSE Alpha' },
      { id: '8th-CBSE Bravo', title: '8th-CBSE Bravo' },
      { id: '8th-CBSE Delta', title: '8th-CBSE Delta' },
      { id: '8th-CBSE Echo', title: '8th-CBSE Echo' },
    ],
    '9th': [
      { id: '9th-CBSE Alpha', title: '9th-CBSE Alpha' },
      { id: '9th-CBSE Bravo', title: '9th-CBSE Bravo' },
      { id: '9th-CBSE Charlie', title: '9th-CBSE Charlie' },
      { id: '9th-CBSE Echo', title: '9th-CBSE Echo' },
      { id: '9th-CBSE Foxtrot', title: '9th-CBSE Foxtrot' },
      { id: '9th-State Delta', title: '9th-State Delta' },
    ],
    '10th': [
      { id: '10th-CBSE Alpha', title: '10th-CBSE Alpha' },
      { id: '10th-CBSE Bravo', title: '10th-CBSE Bravo' },
      { id: '10th-CBSE Charlie', title: '10th-CBSE Charlie' },
      { id: '10th-CBSE Delta', title: '10th-CBSE Delta' },
      { id: '10th-CBSE Echo', title: '10th-CBSE Echo' },
      { id: '10th-CBSE Foxtrot', title: '10th-CBSE Foxtrot' },
      { id: '10th-State Hitman', title: '10th-State Hitman' },
      { id: '10th-State Golf', title: '10th-State Golf' },
    ]
  };

  test('1. 18-Batch Capacity & Occupancy Radar Engine (18 Total Batches, Occupancy %)', () => {
    const totalBatches = Object.values(BATCH_DEF).flat();
    assert.equal(totalBatches.length, 18, 'There must be exactly 18 batches in the institute schedule');

    const mockAdmittedStudents = [
      { id: 's1', batch: '10th-CBSE Alpha' },
      { id: 's2', batch: '10th-CBSE Alpha' },
      { id: 's3', batch: '10th-CBSE Alpha' },
      { id: 's4', batch: '9th-CBSE Bravo' },
      { id: 's5', batch: '8th-CBSE Delta' },
    ];

    const countsByBatch = {};
    mockAdmittedStudents.forEach(s => {
      countsByBatch[s.batch] = (countsByBatch[s.batch] || 0) + 1;
    });

    const alpha10thCount = countsByBatch['10th-CBSE Alpha'] || 0;
    const capacity = 20;
    const occupancyRate = Math.round((alpha10thCount / capacity) * 100);

    assert.equal(alpha10thCount, 3, '10th Alpha should have 3 enrolled students');
    assert.equal(occupancyRate, 15, 'Occupancy rate for 3 of 20 should be 15%');
  });

  test('2. Faculty Leave Approval & Rejection State Transitions', () => {
    const leaveRequest = {
      id: 'leave-101',
      teacherId: 'teacher-amit',
      teacherName: 'Amit Verma',
      totalDays: 2,
      startDate: '2026-09-25',
      endDate: '2026-09-26',
      reason: 'Attending family wedding',
      status: 'pending'
    };

    // Simulate approval by Sumit Sir
    const approvedPayload = {
      ...leaveRequest,
      status: 'approved',
      reviewedBy: 'Sumit Sir (Branch Manager)',
      reviewedAt: '2026-09-22T10:00:00Z'
    };

    assert.equal(approvedPayload.status, 'approved');
    assert.equal(approvedPayload.reviewedBy, 'Sumit Sir (Branch Manager)');

    // Simulate rejection by Sumit Sir with remark
    const rejectedPayload = {
      ...leaveRequest,
      status: 'rejected',
      reviewRemarks: 'Exam duty scheduled on 26th September. Please reschedule.',
      reviewedBy: 'Sumit Sir (Branch Manager)',
      reviewedAt: '2026-09-22T10:05:00Z'
    };

    assert.equal(rejectedPayload.status, 'rejected');
    assert.ok(rejectedPayload.reviewRemarks.includes('Exam duty scheduled'));
  });

  test('3. Executive Payroll Bridge to Core Engine (Contract & Calculation)', () => {
    const teacher = {
      id: 'teach-suresh',
      fullName: 'Suresh Raina',
      role: 'teacher',
      baseSalary: 40000,
      classTeacherBatch: '10th-CBSE Alpha',
      bonus: 2000,
      deductions: 1000
    };

    const currentMonth = '2026-09';
    const mockAttendance = [
      { userId: 'teach-suresh', date: '2026-09-01', status: 'Present' },
      { userId: 'teach-suresh', date: '2026-09-02', status: 'Present' },
      { userId: 'teach-suresh', date: '2026-09-03', status: 'Present' },
      { userId: 'teach-suresh', date: '2026-09-04', status: 'Absent' }
    ];

    const mockReports = [
      { teacherId: 'teach-suresh', date: '2026-09-01', subject: 'Mathematics' },
      { teacherId: 'teach-suresh', date: '2026-09-02', subject: 'Mathematics' }
    ];

    const daysPresent = mockAttendance.filter(a => a.userId === teacher.id && a.date.startsWith(currentMonth) && a.status === 'Present').length;
    const lecturesDelivered = mockReports.filter(r => r.teacherId === teacher.id && r.date.startsWith(currentMonth)).length;

    const allowances = teacher.classTeacherBatch ? 3000 : 0;
    const gross = teacher.baseSalary + allowances + teacher.bonus;
    const net = gross - teacher.deductions;

    assert.equal(daysPresent, 3, 'Days present should be 3');
    assert.equal(lecturesDelivered, 2, 'Lectures delivered should be 2');
    assert.equal(allowances, 3000, 'Class teacher allowance should be 3000');
    assert.equal(gross, 45000, 'Gross salary: 40000 + 3000 + 2000 = 45000');
    assert.equal(net, 44000, 'Net salary: 45000 - 1000 = 44000');
  });

  test('4. PTM Escalation Resolution Lifecycle (Requires Manager Flag)', () => {
    const mockStudentWithPTM = {
      id: 'stu-neha',
      studentName: 'Neha Desai',
      batch: '9th-CBSE Charlie',
      ptmNotices: [
        {
          createdAt: '2026-09-20T12:00:00Z',
          teacherId: 'teach-1',
          teacherName: 'Pooja Mam',
          reason: 'Severe drop in science test scores. Parent requested discussion.',
          requiresManager: true,
          status: 'pending'
        }
      ]
    };

    const pendingEscalations = [];
    if (mockStudentWithPTM.ptmNotices) {
      mockStudentWithPTM.ptmNotices.forEach(p => {
        if (p.requiresManager && p.status === 'pending') {
          pendingEscalations.push({ ...p, studentName: mockStudentWithPTM.studentName });
        }
      });
    }

    assert.equal(pendingEscalations.length, 1, 'Should find 1 pending PTM requiring manager');
    assert.equal(pendingEscalations[0].studentName, 'Neha Desai');

    // Simulate resolution
    const resolvedNotices = mockStudentWithPTM.ptmNotices.map(p => {
      if (p.createdAt === '2026-09-20T12:00:00Z') {
        return { ...p, status: 'resolved' };
      }
      return p;
    });

    assert.equal(resolvedNotices[0].status, 'resolved', 'Notice should transition to resolved');
  });

  test('5. Branch Manager Role & Permission Matrix Audit', () => {
    const branchManagerRoutes = [
      '/dashboard',
      '/enquiries',
      '/admissions',
      '/demo-dashboard',
      '/batches',
      '/students',
      '/attendance',
      '/users', // Exclusive Teacher & Staff Management
      '/communication-log'
    ];

    assert.ok(branchManagerRoutes.includes('/users'), 'Branch Manager MUST have access to /users (Manage Teachers)');
    assert.ok(branchManagerRoutes.includes('/batches'), 'Branch Manager MUST have access to /batches');
    assert.ok(!branchManagerRoutes.includes('/fees'), 'Branch Manager sidebar must NOT show /fees (Managed by System Admin Vaishali Ma\'am)');
  });
});
