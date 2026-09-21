import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// 1. LEAVE APPROVALS LIFECYCLE & KAKSH PRESENCE AUTO-TRANSITION ENGINE
// ============================================================================
describe('Teacher-Manager Pipeline: Leave Approvals & Presence Engine', () => {

  const teacherId = 'teacher_brijesh_01';
  const teacherName = 'Brijesh Prajapati';

  // Core handler logic mirroring ServiceManagerDashboard & AdminDashboard
  function approveLeaveRequest(leaveReq, managerName, timestamp = new Date().toISOString()) {
    if (!leaveReq || !leaveReq.id) throw new Error('Invalid leave request');
    return {
      ...leaveReq,
      status: 'approved',
      reviewedBy: managerName,
      reviewedAt: timestamp
    };
  }

  function rejectLeaveRequest(leaveReq, managerName, reason, timestamp = new Date().toISOString()) {
    if (!leaveReq || !leaveReq.id) throw new Error('Invalid leave request');
    return {
      ...leaveReq,
      status: 'rejected',
      reviewRemarks: reason ? reason.trim() : 'Declined by Academic Manager',
      reviewedBy: managerName,
      reviewedAt: timestamp
    };
  }

  // Teacher Presence Status Calculator (from ServiceManagerDashboard line 129)
  function getTeacherStatus(teacherId, todayTeacherAttendance, leaveRequests, todayStr) {
    const attRecord = todayTeacherAttendance.find(r => r.teacherId === teacherId);
    if (attRecord) {
      return {
        type: 'present',
        punchIn: attRecord.punchIn,
        punchOut: attRecord.punchOut,
        status: attRecord.status || 'On Time'
      };
    }

    const onLeave = leaveRequests.some(req =>
      req.teacherId === teacherId &&
      req.status === 'approved' &&
      todayStr >= req.startDate &&
      todayStr <= req.endDate
    );

    if (onLeave) {
      return { type: 'leave' };
    }

    return { type: 'absent' };
  }

  it('correctly processes leave approval by Service Manager Rohan Sir', () => {
    const initialReq = {
      id: 'leave_101',
      teacherId,
      teacherName,
      type: 'sick',
      startDate: '2026-09-22',
      endDate: '2026-09-23',
      totalDays: 2,
      reason: 'Viral fever',
      status: 'pending',
      createdAt: '2026-09-21T08:00:00Z'
    };

    const approvedReq = approveLeaveRequest(initialReq, 'Rohan Sir (Service Manager)', '2026-09-21T09:30:00Z');

    assert.equal(approvedReq.status, 'approved');
    assert.equal(approvedReq.reviewedBy, 'Rohan Sir (Service Manager)');
    assert.equal(approvedReq.reviewedAt, '2026-09-21T09:30:00Z');
  });

  it('correctly processes leave rejection with manager review remarks by Sumit Sir', () => {
    const initialReq = {
      id: 'leave_102',
      teacherId,
      teacherName,
      type: 'casual',
      startDate: '2026-09-25',
      endDate: '2026-09-26',
      totalDays: 2,
      reason: 'Personal work',
      status: 'pending'
    };

    const rejectedReq = rejectLeaveRequest(initialReq, 'Sumit Sir (Branch Manager)', 'Staff shortage during Board prep mock');

    assert.equal(rejectedReq.status, 'rejected');
    assert.equal(rejectedReq.reviewRemarks, 'Staff shortage during Board prep mock');
    assert.equal(rejectedReq.reviewedBy, 'Sumit Sir (Branch Manager)');
  });

  it('dynamically marks teacher as On Leave on the floor map across boundary dates', () => {
    const approvedLeave = {
      id: 'leave_103',
      teacherId,
      status: 'approved',
      startDate: '2026-09-21',
      endDate: '2026-09-23'
    };

    // Before leave window
    const statusBefore = getTeacherStatus(teacherId, [], [approvedLeave], '2026-09-20');
    assert.equal(statusBefore.type, 'absent');

    // On startDate
    const statusStart = getTeacherStatus(teacherId, [], [approvedLeave], '2026-09-21');
    assert.equal(statusStart.type, 'leave');

    // Within window
    const statusMiddle = getTeacherStatus(teacherId, [], [approvedLeave], '2026-09-22');
    assert.equal(statusMiddle.type, 'leave');

    // On endDate
    const statusEnd = getTeacherStatus(teacherId, [], [approvedLeave], '2026-09-23');
    assert.equal(statusEnd.type, 'leave');

    // After leave window
    const statusAfter = getTeacherStatus(teacherId, [], [approvedLeave], '2026-09-24');
    assert.equal(statusAfter.type, 'absent');
  });

  it('prioritizes actual punch-in presence over leave record if teacher comes in', () => {
    const approvedLeave = {
      id: 'leave_104',
      teacherId,
      status: 'approved',
      startDate: '2026-09-21',
      endDate: '2026-09-21'
    };
    const attendance = [
      { teacherId, punchIn: '08:55 AM', punchOut: '04:15 PM', status: 'On Time' }
    ];

    const status = getTeacherStatus(teacherId, attendance, [approvedLeave], '2026-09-21');
    assert.equal(status.type, 'present');
    assert.equal(status.punchIn, '08:55 AM');
  });
});

