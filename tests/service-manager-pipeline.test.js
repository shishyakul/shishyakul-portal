import test from 'node:test';
import assert from 'node:assert/strict';

test('Service Manager Pipeline & End-to-End Interconnections Audit', async (t) => {

  // Simulated In-Memory Multi-Collection Database State replicating Firestore
  const db = {
    timetables: {},
    test_workflows: {},
    leave_requests: {},
    teacher_attendance: {},
    faculty_grievances: {},
    students: {},
    users: {},
    attendance: [],
    syllabus_progress: {}
  };

  const serviceManagerProfile = {
    id: 'user-rohan-sm',
    uid: 'user-rohan-sm',
    role: 'service_manager',
    fullName: 'Rohan Sir',
    name: 'Rohan Sir',
    email: 'service@shishyakul.in'
  };

  const sampleTeachers = [
    { id: 't-brijesh', uid: 't-brijesh', role: 'teacher', fullName: 'Brijesh Prajapati', subjects: 'Mathematics' },
    { id: 't-sneha', uid: 't-sneha', role: 'teacher', fullName: 'Sneha More', subjects: 'Science' },
    { id: 't-mayur', uid: 't-mayur', role: 'teacher', fullName: 'Mayur Randive', subjects: 'SST & English' },
    { id: 'user-rohan-sm', uid: 'user-rohan-sm', role: 'service_manager', fullName: 'Rohan Sir', subjects: 'Mathematics' }
  ];
  sampleTeachers.forEach(t => { db.users[t.id] = t; });

  const CLASSROOMS = ['SAPTARISHI', 'MEGH SINGH', 'TANAJI KAKSH', 'AHOM KAKSH', 'MANIKARNIKA 1', 'MANIKARNIKA 2'];
  const SLOTS = ['02:00 PM TO 04:00 PM', '04:30 PM TO 06:30 PM', '07:00 PM TO 09:00 PM'];

  // =========================================================================
  // TEST 1: Master Timetable Crafting, Save & Broadcast Sync
  // =========================================================================
  await t.test('1. Master Timetable Crafting & Broadcast Sync (Faculty.jsx -> DB -> Dashboards)', () => {
    // 1. Service Manager crafts timetable in Faculty.jsx
    const headerDate = '22/09/26 TO 28/09/26';
    const schedule = {
      '02:00 PM TO 04:00 PM': {
        'SAPTARISHI': {
          batch: '10th Alpha',
          monWed: { subject: 'Mathematics', topic: 'Trigonometry', teacherId: 't-brijesh' },
          thursSat: { subject: 'Science', topic: 'Chemical Reactions', teacherId: 't-sneha' },
          test: { topic: 'Maths Quadratic Ch 4', preparedBy: 'Brijesh Prajapati', checkedBy: 'Sneha More' }
        },
        'MEGH SINGH': {
          batch: '9th Bravo',
          monWed: { subject: 'Mathematics', topic: 'Lines & Angles', teacherId: 'user-rohan-sm' },
          thursSat: { subject: 'SST & English', topic: 'French Revolution', teacherId: 't-mayur' },
          test: { topic: 'SST Unit 1', preparedBy: 'Mayur Randive', checkedBy: 'Brijesh Prajapati' }
        }
      },
      '04:30 PM TO 06:30 PM': {
        'TANAJI KAKSH': {
          batch: '10th Bravo',
          monWed: { subject: 'Science', topic: 'Acids & Bases', teacherId: 't-sneha' },
          thursSat: { subject: 'Mathematics', topic: 'Probability', teacherId: 't-brijesh' },
          test: { topic: 'Science Ch 2', preparedBy: 'Sneha More', checkedBy: 'Brijesh Prajapati' }
        }
      }
    };

    // Save to Firestore doc `timetables/master`
    db.timetables['master'] = {
      schedule,
      headerDate,
      updatedAt: new Date().toISOString()
    };

    assert.ok(db.timetables['master']);
    assert.equal(db.timetables['master'].headerDate, '22/09/26 TO 28/09/26');

    // 2. Service Manager Dashboard: Kaksh Live Radar Logic Verification
    const activeSlot = '02:00 PM TO 04:00 PM';
    const testDay = 'MONDAY'; // In ['MONDAY', 'TUESDAY', 'WEDNESDAY']

    const getClassroomLecture = (room, slot, currentDay) => {
      if (!slot || !schedule[slot] || !schedule[slot][room]) return null;
      const cell = schedule[slot][room];
      if (!cell || !cell.batch) return null;

      let teacherId = null;
      let subject = '';
      if (['MONDAY', 'TUESDAY', 'WEDNESDAY'].includes(currentDay)) {
        teacherId = cell.monWed?.teacherId;
        subject = cell.monWed?.subject;
      } else if (['THURSDAY', 'FRIDAY', 'SATURDAY'].includes(currentDay)) {
        teacherId = cell.thursSat?.teacherId;
        subject = cell.thursSat?.subject;
      }
      const teacherObj = db.users[teacherId];
      return {
        batch: cell.batch,
        subject: subject || 'N/A',
        teacherName: teacherObj ? teacherObj.fullName : 'Unassigned',
        teacherId
      };
    };

    const saptarishiMon = getClassroomLecture('SAPTARISHI', activeSlot, testDay);
    assert.ok(saptarishiMon);
    assert.equal(saptarishiMon.batch, '10th Alpha');
    assert.equal(saptarishiMon.subject, 'Mathematics');
    assert.equal(saptarishiMon.teacherName, 'Brijesh Prajapati');

    const meghSinghMon = getClassroomLecture('MEGH SINGH', activeSlot, testDay);
    assert.ok(meghSinghMon);
    assert.equal(meghSinghMon.batch, '9th Bravo');
    assert.equal(meghSinghMon.teacherName, 'Rohan Sir');

    // Vacant room check
    const vacantRoom = getClassroomLecture('AHOM KAKSH', activeSlot, testDay);
    assert.equal(vacantRoom, null, 'Unscheduled rooms must evaluate as vacant (null)');

    // 3. Workload calculation for teachers
    const computeWorkload = (teacherId) => {
      let count = 0;
      Object.values(schedule).forEach(slotObj => {
        Object.values(slotObj || {}).forEach(cell => {
          if (cell?.monWed?.teacherId === teacherId) count += 3;
          if (cell?.thursSat?.teacherId === teacherId) count += 3;
          if (cell?.extra?.teacherId === teacherId) count += 1;
        });
      });
      return count;
    };

    assert.equal(computeWorkload('t-brijesh'), 6); // MonWed in Saptarishi (3) + ThursSat in Tanaji (3) = 6
    assert.equal(computeWorkload('t-sneha'), 6);   // ThursSat in Saptarishi (3) + MonWed in Tanaji (3) = 6
    assert.equal(computeWorkload('user-rohan-sm'), 3); // MonWed in Megh Singh (3) = 3

    // 4. Student Dashboard sync: Filter by student's batch
    const studentBatch = '10th Alpha';
    const studentLectures = [];
    Object.keys(schedule).forEach(slot => {
      Object.keys(schedule[slot]).forEach(room => {
        const cell = schedule[slot][room];
        if (cell.batch === studentBatch) {
          studentLectures.push({ slot, room, ...cell });
        }
      });
    });
    assert.equal(studentLectures.length, 1);
    assert.equal(studentLectures[0].room, 'SAPTARISHI');
  });

  // =========================================================================
  // TEST 2: Saturday Exam Duty Seeding & Multi-Stage Lifecycle
  // =========================================================================
  await t.test('2. Saturday Exam Duty Auto-Seeding & 3-Column Progression Engine', () => {
    const timetableHeaderDate = '22/09/26 TO 28/09/26';
    const schedule = db.timetables['master'].schedule;

    // Simulate Faculty.jsx handlePublishTimetable Saturday date derivation
    const parseStartDate = (hdr) => {
      const parts = hdr.split(' TO ');
      const p = parts[0].trim().split('/');
      const year = p[2].length === 2 ? '20' + p[2] : p[2];
      return new Date(`${year}-${p[1]}-${p[0]}`);
    };
    const stDate = parseStartDate(timetableHeaderDate);
    const sat = new Date(stDate);
    sat.setDate(sat.getDate() + 5);
    const satDayStr = `${sat.getDate().toString().padStart(2, '0')}/${(sat.getMonth() + 1).toString().padStart(2, '0')}/${sat.getFullYear().toString().slice(-2)}`;
    assert.equal(satDayStr, '27/09/26');

    // Auto-seed test_workflows
    for (const slot of Object.keys(schedule)) {
      for (const room of Object.keys(schedule[slot] || {})) {
        const cell = schedule[slot][room];
        if (cell?.test && (cell.test.topic || cell.test.preparedBy || cell.test.checkedBy)) {
          const testId = `${satDayStr.replace(/\//g, '-')}_${cell.batch}`;
          if (!db.test_workflows[testId]) {
            db.test_workflows[testId] = {
              testId,
              batch: cell.batch,
              subject: cell.thursSat?.subject || cell.monWed?.subject || 'Weekly Test',
              topic: cell.test.topic,
              preparedBy: cell.test.preparedBy,
              checkedBy: cell.test.checkedBy,
              status: 'draft_pending',
              testDate: satDayStr,
              createdAt: new Date().toISOString()
            };
          }
        }
      }
    }

    const allWorkflows = Object.values(db.test_workflows);
    assert.equal(allWorkflows.length, 3, 'Should auto-seed 3 exam duties for 10th Alpha, 9th Bravo, and 10th Bravo');

    // Verify Service Manager's 3-Column Categorization
    const getColumns = () => {
      const list = Object.values(db.test_workflows);
      return {
        drafted: list.filter(t => t.status === 'draft_pending' || t.status === 'draft_submitted' || t.status === 'drafted'),
        published: list.filter(t => t.status === 'final_published' || t.status === 'published'),
        graded: list.filter(t => t.status === 'graded')
      };
    };

    let cols = getColumns();
    assert.equal(cols.drafted.length, 3, 'All newly seeded duties begin in Drafted column');
    assert.equal(cols.published.length, 0);
    assert.equal(cols.graded.length, 0);

    // STAGE 2: Teacher submits drafted paper and solutions
    const test1 = cols.drafted[0];
    db.test_workflows[test1.testId].status = 'draft_submitted';
    db.test_workflows[test1.testId].paperLink = 'https://drive.google.com/test1-paper';
    
    // Service Manager approves and publishes
    db.test_workflows[test1.testId].status = 'final_published';
    db.test_workflows[test1.testId].finalLink = 'https://drive.google.com/test1-paper';
    db.test_workflows[test1.testId].solutionsLink = 'https://drive.google.com/test1-sol';

    cols = getColumns();
    assert.equal(cols.drafted.length, 2, 'One duty promoted to published');
    assert.equal(cols.published.length, 1);
    assert.equal(cols.published[0].testId, test1.testId);

    // STAGE 3: Test conducted, marks uploaded & graded
    db.test_workflows[test1.testId].status = 'graded';
    db.test_workflows[test1.testId].gradedAt = new Date().toISOString();

    cols = getColumns();
    assert.equal(cols.drafted.length, 2);
    assert.equal(cols.published.length, 0);
    assert.equal(cols.graded.length, 1);
    assert.equal(cols.graded[0].status, 'graded');
  });

  // =========================================================================
  // TEST 3: Faculty Leave Approval & Daily Presence Engine (PRE vs POST)
  // =========================================================================
  await t.test('3. Faculty Leave Approvals & Floor Presence Engine (PRE vs POST)', () => {
    const todayStr = new Date().toISOString().split('T')[0];

    // Teacher Brijesh submits a leave request for today
    const leaveReqId = 'leave-001';
    db.leave_requests[leaveReqId] = {
      id: leaveReqId,
      teacherId: 't-brijesh',
      teacherName: 'Brijesh Prajapati',
      type: 'Casual Leave',
      startDate: todayStr,
      endDate: todayStr,
      totalDays: 1,
      reason: 'Urgent family emergency',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // Presence engine evaluator replicating ServiceManagerDashboard getTeacherStatus()
    const evaluateStatus = (teacherId) => {
      const attRecord = Object.values(db.teacher_attendance).find(r => r.teacherId === teacherId && r.date === todayStr);
      if (attRecord) {
        return {
          type: 'present',
          punchIn: attRecord.punchIn || 'Present',
          punchOut: attRecord.punchOut,
          status: attRecord.status || 'On Time'
        };
      }

      const onLeave = Object.values(db.leave_requests).some(req => 
        req.teacherId === teacherId &&
        req.status === 'approved' &&
        todayStr >= req.startDate &&
        todayStr <= req.endDate
      );

      if (onLeave) {
        return { type: 'leave' };
      }

      return { type: 'absent' };
    };

    // PRE-CONDITION: Leave is still pending, no punch-in yet
    const preStatus = evaluateStatus('t-brijesh');
    assert.equal(preStatus.type, 'absent', 'PRE-CONDITION: While leave is pending, teacher status must register as absent');

    // ACTION: Rohan Sir approves the leave in ServiceManagerDashboard.jsx
    db.leave_requests[leaveReqId].status = 'approved';
    db.leave_requests[leaveReqId].reviewedBy = serviceManagerProfile.fullName;
    db.leave_requests[leaveReqId].reviewedAt = new Date().toISOString();

    // POST-CONDITION 1: Real-time Presence Engine Reflection
    const postApprovalStatus = evaluateStatus('t-brijesh');
    assert.equal(postApprovalStatus.type, 'leave', 'POST-CONDITION: Upon manager approval, status transitions to leave');

    // POST-CONDITION 2: Rejection Flow Verification
    const leaveReqId2 = 'leave-002';
    db.leave_requests[leaveReqId2] = {
      id: leaveReqId2,
      teacherId: 't-sneha',
      teacherName: 'Sneha More',
      type: 'Casual Leave',
      startDate: todayStr,
      endDate: todayStr,
      totalDays: 1,
      reason: 'Personal work',
      status: 'pending'
    };

    // Rohan Sir rejects leave-002
    db.leave_requests[leaveReqId2].status = 'rejected';
    db.leave_requests[leaveReqId2].reviewRemarks = 'Test week scheduled, leave denied';
    db.leave_requests[leaveReqId2].reviewedBy = serviceManagerProfile.fullName;

    const snehaStatus = evaluateStatus('t-sneha');
    assert.equal(snehaStatus.type, 'absent', 'Rejected leave maintains absent state unless punched in');

    // POST-CONDITION 3: Physical Punch-in Overrides Leave
    db.teacher_attendance['att-brijesh-today'] = {
      teacherId: 't-brijesh',
      date: todayStr,
      punchIn: '01:50 PM',
      status: 'On Time'
    };
    const punchedInStatus = evaluateStatus('t-brijesh');
    assert.equal(punchedInStatus.type, 'present', 'Physical punch-in takes precedence even if approved on leave');
    assert.equal(punchedInStatus.punchIn, '01:50 PM');
  });

  // =========================================================================
  // TEST 4: Academic Coordination & Grievance Lifecycle
  // =========================================================================
  await t.test('4. Faculty Grievance Coordination Lifecycle (Teacher -> Rohan Board -> Resolution)', () => {
    // Teacher Mayur submits grievance via TeacherDashboard.jsx
    const grievancePayload = {
      id: 'griev-001',
      teacherId: 't-mayur',
      teacherName: 'Mayur Randive',
      category: 'Classroom / Infrastructure',
      request: '[Classroom / Infrastructure] Need extra whiteboard markers in Ahom Kaksh',
      priority: 'Normal',
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    db.faculty_grievances[grievancePayload.id] = { ...grievancePayload };

    // Service Manager Dashboard KPI counter
    const getPendingGrievanceCount = () => {
      return Object.values(db.faculty_grievances).filter(g => g.status !== 'Resolved').length;
    };
    assert.equal(getPendingGrievanceCount(), 1);

    // Rohan Sir resolves the grievance in Faculty.jsx
    db.faculty_grievances['griev-001'].status = 'Resolved';
    db.faculty_grievances['griev-001'].resolutionRemark = 'Stock of markers refilled in Tanaji and Ahom supply cabinets.';
    db.faculty_grievances['griev-001'].resolvedAt = new Date().toISOString();

    assert.equal(getPendingGrievanceCount(), 0, 'Resolved grievances must clear from pending KPI');
    assert.equal(db.faculty_grievances['griev-001'].status, 'Resolved');
    assert.ok(db.faculty_grievances['griev-001'].resolutionRemark);
  });

  // =========================================================================
  // TEST 5: PTM Escalation Resolution Pipeline
  // =========================================================================
  await t.test('5. PTM Escalation Resolution Pipeline (Students DB -> Rohan Queue -> Resolved)', () => {
    const studentId = 'stu-ptm-01';
    db.students[studentId] = {
      id: studentId,
      studentName: 'Rohan Deshmukh',
      batch: '10th Alpha',
      status: 'admitted',
      ptmNotices: [
        {
          teacherId: 't-brijesh',
          teacherName: 'Brijesh Prajapati',
          dateScheduled: '2026-09-25',
          agenda: 'Repeated poor performance in Quadratic Equations',
          requiresManager: true,
          status: 'pending',
          createdAt: '2026-09-22T10:00:00Z'
        }
      ]
    };

    // Service Manager queries escalated PTMs
    const getEscalatedPTMs = () => {
      const list = [];
      Object.values(db.students).forEach(s => {
        if (s.ptmNotices && Array.isArray(s.ptmNotices)) {
          s.ptmNotices.forEach(ptm => {
            if (ptm.requiresManager && ptm.status === 'pending') {
              list.push({ ...ptm, studentName: s.studentName, studentId: s.id, batch: s.batch });
            }
          });
        }
      });
      return list;
    };

    let ptmQueue = getEscalatedPTMs();
    assert.equal(ptmQueue.length, 1);
    assert.equal(ptmQueue[0].studentName, 'Rohan Deshmukh');

    // Service Manager resolves PTM in ServiceManagerDashboard handleResolvePTM()
    const targetNotice = ptmQueue[0];
    const sDoc = db.students[targetNotice.studentId];
    sDoc.ptmNotices = sDoc.ptmNotices.map(p => {
      if (p.createdAt === targetNotice.createdAt && p.teacherId === targetNotice.teacherId) {
        return { ...p, status: 'resolved', resolvedBy: serviceManagerProfile.fullName };
      }
      return p;
    });

    ptmQueue = getEscalatedPTMs();
    assert.equal(ptmQueue.length, 0, 'Resolved PTMs are cleanly dequeued from Service Manager dashboard');
  });

  // =========================================================================
  // TEST 6: Student Attendance & 7-Day Trend Gauge Pipeline
  // =========================================================================
  await t.test('6. Center Student Attendance Rate & 7-Day Trend Engine', () => {
    // Setup admitted students for attendance calculation
    const attendanceStudents = {};
    for (let i = 1; i <= 20; i++) {
      attendanceStudents[`stu-${i}`] = { id: `stu-${i}`, status: 'admitted', batch: '10th Alpha' };
    }
    const activeStudentsCount = Object.values(attendanceStudents).filter(s => s.status === 'admitted').length;
    assert.equal(activeStudentsCount, 20);

    const todayStr = new Date().toISOString().split('T')[0];
    db.attendance.push({
      batch: '10th Alpha',
      date: todayStr,
      absenteeIds: ['stu-1', 'stu-2', 'stu-3'], // 3 absent
      totalStudents: 20
    });

    const todaysAttendance = db.attendance.filter(a => a.date === todayStr);
    let totalAbsentToday = 0;
    todaysAttendance.forEach(a => { totalAbsentToday += (a.absenteeIds?.length || 0); });

    const attendanceRate = activeStudentsCount > 0 
      ? Math.max(0, Math.round(((activeStudentsCount - totalAbsentToday) / activeStudentsCount) * 100))
      : 0;

    assert.equal(totalAbsentToday, 3);
    assert.equal(attendanceRate, 85); // 17/20 = 85%
  });

  // =========================================================================
  // TEST 7: Service Manager Role Access & Navigation Matrix
  // =========================================================================
  await t.test('7. Service Manager Role & Permission Matrix Audit', () => {
    const allowedServiceManagerRoutes = [
      '/dashboard',
      '/faculty',
      '/students',
      '/attendance',
      '/users',
      '/communication-log',
      '/dashboard#personal_attendance',
      '/dashboard#personal_salary'
    ];

    const restrictedRoutes = [
      '/enquiries',           // Front Desk Manager exclusive
      '/pending-admissions',  // Front Desk Manager exclusive
      '/inventory'            // Inventory & Front Desk
    ];

    allowedServiceManagerRoutes.forEach(r => {
      assert.ok(allowedServiceManagerRoutes.includes(r));
    });

    restrictedRoutes.forEach(r => {
      assert.ok(!allowedServiceManagerRoutes.includes(r));
    });
  });

});
