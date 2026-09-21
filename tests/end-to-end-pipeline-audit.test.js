import test from 'node:test';
import assert from 'node:assert/strict';

test('End-to-End Pipeline Audit: Manager -> Teacher -> Student Unified Ecosystem', async (t) => {

  // Simulated Database State
  const db = {
    timetables: {},
    test_workflows: {},
    lecture_reports: [],
    submissions: [],
    students: {},
    attendance: [],
    student_communications: [],
    test_marks: [],
    school_test_marks: [],
    leave_requests: [],
    faculty_grievances: [],
    salary_history: [],
    teacher_attendance: []
  };

  // Setup Core Entities
  const rohanServiceManager = { id: 'sm-rohan', role: 'service_manager', name: 'Rohan (Service Manager)' };
  const sumitAdmin = { id: 'admin-sumit', role: 'admin', name: 'Sumit (Admin)' };
  const shrutiFrontDesk = { id: 'fd-shruti', role: 'front_desk_manager', name: 'Shruti (Front Desk)' };
  const brijeshTeacher = {
    id: 'teacher-brijesh',
    uid: 'teacher-brijesh',
    role: 'teacher',
    fullName: 'Brijesh Prajapati',
    email: 'brijesh@shishyakul.com',
    subjects: ['Mathematics'],
    assignedBatches: ['10th-CBSE Alpha'],
    classTeacherBatch: ['10th-CBSE Alpha']
  };
  const himanshuStudent = {
    id: 'stu-himanshu',
    studentId: 'stu-himanshu',
    studentName: 'Himanshu Vishwakarma',
    fullName: 'Himanshu Vishwakarma',
    emailId: 'himanshu@shishyakul.com',
    batch: '10th-CBSE Alpha',
    status: 'admitted',
    totalFees: 60000,
    installments: 3,
    paidInstallments: [1] // 20000 paid
  };
  db.students[himanshuStudent.id] = { ...himanshuStudent };

  // =========================================================================
  // PIPELINE 1: Service Manager Timetable -> Teacher Schedule -> Student Timetable
  // =========================================================================
  await t.test('Pipeline 1: Service Manager Master Timetable Broadcast', () => {
    // Rohan publishes timetable
    db.timetables['master'] = {
      headerDate: '21/09/26 TO 27/09/26',
      schedule: {
        '10th-CBSE Alpha': {
          'MON': {
            '02:00 PM TO 04:00 PM': { subject: 'Mathematics', teacher: 'Brijesh Prajapati', room: 'SAPTARISHI' }
          },
          'SAT': {
            '02:00 PM TO 04:00 PM': { test: 'Weekly Test 12', syllabus: 'Quadratic Equations', subject: 'Mathematics', room: 'SAPTARISHI' }
          }
        }
      }
    };

    // Auto-seed test duties from timetable
    const schedule = db.timetables['master'].schedule;
    Object.entries(schedule).forEach(([batch, days]) => {
      if (days['SAT']) {
        Object.entries(days['SAT']).forEach(([slot, cell]) => {
          if (cell.test) {
            const testId = `26-09-26_${batch.replace(/\s+/g, '_')}`;
            db.test_workflows[testId] = {
              batch,
              testName: cell.test,
              subject: cell.subject,
              syllabus: cell.syllabus,
              status: 'draft_pending',
              slot,
              room: cell.room
            };
          }
        });
      }
    });

    // 1. Verify Manager state
    assert.ok(db.timetables['master'].schedule['10th-CBSE Alpha']['MON']);
    assert.equal(db.test_workflows['26-09-26_10th-CBSE_Alpha'].status, 'draft_pending');

    // 2. Verify Teacher schedule projection
    const teacherMonSlot = db.timetables['master'].schedule['10th-CBSE Alpha']['MON']['02:00 PM TO 04:00 PM'];
    assert.equal(teacherMonSlot.teacher, 'Brijesh Prajapati');
    assert.equal(teacherMonSlot.subject, 'Mathematics');

    // 3. Verify Student sees the exact timetable
    const studentSchedule = db.timetables['master'].schedule[himanshuStudent.batch];
    assert.ok(studentSchedule);
    assert.equal(studentSchedule['MON']['02:00 PM TO 04:00 PM'].subject, 'Mathematics');
  });

  // =========================================================================
  // PIPELINE 2: Teacher Lecture Report & Homework -> Student Submission -> Teacher Grading
  // =========================================================================
  await t.test('Pipeline 2: Lecture Report & Homework Cycle', () => {
    // 1. Teacher submits post-lecture report
    const lectureReport = {
      id: 'lr-101',
      teacherId: brijeshTeacher.id,
      teacherName: brijeshTeacher.fullName,
      batch: '10th-CBSE Alpha',
      subject: 'Mathematics',
      topicTaught: 'Quadratic Equations Ex 4.2',
      amountTaught: '3 pages / 6 problems',
      homework: 'Complete Questions 5 to 10 in HW notebook',
      nextTarget: 'Nature of Roots and Discriminant',
      date: '2026-09-21',
      timestamp: { seconds: 1774260000 }
    };
    db.lecture_reports.push(lectureReport);

    // 2. Student views recent taught & homework
    const studentLectureReports = db.lecture_reports.filter(r => r.batch === himanshuStudent.batch);
    assert.equal(studentLectureReports.length, 1);
    assert.equal(studentLectureReports[0].topicTaught, 'Quadratic Equations Ex 4.2');
    assert.equal(studentLectureReports[0].homework, 'Complete Questions 5 to 10 in HW notebook');

    // 3. Student submits homework
    const studentSubmission = {
      id: 'sub-201',
      assignmentId: lectureReport.id,
      assignmentTitle: 'Quadratic Equations Ex 4.2',
      batch: himanshuStudent.batch,
      studentId: himanshuStudent.id,
      studentName: himanshuStudent.fullName,
      studentEmail: himanshuStudent.emailId,
      driveLink: 'https://drive.google.com/file/d/himanshu_hw_math_4_2/view',
      status: 'pending',
      marks: null,
      remarks: null,
      submittedAt: '2026-09-21T14:30:00.000Z'
    };
    db.submissions.push(studentSubmission);

    // 4. Teacher views submission tray and grades it
    const teacherPendingSubmissions = db.submissions.filter(s => s.batch === '10th-CBSE Alpha' && s.status === 'pending');
    assert.equal(teacherPendingSubmissions.length, 1);

    // Teacher grades the work
    const gradedSub = {
      ...teacherPendingSubmissions[0],
      status: 'graded',
      marks: 9.5,
      maxMarks: 10,
      remarks: 'Excellent stepwise working and neat diagrams!',
      gradedBy: brijeshTeacher.fullName,
      gradedAt: '2026-09-21T15:00:00.000Z'
    };
    db.submissions[0] = gradedSub;

    // 5. Student views graded result in portal
    const studentViewSub = db.submissions.find(s => s.studentId === himanshuStudent.id);
    assert.equal(studentViewSub.status, 'graded');
    assert.equal(studentViewSub.marks, 9.5);
    assert.equal(studentViewSub.remarks, 'Excellent stepwise working and neat diagrams!');
  });

  // =========================================================================
  // PIPELINE 3: Front Desk Daily Attendance & Extra Lecture (Self-Study)
  // =========================================================================
  await t.test('Pipeline 3: Attendance & Self-Study Logging', () => {
    // 1. Front Desk marks daily regular class attendance
    const dailyAtt = {
      id: 'att-2026-09-21_10th',
      batch: '10th-CBSE Alpha',
      date: '2026-09-21',
      sessionType: 'Regular Class',
      absenteeIds: [], // Himanshu is present
      lateStudents: {},
      totalStudents: 15,
      absentCount: 0
    };
    db.attendance.push(dailyAtt);

    // 2. Front Desk marks extra self-study session with in-out time and log
    const selfStudyAtt = {
      id: 'att-self-study-2026-09-21',
      batch: '10th-CBSE Alpha',
      date: '2026-09-21',
      sessionType: 'Self-Study',
      inOutTimes: {
        'stu-himanshu': { inTime: '04:15 PM', outTime: '06:45 PM' }
      },
      selfStudyLogs: {
        'stu-himanshu': {
          subject: 'Mathematics',
          topicsCovered: 'Quadratic equations discriminant revision',
          teacherScore: 9
        }
      }
    };
    db.attendance.push(selfStudyAtt);

    // 3. Student attendance resolution
    const studentRecords = db.attendance.map(a => {
      const isAbsent = a.absenteeIds?.includes(himanshuStudent.id);
      const late = a.lateStudents?.[himanshuStudent.id];
      const selfStudy = a.selfStudyLogs?.[himanshuStudent.id];
      const inOut = a.inOutTimes?.[himanshuStudent.id];
      return {
        date: a.date,
        sessionType: a.sessionType,
        status: isAbsent ? 'Absent' : 'Present',
        selfStudy,
        inOut
      };
    });

    assert.equal(studentRecords.length, 2);
    assert.equal(studentRecords[0].status, 'Present');
    assert.equal(studentRecords[1].sessionType, 'Self-Study');
    assert.equal(studentRecords[1].inOut.inTime, '04:15 PM');
    assert.equal(studentRecords[1].selfStudy.teacherScore, 9);
  });

  // =========================================================================
  // PIPELINE 4: Admin Fee Installments -> Student Ledger
  // =========================================================================
  await t.test('Pipeline 4: Financial Ledger Calculation & Installments', () => {
    const student = db.students['stu-himanshu'];
    const totalFees = student.totalFees || 0;
    const installmentsCount = student.installments || 1;
    const installmentAmount = Math.round(totalFees / installmentsCount);
    const paidInstallments = student.paidInstallments || [];
    const totalPaid = installmentAmount * paidInstallments.length;
    const pendingBalance = totalFees - totalPaid;

    assert.equal(totalFees, 60000);
    assert.equal(installmentAmount, 20000);
    assert.equal(totalPaid, 20000);
    assert.equal(pendingBalance, 40000);

    // Admin marks installment 2 paid
    student.paidInstallments.push(2);
    const newTotalPaid = installmentAmount * student.paidInstallments.length;
    const newPendingBalance = totalFees - newTotalPaid;
    assert.equal(newTotalPaid, 40000);
    assert.equal(newPendingBalance, 20000);
  });

  // =========================================================================
  // PIPELINE 5: Test Series (Weekly, Class Surprise, School Exam) Dual-Write
  // =========================================================================
  await t.test('Pipeline 5: 3-Category Test Series Dual-Write & Analytics', () => {
    // 1. Weekly Saturday Test Upload
    const weeklyTestMark = {
      id: 'tm-sat-12',
      batch: '10th-CBSE Alpha',
      testType: 'Weekly Test',
      testId: '26-09-26_10th-CBSE_Alpha',
      testDate: '2026-09-26',
      subject: 'Mathematics',
      maxMarks: 50,
      marks: {
        'stu-himanshu': 46
      },
      uploadedBy: brijeshTeacher.id
    };
    db.test_marks.push(weeklyTestMark);

    // Dual-write into student doc testHistory
    if (!db.students['stu-himanshu'].testHistory) db.students['stu-himanshu'].testHistory = [];
    db.students['stu-himanshu'].testHistory.push({
      testId: weeklyTestMark.testId,
      date: weeklyTestMark.testDate,
      subject: weeklyTestMark.subject,
      testType: weeklyTestMark.testType,
      marks: 46,
      maxMarks: 50,
      percentage: ((46 / 50) * 100).toFixed(1)
    });

    // 2. Class Surprise Test
    const surpriseTest = {
      id: 'tm-surp-1',
      batch: '10th-CBSE Alpha',
      testType: 'Class Surprise Test',
      testDate: '2026-09-22',
      subject: 'Mathematics',
      maxMarks: 20,
      marks: { 'stu-himanshu': 19 },
      uploadedBy: brijeshTeacher.id
    };
    db.test_marks.push(surpriseTest);
    db.students['stu-himanshu'].testHistory.push({
      testId: 'tm-surp-1',
      date: surpriseTest.testDate,
      subject: surpriseTest.subject,
      testType: surpriseTest.testType,
      marks: 19,
      maxMarks: 20,
      percentage: '95.0'
    });

    // 3. Official School Exam (Term 1)
    const schoolExam = {
      id: 'sch-term1-himanshu',
      batch: '10th-CBSE Alpha',
      studentId: himanshuStudent.id,
      studentName: himanshuStudent.fullName,
      testType: 'Term 1 Exam',
      createdAt: '2026-09-20T10:00:00.000Z',
      marks: {
        Mathematics: { obtained: 76, max: 80 },
        Science: { obtained: 74, max: 80 },
        English: { obtained: 70, max: 80 }
      }
    };
    db.school_test_marks.push(schoolExam);

    // Verify all 3 categories resolve in student portfolio
    const studentHistory = db.students['stu-himanshu'].testHistory;
    assert.equal(studentHistory.length, 2);
    assert.equal(studentHistory[0].testType, 'Weekly Test');
    assert.equal(studentHistory[0].percentage, '92.0');
    assert.equal(studentHistory[1].testType, 'Class Surprise Test');

    const schoolExams = db.school_test_marks.filter(s => s.studentId === himanshuStudent.id);
    assert.equal(schoolExams.length, 1);
    assert.equal(schoolExams[0].marks.Mathematics.obtained, 76);
  });

  // =========================================================================
  // PIPELINE 6: Teacher Leave Request -> Manager Approval -> Auto-Presence
  // =========================================================================
  await t.test('Pipeline 6: Faculty Leave & Floorboard Auto-Presence', () => {
    // 1. Teacher applies for leave
    const leaveReq = {
      id: 'leave-101',
      teacherId: brijeshTeacher.id,
      teacherName: brijeshTeacher.fullName,
      type: 'summer',
      startDate: '2026-09-25',
      endDate: '2026-09-27',
      totalDays: 3,
      reason: 'Family wedding event',
      status: 'pending'
    };
    db.leave_requests.push(leaveReq);

    // 2. Service Manager approves
    const targetReq = db.leave_requests.find(r => r.id === 'leave-101');
    targetReq.status = 'approved';
    targetReq.reviewedBy = rohanServiceManager.name;
    targetReq.reviewedAt = new Date().toISOString();
    targetReq.reviewRemarks = 'Approved. Alternate arrangement made.';

    // 3. Verify presence on 2026-09-26 (within leave window)
    const checkDate = '2026-09-26';
    const hasPunch = db.teacher_attendance.some(a => a.teacherId === brijeshTeacher.id && a.date === checkDate);
    const hasApprovedLeave = db.leave_requests.some(
      r => r.teacherId === brijeshTeacher.id && r.status === 'approved' && checkDate >= r.startDate && checkDate <= r.endDate
    );

    let presenceStatus = 'absent';
    if (hasPunch) presenceStatus = 'present';
    else if (hasApprovedLeave) presenceStatus = 'leave';

    assert.equal(presenceStatus, 'leave');
  });

  // =========================================================================
  // PIPELINE 7: Academic Coordination / Grievance Ticket Resolution
  // =========================================================================
  await t.test('Pipeline 7: Coordination Ticket Lifecycle', () => {
    // 1. Teacher creates coordination ticket
    const ticket = {
      id: 'griev-301',
      teacherId: brijeshTeacher.id,
      teacherName: brijeshTeacher.fullName,
      request: '[Classroom / Infrastructure] Projector HDMI cable in SAPTARISHI kaksh is faulty.',
      priority: 'High',
      status: 'Pending',
      timestamp: { seconds: 1774261000 }
    };
    db.faculty_grievances.push(ticket);

    // 2. Rohan Sir resolves ticket
    const targetTicket = db.faculty_grievances.find(g => g.id === 'griev-301');
    targetTicket.status = 'Resolved';
    targetTicket.resolution = 'Replaced with a brand new gold-plated 4K HDMI cable and tested.';
    targetTicket.resolvedAt = new Date().toISOString();
    targetTicket.resolvedBy = rohanServiceManager.name;

    // 3. Verify Teacher view
    assert.equal(targetTicket.status, 'Resolved');
    assert.equal(targetTicket.resolvedBy, 'Rohan (Service Manager)');
    assert.ok(targetTicket.resolution.includes('brand new gold-plated'));
  });

  // =========================================================================
  // PIPELINE 8: Admin Monthly Payroll Timesheet Sync -> Teacher Salary Vault
  // =========================================================================
  await t.test('Pipeline 8: Payroll Sync & Salary Vault Payslip', () => {
    // 1. Admin syncs monthly payroll for September 2026
    const payslip = {
      id: 'sal-2026-09_teacher-brijesh',
      teacherId: brijeshTeacher.id,
      teacherName: brijeshTeacher.fullName,
      month: 'September 2026',
      monthCode: '2026-09',
      basePay: 45000,
      allowances: { classTeacherBonus: 2500, travelAllowance: 1000 },
      deductions: { leaveDeduction: 0, professionalTax: 200, tds: 500 },
      netPayable: 47800,
      paymentStatus: 'Processed',
      paidOn: '2026-09-30',
      syncedAt: new Date().toISOString()
    };
    db.salary_history.push(payslip);

    // 2. Verify Teacher Salary Vault projection
    const teacherSalaryRecords = db.salary_history.filter(s => s.teacherId === brijeshTeacher.id);
    assert.equal(teacherSalaryRecords.length, 1);
    assert.equal(teacherSalaryRecords[0].netPayable, 47800);
    assert.equal(teacherSalaryRecords[0].paymentStatus, 'Processed');
    assert.equal(teacherSalaryRecords[0].allowances.classTeacherBonus, 2500);
  });

});