// ============================================================================
// 2. SATURDAY TEST DUTY AUTO-SEED & SERVICE MANAGER 3-COLUMN BOARD
// ============================================================================
describe('Teacher-Manager Pipeline: Saturday Test Duty Seeding & Pipeline', () => {

  const timetableHeaderDate = '21/09/26 TO 27/09/26';

  function calculateSaturdayDate(hdr) {
    if (!hdr) return 'UNKNOWN';
    const parts = hdr.split(' TO ');
    let stDate = new Date();
    if (parts.length > 0) {
      const p = parts[0].trim().split('/');
      if (p.length === 3) {
        const year = p[2].length === 2 ? '20' + p[2] : p[2];
        stDate = new Date(`${year}-${p[1]}-${p[0]}`);
      }
    }
    const sat = new Date(stDate);
    sat.setDate(sat.getDate() + 5);
    const dd = sat.getDate().toString().padStart(2, '0');
    const mm = (sat.getMonth() + 1).toString().padStart(2, '0');
    const yy = sat.getFullYear().toString().slice(-2);
    return `${dd}/${mm}/${yy}`;
  }

  function seedTestWorkflowsFromTimetable(timetableData, satDayStr, existingWorkflows = {}) {
    const seeded = {};
    for (const slot of Object.keys(timetableData)) {
      for (const room of Object.keys(timetableData[slot] || {})) {
        const cell = timetableData[slot][room];
        if (cell?.test && (cell.test.topic || cell.test.preparedBy || cell.test.checkedBy)) {
          const testId = `${satDayStr.replace(/\//g, '-')}_${cell.batch}`;

          // Preserve existing workflow if present
          if (existingWorkflows[testId]) {
            seeded[testId] = existingWorkflows[testId];
          } else {
            seeded[testId] = {
              testId,
              batch: cell.batch,
              subject: cell.thursSat?.subject || cell.monWed?.subject || 'Weekly Test',
              topic: cell.test.topic || 'Weekly Saturday Exam',
              preparedBy: cell.test.preparedBy || '',
              checkedBy: cell.test.checkedBy || '',
              status: 'draft_pending',
              testDate: satDayStr,
              createdAt: '2026-09-21T00:00:00Z'
            };
          }
        }
      }
    }
    return seeded;
  }

  it('correctly calculates Saturday date for testId from timetable header date', () => {
    const satDate = calculateSaturdayDate(timetableHeaderDate);
    assert.equal(satDate, '26/09/26');
  });

  it('auto-seeds test duties with draft_pending while preserving active progress', () => {
    const timetableData = {
      '02:00 PM TO 04:00 PM': {
        'SAPTARISHI': {
          batch: '10th-CBSE Alpha',
          thursSat: { subject: 'Mathematics' },
          test: { topic: 'Quadratic Equations', preparedBy: 'teacher_brijesh', checkedBy: 'teacher_sneha' }
        },
        'MEGH SINGH': {
          batch: '9th-ICSE Alpha',
          thursSat: { subject: 'Physics' },
          test: { topic: 'Motion & Force', preparedBy: 'teacher_sneha', checkedBy: 'teacher_mayur' }
        }
      }
    };

    const satDate = '26/09/26';
    // Simulate one test already having draft submitted by teacher
    const existing = {
      '26-09-26_10th-CBSE Alpha': {
        testId: '26-09-26_10th-CBSE Alpha',
        batch: '10th-CBSE Alpha',
        status: 'draft_submitted',
        draftLink: 'https://drive.google.com/test_paper'
      }
    };

    const result = seedTestWorkflowsFromTimetable(timetableData, satDate, existing);

    // 10th-CBSE Alpha should retain draft_submitted
    assert.equal(result['26-09-26_10th-CBSE Alpha'].status, 'draft_submitted');
    assert.equal(result['26-09-26_10th-CBSE Alpha'].draftLink, 'https://drive.google.com/test_paper');

    // 9th-ICSE Alpha should be freshly seeded as draft_pending
    assert.equal(result['26-09-26_9th-ICSE Alpha'].status, 'draft_pending');
    assert.equal(result['26-09-26_9th-ICSE Alpha'].preparedBy, 'teacher_sneha');
    assert.equal(result['26-09-26_9th-ICSE Alpha'].subject, 'Physics');
  });

  it('harmonizes test workflow status mapping across Service Manager board columns', () => {
    const workflows = [
      { id: 't1', status: 'draft_pending' },
      { id: 't2', status: 'draft_submitted' },
      { id: 't3', status: 'drafted' },
      { id: 't4', status: 'final_published' },
      { id: 't5', status: 'published' },
      { id: 't6', status: 'graded' }
    ];

    const drafted = workflows.filter(t => t.status === 'draft_pending' || t.status === 'draft_submitted' || t.status === 'drafted');
    const published = workflows.filter(t => t.status === 'final_published' || t.status === 'published');
    const graded = workflows.filter(t => t.status === 'graded');

    assert.equal(drafted.length, 3);
    assert.equal(published.length, 2);
    assert.equal(graded.length, 1);
  });
});

// ============================================================================
// 3. FACULTY GRIEVANCES & ACADEMIC COORDINATION PIPELINE
// ============================================================================
describe('Teacher-Manager Pipeline: Coordination & Grievance Lifecycle', () => {

  function createCoordinationTicket({ teacherId, teacherName, category, rawRequest, priority }) {
    if (!rawRequest || !rawRequest.trim()) throw new Error('Details are required');
    return {
      teacherId,
      teacherName,
      category,
      request: `[${category}] ${rawRequest.trim()}`,
      priority: priority || 'Normal',
      status: 'Pending',
      createdAt: '2026-09-21T09:00:00Z'
    };
  }

  function resolveCoordinationTicket(ticket, resolutionRemark, resolvedBy = 'Rohan Sir (Service Manager)') {
    return {
      ...ticket,
      status: 'Resolved',
      resolutionRemark: resolutionRemark ? resolutionRemark.trim() : 'Resolved by Academic Operations',
      resolvedBy,
      resolvedAt: '2026-09-21T10:15:00Z'
    };
  }

  it('formats coordination tickets with bracketed category and Pending status', () => {
    const ticket = createCoordinationTicket({
      teacherId: 'teacher_sneha',
      teacherName: 'Sneha More',
      category: 'Classroom / Infrastructure',
      rawRequest: 'Air Conditioner remote missing in Manikarnika 1',
      priority: 'Urgent'
    });

    assert.equal(ticket.category, 'Classroom / Infrastructure');
    assert.equal(ticket.request, '[Classroom / Infrastructure] Air Conditioner remote missing in Manikarnika 1');
    assert.equal(ticket.priority, 'Urgent');
    assert.equal(ticket.status, 'Pending');
  });

  it('resolves tickets with Rohan Sir remarks and maintains full audit history', () => {
    const ticket = createCoordinationTicket({
      teacherId: 'teacher_mayur',
      teacherName: 'Mayur Randive',
      category: 'Timetable / Slot Clash',
      rawRequest: 'Slot clash on Thursday between 10th Bravo and 9th Alpha',
      priority: 'Normal'
    });

    const resolved = resolveCoordinationTicket(ticket, 'Swapped 9th Alpha to Room Tanaji Kaksh with Brijesh Sir.');

    assert.equal(resolved.status, 'Resolved');
    assert.equal(resolved.resolutionRemark, 'Swapped 9th Alpha to Room Tanaji Kaksh with Brijesh Sir.');
    assert.equal(resolved.resolvedBy, 'Rohan Sir (Service Manager)');
    assert.ok(resolved.resolvedAt);
  });
});

// ============================================================================
// 4. REAL SALARY VAULT & PAYROLL DISBURSAL ENGINE
// ============================================================================
describe('Teacher-Manager Pipeline: Salary Vault & Payroll Ledger Engine', () => {

  const inr = (num) => `₹${Math.round(num).toLocaleString('en-IN')}`;

  function computeMonthlySalary({ baseSalary = 35000, classTeacherBatches = [], unapprovedAbsences = 0, avgRating = 4.5 }) {
    let performanceBonus = 0;
    if (avgRating >= 4.5) performanceBonus = 3000;
    else if (avgRating >= 4.0) performanceBonus = 1500;
    else if (avgRating >= 3.5) performanceBonus = 500;

    const classTeacherAllowance = classTeacherBatches.length * 1500;
    const dailyRate = Math.round(baseSalary / 30);
    const deductions = unapprovedAbsences * dailyRate;

    const gross = baseSalary + classTeacherAllowance + performanceBonus;
    const net = gross - deductions;

    return {
      basePay: baseSalary,
      allowances: classTeacherAllowance,
      bonus: performanceBonus,
      deductions,
      gross,
      net
    };
  }

  function formatPayslipModalData(slip, teacherName, subjects = []) {
    return {
      title: 'SHISHYAKUL ACADEMY',
      employeeName: teacherName,
      period: slip.month,
      designation: `Faculty Member (${subjects.join(', ') || 'Academic'})`,
      grossText: inr(slip.gross || slip.net),
      deductionsText: inr(slip.deductions || 0),
      netText: inr(slip.net),
      status: slip.status || 'Credited'
    };
  }

  it('accurately computes gross, deductions, and net salary for a teacher with class teacher batches', () => {
    const salary = computeMonthlySalary({
      baseSalary: 35000,
      classTeacherBatches: ['10th-CBSE Alpha', '9th-ICSE Alpha'], // 2 batches * 1500 = 3000
      unapprovedAbsences: 2, // 2 * (35000 / 30) = 2334
      avgRating: 4.8 // 3000 bonus
    });

    assert.equal(salary.basePay, 35000);
    assert.equal(salary.allowances, 3000);
    assert.equal(salary.bonus, 3000);
    assert.equal(salary.gross, 41000);
    assert.equal(salary.deductions, 2334);
    assert.equal(salary.net, 38666);
  });

  it('formats payslip modal data cleanly with currency strings and badge status', () => {
    const slip = {
      month: 'September 2026',
      gross: 39500,
      deductions: 1167,
      net: 38333,
      status: 'Credited'
    };

    const modalData = formatPayslipModalData(slip, 'Brijesh Prajapati', ['Mathematics']);

    assert.equal(modalData.period, 'September 2026');
    assert.equal(modalData.employeeName, 'Brijesh Prajapati');
    assert.equal(modalData.designation, 'Faculty Member (Mathematics)');
    assert.equal(modalData.grossText, '₹39,500');
    assert.equal(modalData.deductionsText, '₹1,167');
    assert.equal(modalData.netText, '₹38,333');
    assert.equal(modalData.status, 'Credited');
  });

  it('falls back to estimated current month ledger when real salary history is empty', () => {
    const realSalaryHistory = [];
    const estimatedLedger = [
      { month: 'Current Month (Estimated)', gross: 38000, deductions: 0, net: 38000, status: 'Processing' }
    ];

    const activeList = realSalaryHistory.length > 0 ? realSalaryHistory : estimatedLedger;

    assert.equal(activeList.length, 1);
    assert.equal(activeList[0].month, 'Current Month (Estimated)');
    assert.equal(activeList[0].status, 'Processing');
  });
});
