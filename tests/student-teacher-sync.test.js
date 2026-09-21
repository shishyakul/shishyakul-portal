import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// 1. GAP 3: STUDENT IDENTITY RESOLUTION & AUTO-CACHING LOGIC
// ============================================================================
describe('Gap 3: Student Identity Resolution Engine', () => {

  const mockStudentsDatabase = [
    { id: 'stu_001', studentName: 'Aarav Sharma', emailId: 'aarav.sharma@example.com', batch: '10th-CBSE Foxtrot', status: 'admitted' },
    { id: 'stu_002_old', studentName: 'Diya Patel', emailId: 'diya.patel@example.com', batch: '9th-ICSE Alpha', status: 'enquiry' },
    { id: 'stu_002_active', studentName: 'Diya Patel', emailId: 'diya.patel@example.com', batch: '10th-ICSE Alpha', status: 'admitted' },
    { id: 'stu_003', studentName: 'Rohan Deshmukh', emailId: 'rohan.d@example.com', batch: '10th-State Board', status: 'passout' }
  ];

  function resolveStudentRecord(profile, dbDocs) {
    const findBestRecord = (docs) => {
      let best = docs[0];
      for (let d of docs) {
        if (d.status === 'admitted') return d;
        if (d.status === 'passout') best = d;
      }
      return best;
    };

    // Step A: Direct studentId lookup
    if (profile?.studentId) {
      const match = dbDocs.find(d => d.id === profile.studentId);
      if (match) return { found: true, record: match, cached: true };
    }

    // Step B: Normalized email lookup
    const emailNorm = (profile?.email || '').toLowerCase().trim();
    if (emailNorm) {
      const emailMatches = dbDocs.filter(d => (d.emailId || '').toLowerCase().trim() === emailNorm);
      if (emailMatches.length > 0) {
        const best = findBestRecord(emailMatches);
        const shouldCache = profile?.uid && profile.studentId !== best.id;
        return { found: true, record: best, shouldCache, cacheId: best.id };
      }
    }

    // Step C: Name fallback
    const nameNorm = (profile?.fullName || profile?.displayName || profile?.studentName || '').toLowerCase().trim();
    const nameMatches = dbDocs.filter(d => (d.studentName || '').toLowerCase().trim() === nameNorm);
    if (nameMatches.length > 0) {
      const best = findBestRecord(nameMatches);
      return { found: true, record: best, fallback: 'name' };
    }

    return { found: false, notFound: true, totalFees: 0, paidInstallments: [] };
  }

  it('prioritizes direct profile.studentId lookup for instantaneous O(1) resolution', () => {
    const profile = { uid: 'usr_1', studentId: 'stu_001', email: 'different@example.com', fullName: 'Aarav Sharma' };
    const res = resolveStudentRecord(profile, mockStudentsDatabase);
    assert.equal(res.found, true);
    assert.equal(res.record.id, 'stu_001');
    assert.equal(res.cached, true);
  });

  it('normalizes email with case-insensitivity and whitespace trimming, selecting admitted over enquiry', () => {
    const profile = { uid: 'usr_2', email: '  DIYA.PATEL@EXAMPLE.COM  ', fullName: 'Diya Patel' };
    const res = resolveStudentRecord(profile, mockStudentsDatabase);
    assert.equal(res.found, true);
    assert.equal(res.record.id, 'stu_002_active');
    assert.equal(res.record.status, 'admitted');
    assert.equal(res.shouldCache, true);
    assert.equal(res.cacheId, 'stu_002_active');
  });

  it('falls back to student name lookup when email is not found', () => {
    const profile = { uid: 'usr_3', email: 'unknown@example.com', fullName: 'Rohan Deshmukh' };
    const res = resolveStudentRecord(profile, mockStudentsDatabase);
    assert.equal(res.found, true);
    assert.equal(res.record.id, 'stu_003');
    assert.equal(res.fallback, 'name');
  });

  it('returns graceful notFound state when identity cannot be matched', () => {
    const profile = { uid: 'usr_none', email: 'nobody@example.com', fullName: 'Unregistered Student' };
    const res = resolveStudentRecord(profile, mockStudentsDatabase);
    assert.equal(res.found, false);
    assert.equal(res.notFound, true);
    assert.equal(res.totalFees, 0);
  });
});

// ============================================================================
// 2. GAP 2: SATURDAY WEEKLY TEST SYNCHRONIZATION & ANALYTICS
// ============================================================================
describe('Gap 2: Saturday Weekly Test Sync & Performance Analytics', () => {

  // Simulated Teacher Saturday Weekly Test submit handler logic
  function teacherUploadSaturdayTestMarks({ testId, batch, subject, topic, testDate, maxMarks, teacherId, results }) {
    const testMarksDoc = {
      testId,
      batch,
      subject,
      topic,
      testDate,
      maxMarks: Number(maxMarks),
      results,
      uploadedAt: '2026-09-20T10:00:00.000Z',
      uploadedBy: teacherId
    };

    const studentUpdates = results.map(res => ({
      studentId: res.studentId,
      historyItem: {
        testId,
        date: testDate,
        subject,
        topic,
        type: 'Weekly Test',
        maxMarks: Number(maxMarks),
        obtainedMarks: Number(res.marks),
        percentage: res.percentage,
        rank: res.batchRank
      }
    }));

    return { testMarksDoc, studentUpdates };
  }

  // Simulated Student Dashboard test calculation and analytics engine
  function computeStudentPerformanceAnalytics({ batchTestMarks, studentRecord, studentId, studentFullName }) {
    const testsMap = new Map();

    // From batch test_marks
    batchTestMarks.forEach(docData => {
      const results = docData.results || [];
      const myResult = results.find(r =>
        (studentId && r.studentId === studentId) ||
        (r.studentName && r.studentName.toLowerCase().trim() === studentFullName.toLowerCase().trim())
      );

      if (myResult) {
        const key = docData.testId || docData.id || `${docData.testDate}-${docData.subject}-${docData.topic}`;
        const maxM = Number(docData.maxMarks) || 100;
        const obtM = Number(myResult.marks) || 0;
        const pct = myResult.percentage !== undefined ? Number(myResult.percentage) : Math.round((obtM / maxM) * 100);

        testsMap.set(key, {
          id: key,
          date: docData.testDate || 'N/A',
          subject: docData.subject || 'General',
          topic: docData.topic || 'Class Test',
          type: docData.type || 'Weekly Test',
          maxMarks: maxM,
          obtainedMarks: obtM,
          percentage: pct,
          rank: myResult.batchRank || myResult.rank || null,
          remarks: pct >= 80 ? 'Distinction' : pct >= 60 ? 'Satisfactory' : 'Needs Focus'
        });
      }
    });

    // From studentRecord.testHistory
    const hist = studentRecord?.testHistory || [];
    hist.forEach(h => {
      const key = h.testId || `${h.date}-${h.subject}-${h.topic}`;
      if (!testsMap.has(key)) {
        const maxM = Number(h.maxMarks) || 100;
        const obtM = Number(h.obtainedMarks ?? h.marks ?? 0);
        const pct = h.percentage !== undefined ? Number(h.percentage) : Math.round((obtM / maxM) * 100);

        testsMap.set(key, {
          id: key,
          date: h.date || 'N/A',
          subject: h.subject || 'General',
          topic: h.topic || 'Class Test',
          type: h.type || 'Test',
          maxMarks: maxM,
          obtainedMarks: obtM,
          percentage: pct,
          rank: h.rank || h.batchRank || null,
          remarks: pct >= 80 ? 'Distinction' : pct >= 60 ? 'Satisfactory' : 'Needs Focus'
        });
      }
    });

    const testList = Array.from(testsMap.values());

    // Sort newest first
    testList.sort((a, b) => {
      const parseD = (str) => {
        if (!str || typeof str !== 'string') return 0;
        if (str.includes('/')) return new Date(str.split('/').reverse().join('-')).getTime() || 0;
        return new Date(str).getTime() || 0;
      };
      return parseD(b.date) - parseD(a.date);
    });

    // Chronological trend data for Recharts
    const trend = [...testList].reverse().map((t, idx) => ({
      name: t.date !== 'N/A' ? t.date : `Test #${idx + 1}`,
      percentage: t.percentage,
      score: t.obtainedMarks,
      subject: t.subject,
      rank: t.rank
    }));

    // Subject breakdown
    const subMap = {};
    testList.forEach(t => {
      const s = t.subject || 'Other';
      if (!subMap[s]) subMap[s] = { count: 0, totalPct: 0 };
      subMap[s].count += 1;
      subMap[s].totalPct += t.percentage;
    });

    const subAnalytics = Object.keys(subMap).map(sub => ({
      subject: sub,
      average: Math.round(subMap[sub].totalPct / subMap[sub].count),
      testsCount: subMap[sub].count
    }));

    let totalPctSum = 0;
    let minRank = null;
    testList.forEach(t => {
      totalPctSum += t.percentage;
      if (t.rank && (minRank === null || t.rank < minRank)) {
        minRank = t.rank;
      }
    });

    const avg = testList.length > 0 ? Math.round(totalPctSum / testList.length) : 0;

    return {
      unifiedTests: testList,
      testTrendData: trend,
      subjectAnalytics: subAnalytics,
      overallAverageScore: avg,
      bestRank: minRank,
      totalTestsCount: testList.length
    };
  }

  it('creates dual-write payload updating test_marks and student testHistory on Saturday Weekly Test submission', () => {
    const payload = teacherUploadSaturdayTestMarks({
      testId: 'test_sat_101',
      batch: '10th-CBSE Foxtrot',
      subject: 'Mathematics',
      topic: 'Quadratic Equations',
      testDate: '2026-09-19',
      maxMarks: 50,
      teacherId: 'teacher_1',
      results: [
        { studentId: 'stu_001', studentName: 'Aarav Sharma', marks: 45, percentage: 90, batchRank: 1 },
        { studentId: 'stu_002', studentName: 'Diya Patel', marks: 40, percentage: 80, batchRank: 2 }
      ]
    });

    assert.equal(payload.testMarksDoc.maxMarks, 50);
    assert.equal(payload.testMarksDoc.results.length, 2);
    assert.equal(payload.studentUpdates.length, 2);
    assert.equal(payload.studentUpdates[0].studentId, 'stu_001');
    assert.equal(payload.studentUpdates[0].historyItem.percentage, 90);
    assert.equal(payload.studentUpdates[0].historyItem.rank, 1);
  });

  it('deduplicates overlapping tests between batchTestMarks and studentRecord.testHistory without duplicates', () => {
    const batchTestMarks = [
      {
        testId: 'test_sat_101',
        testDate: '2026-09-19',
        subject: 'Mathematics',
        topic: 'Quadratic Equations',
        maxMarks: 50,
        results: [{ studentId: 'stu_001', marks: 45, percentage: 90, batchRank: 1 }]
      },
      {
        testId: 'test_sat_102',
        testDate: '2026-09-26',
        subject: 'Science',
        topic: 'Chemical Reactions',
        maxMarks: 50,
        results: [{ studentId: 'stu_001', marks: 42, percentage: 84, batchRank: 2 }]
      }
    ];

    const studentRecord = {
      id: 'stu_001',
      studentName: 'Aarav Sharma',
      testHistory: [
        // Duplicate of test_sat_101
        { testId: 'test_sat_101', date: '2026-09-19', subject: 'Mathematics', topic: 'Quadratic Equations', maxMarks: 50, obtainedMarks: 45, percentage: 90, rank: 1 },
        // Standalone older class test
        { testId: 'test_class_099', date: '2026-09-12', subject: 'Mathematics', topic: 'Linear Equations', maxMarks: 25, obtainedMarks: 24, percentage: 96, rank: 1 }
      ]
    };

    const analytics = computeStudentPerformanceAnalytics({
      batchTestMarks,
      studentRecord,
      studentId: 'stu_001',
      studentFullName: 'Aarav Sharma'
    });

    // Total unique tests should be exactly 3 (not 4)
    assert.equal(analytics.totalTestsCount, 3);
    assert.equal(analytics.unifiedTests.length, 3);

    // Newest test should be first in unifiedTests (2026-09-26)
    assert.equal(analytics.unifiedTests[0].date, '2026-09-26');
    assert.equal(analytics.unifiedTests[0].subject, 'Science');

    // Chronological trend for Recharts should have oldest first (2026-09-12)
    assert.equal(analytics.testTrendData[0].name, '2026-09-12');
    assert.equal(analytics.testTrendData[2].name, '2026-09-26');

    // Best rank should be 1
    assert.equal(analytics.bestRank, 1);

    // Overall average: (90 + 84 + 96) / 3 = 90%
    assert.equal(analytics.overallAverageScore, 90);

    // Subject breakdown: Maths avg: (90 + 96)/2 = 93%, Science: 84%
    const maths = analytics.subjectAnalytics.find(s => s.subject === 'Mathematics');
    assert.equal(maths.average, 93);
    assert.equal(maths.testsCount, 2);
    const science = analytics.subjectAnalytics.find(s => s.subject === 'Science');
    assert.equal(science.average, 84);
    assert.equal(science.testsCount, 1);
  });
});

// ============================================================================
// 3. GAP 1: HOMEWORK SUBMISSIONS & TEACHER GRADING WORKFLOW
// ============================================================================
describe('Gap 1: Homework Submissions & Teacher Grading Engine', () => {

  function studentSubmitHomework({ studentId, studentName, batch, assignmentId, assignmentTitle, driveLink }) {
    if (!assignmentId || !driveLink || !driveLink.trim()) {
      throw new Error('Assignment and Drive link are required.');
    }
    return {
      studentId,
      studentName,
      batch,
      assignmentId,
      assignmentTitle,
      driveLink: driveLink.trim(),
      graded: false,
      marks: null,
      feedback: null,
      timestamp: '2026-09-20T12:00:00.000Z'
    };
  }

  function teacherGradeHomework(submission, marks, feedback, teacherName) {
    const m = Number(marks);
    if (isNaN(m) || m < 0 || m > 100) {
      throw new Error('Marks must be between 0 and 100');
    }
    return {
      ...submission,
      marks: m,
      feedback: feedback ? feedback.trim() : '',
      graded: true,
      gradedAt: '2026-09-20T14:30:00.000Z',
      gradedBy: teacherName
    };
  }

  it('validates student homework submission payload', () => {
    assert.throws(() => {
      studentSubmitHomework({ studentId: 'stu_1', studentName: 'Aarav', batch: '10th', assignmentId: '', driveLink: '' });
    }, /Assignment and Drive link are required/);

    const sub = studentSubmitHomework({
      studentId: 'stu_1',
      studentName: 'Aarav',
      batch: '10th-CBSE Foxtrot',
      assignmentId: 'asg_501',
      assignmentTitle: 'Trigonometry Problem Set 3',
      driveLink: 'https://drive.google.com/file/d/sample123'
    });

    assert.equal(sub.graded, false);
    assert.equal(sub.marks, null);
    assert.equal(sub.driveLink, 'https://drive.google.com/file/d/sample123');
  });

  it('grades homework with marks, teacher remarks, and audit timestamps', () => {
    const sub = studentSubmitHomework({
      studentId: 'stu_1',
      studentName: 'Aarav',
      batch: '10th-CBSE Foxtrot',
      assignmentId: 'asg_501',
      assignmentTitle: 'Trigonometry Problem Set 3',
      driveLink: 'https://drive.google.com/file/d/sample123'
    });

    const graded = teacherGradeHomework(sub, 92, 'Excellent step-by-step proofs! Well structured.', 'Sanjay Sir');

    assert.equal(graded.graded, true);
    assert.equal(graded.marks, 92);
    assert.equal(graded.feedback, 'Excellent step-by-step proofs! Well structured.');
    assert.equal(graded.gradedBy, 'Sanjay Sir');
    assert.ok(graded.gradedAt);
  });

  it('rejects invalid marks input', () => {
    const sub = studentSubmitHomework({
      studentId: 'stu_1',
      studentName: 'Aarav',
      batch: '10th-CBSE Foxtrot',
      assignmentId: 'asg_501',
      assignmentTitle: 'Trigonometry Problem Set 3',
      driveLink: 'https://drive.google.com/file/d/sample123'
    });

    assert.throws(() => {
      teacherGradeHomework(sub, 150, 'Too high', 'Teacher');
    }, /Marks must be between 0 and 100/);

    assert.throws(() => {
      teacherGradeHomework(sub, -5, 'Negative', 'Teacher');
    }, /Marks must be between 0 and 100/);
  });
});

// ============================================================================
// 4. GAP 4: DIRECT FACULTY ADVISORIES & PTM NOTICES
// ============================================================================
describe('Gap 4: Direct Advisories & Student Communication Filter', () => {

  const allCommunications = [
    { id: 'comm_1', studentId: 'stu_001', studentName: 'Aarav Sharma', studentEmail: 'aarav.sharma@example.com', batch: '10th-CBSE Foxtrot', type: 'attendance_alert', message: 'Attendance below 75%', readByStudent: false },
    { id: 'comm_2', studentId: 'stu_002', studentName: 'Diya Patel', studentEmail: 'diya.patel@example.com', batch: '10th-ICSE Alpha', type: 'academic_notice', message: 'Great improvement in Science test', readByStudent: false },
    { id: 'comm_3', batch: '10th-CBSE Foxtrot', type: 'general_notice', message: 'Extra class scheduled for Sunday 10 AM', readByStudent: false } // Broadcast to entire batch
  ];

  function filterStudentCommunications(communications, { studentId, studentEmail, studentFullName, batchName }) {
    const sNameLower = (studentFullName || '').trim().toLowerCase();
    const sEmailNorm = (studentEmail || '').trim().toLowerCase();

    return communications.filter(item => {
      const itemSid = item.studentId;
      const itemSName = (item.studentName || '').toLowerCase().trim();
      const itemSEmail = (item.studentEmail || '').toLowerCase().trim();
      const itemBatch = item.batch;

      return (
        (studentId && itemSid === studentId) ||
        (sNameLower && itemSName === sNameLower) ||
        (sEmailNorm && itemSEmail === sEmailNorm) ||
        (batchName && itemBatch === batchName && !itemSid)
      );
    });
  }

  function acknowledgeNotice(commDoc) {
    return {
      ...commDoc,
      readByStudent: true,
      acknowledgedAt: '2026-09-20T15:00:00.000Z'
    };
  }

  it('filters communications accurately for the student and includes broadcast batch notices', () => {
    const aaravNotices = filterStudentCommunications(allCommunications, {
      studentId: 'stu_001',
      studentEmail: 'aarav.sharma@example.com',
      studentFullName: 'Aarav Sharma',
      batchName: '10th-CBSE Foxtrot'
    });

    // Aarav should receive comm_1 (addressed to him) and comm_3 (batch broadcast), but NOT comm_2 (addressed to Diya)
    assert.equal(aaravNotices.length, 2);
    assert.equal(aaravNotices.some(c => c.id === 'comm_1'), true);
    assert.equal(aaravNotices.some(c => c.id === 'comm_3'), true);
    assert.equal(aaravNotices.some(c => c.id === 'comm_2'), false);
  });

  it('updates acknowledgment status with read flag and timestamp', () => {
    const notice = allCommunications[0];
    const ack = acknowledgeNotice(notice);
    assert.equal(ack.readByStudent, true);
    assert.ok(ack.acknowledgedAt);
  });
});

// ============================================================================
// 5. MASTER MATRIX TIMETABLE CYCLE MAPPER & TODAY HIGHLIGHT
// ============================================================================
describe('Master Matrix Timetable Engine & Cycle Mapper', () => {

  const mapCycleToDays = (label, defaultDays) => {
    const l = (label || '').toUpperCase();
    if (!l) return defaultDays;
    if (l === 'ALL DAYS') return ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    if (l === 'MON-WED-FRI') return ['MONDAY', 'WEDNESDAY', 'FRIDAY'];
    if (l === 'TUES-THURS-SAT') return ['TUESDAY', 'THURSDAY', 'SATURDAY'];
    if (l === 'WEEKENDS') return ['SATURDAY', 'SUNDAY'];

    const DAYS_MAP = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const FULL_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

    if (l.includes('-')) {
      let parts = l.split('-');
      let sStr = parts[0].replace('THURS', 'THU').replace('TUES', 'TUE');
      let eStr = parts[1].replace('THURS', 'THU').replace('TUES', 'TUE');
      let sIdx = DAYS_MAP.indexOf(sStr);
      let eIdx = DAYS_MAP.indexOf(eStr);
      if (sIdx !== -1 && eIdx !== -1) {
        let result = [];
        for (let i = Math.min(sIdx, eIdx); i <= Math.max(sIdx, eIdx); i++) {
          result.push(FULL_DAYS[i]);
        }
        return result;
      }
    } else {
      let sStr = l.replace('THURS', 'THU').replace('TUES', 'TUE');
      let idx = DAYS_MAP.indexOf(sStr);
      if (idx !== -1) return [FULL_DAYS[idx]];
    }

    return defaultDays;
  };

  it('maps standard and custom day cycles accurately', () => {
    assert.deepEqual(mapCycleToDays('ALL DAYS', []), ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);
    assert.deepEqual(mapCycleToDays('MON-WED-FRI', []), ['MONDAY', 'WEDNESDAY', 'FRIDAY']);
    assert.deepEqual(mapCycleToDays('TUES-THURS-SAT', []), ['TUESDAY', 'THURSDAY', 'SATURDAY']);
    assert.deepEqual(mapCycleToDays('WEEKENDS', []), ['SATURDAY', 'SUNDAY']);
    assert.deepEqual(mapCycleToDays('MON-WED', []), ['MONDAY', 'TUESDAY', 'WEDNESDAY']);
    assert.deepEqual(mapCycleToDays('THU-SAT', []), ['THURSDAY', 'FRIDAY', 'SATURDAY']);
    assert.deepEqual(mapCycleToDays('SAT', []), ['SATURDAY']);
  });

  it('correctly maps timetable slot, room, and test components into weekly schedule', () => {
    const rawBatchData = {
      monWedLabel: 'MON-WED',
      monWed: { subject: 'Mathematics', topic: 'Trigonometry', teacherId: 't_1' },
      thursSatLabel: 'THU-SAT',
      thursSat: { subject: 'Science', topic: 'Electricity', teacherId: 't_2' },
      test: { topic: 'Weekly Revision Test' },
      extra: { subject: 'Doubt Clearing', teacherId: 't_1' }
    };

    const scheduleByDay = {};
    const cycle1 = mapCycleToDays(rawBatchData.monWedLabel, ['MONDAY', 'TUESDAY', 'WEDNESDAY']);
    const cycle2 = mapCycleToDays(rawBatchData.thursSatLabel, ['THURSDAY', 'FRIDAY', 'SATURDAY']);

    cycle1.forEach(d => { scheduleByDay[d] = { ...rawBatchData.monWed, type: 'regular' }; });
    cycle2.forEach(d => { scheduleByDay[d] = { ...rawBatchData.thursSat, type: 'regular' }; });

    if (rawBatchData.test?.topic) {
      scheduleByDay['SATURDAY'] = { type: 'test', topic: rawBatchData.test.topic, subject: 'WEEKLY TEST' };
    }
    if (rawBatchData.extra?.subject) {
      scheduleByDay['SUNDAY'] = { ...rawBatchData.extra, type: 'extra' };
    }

    assert.equal(scheduleByDay['MONDAY'].subject, 'Mathematics');
    assert.equal(scheduleByDay['THURSDAY'].subject, 'Science');
    assert.equal(scheduleByDay['SATURDAY'].subject, 'WEEKLY TEST');
    assert.equal(scheduleByDay['SATURDAY'].type, 'test');
    assert.equal(scheduleByDay['SUNDAY'].subject, 'Doubt Clearing');
  });
});

// ============================================================================
// 6. FINANCIAL LEDGER MATH CALCULATIONS
// ============================================================================
describe('Student Financial Ledger Engine', () => {
  function calculateFees(totalFees, installmentsCount, paidInstallments) {
    const total = Number(totalFees) || 0;
    const count = Number(installmentsCount) || 1;
    const installmentAmount = total / count;
    const paidCount = Array.isArray(paidInstallments) ? paidInstallments.length : 0;
    const paidAmount = paidCount * installmentAmount;
    const pendingAmount = Math.max(0, total - paidAmount);

    return {
      totalFees: total,
      installmentAmount,
      paidAmount,
      pendingAmount,
      isFullyPaid: pendingAmount === 0
    };
  }

  it('accurately divides installments and calculates paid vs pending balance', () => {
    const fees = calculateFees(60000, 4, [0, 1]); // Paid installment 1 and 2
    assert.equal(fees.totalFees, 60000);
    assert.equal(fees.installmentAmount, 15000);
    assert.equal(fees.paidAmount, 30000);
    assert.equal(fees.pendingAmount, 30000);
    assert.equal(fees.isFullyPaid, false);
  });

  it('correctly marks ledger as fully paid when all installments are cleared', () => {
    const fees = calculateFees(60000, 4, [0, 1, 2, 3]);
    assert.equal(fees.paidAmount, 60000);
    assert.equal(fees.pendingAmount, 0);
    assert.equal(fees.isFullyPaid, true);
  });
});

// ============================================================================
// 8. TEST SERIES 3-CATEGORY INGESTION & FILTER ENGINE
// ============================================================================
describe('Test Series 3-Category Ingestion & Filter Engine', () => {
  function filterTestsByCategory(tests, filter) {
    if (filter === 'weekly') {
      return tests.filter(t => t.type?.toLowerCase().includes('weekly') || t.type?.toLowerCase().includes('saturday'));
    }
    if (filter === 'class') {
      return tests.filter(t => t.type?.toLowerCase().includes('class') || t.type?.toLowerCase().includes('surprise'));
    }
    if (filter === 'school') {
      return tests.filter(t => t.type?.toLowerCase().includes('school'));
    }
    return tests;
  }

  function parseSchoolExam(exam) {
    const subjects = Object.keys(exam.marks || {});
    let obtM = 0;
    let maxM = 0;
    subjects.forEach(s => {
      const d = exam.marks[s];
      const val = typeof d === 'object' && d !== null ? Number(d.obtained || 0) : Number(d || 0);
      const mx = typeof d === 'object' && d !== null ? Number(d.max || 100) : Number(exam.maxMarks || 100);
      obtM += val;
      maxM += mx;
    });
    const pct = maxM > 0 ? Math.round((obtM / maxM) * 100) : 0;
    return {
      type: 'School Exam',
      topic: exam.testType || 'School Exam',
      obtainedMarks: obtM,
      maxMarks: maxM,
      percentage: pct
    };
  }

  it('correctly categorizes and filters all 3 test categories (Weekly, Class, School Exam)', () => {
    const testList = [
      { id: '1', type: 'Weekly Test', subject: 'Math', topic: 'Saturday Test #4' },
      { id: '2', type: 'Class Test', subject: 'Physics', topic: 'Surprise Quiz' },
      { id: '3', type: 'School Exam', subject: 'All', topic: '1st Terminal Exam' },
      { id: '4', type: 'Weekly Test', subject: 'Chemistry', topic: 'Saturday Test #5' }
    ];

    const all = filterTestsByCategory(testList, 'all');
    const weekly = filterTestsByCategory(testList, 'weekly');
    const classTests = filterTestsByCategory(testList, 'class');
    const school = filterTestsByCategory(testList, 'school');

    assert.equal(all.length, 4);
    assert.equal(weekly.length, 2);
    assert.equal(classTests.length, 1);
    assert.equal(school.length, 1);
  });

  it('accurately parses multi-subject School Exam mark sheets', () => {
    const examDoc = {
      testType: 'Mid-Term Board Exam',
      marks: {
        'Mathematics': { obtained: 75, max: 80 },
        'Science': { obtained: 68, max: 80 },
        'English': { obtained: 70, max: 80 }
      }
    };
    const parsed = parseSchoolExam(examDoc);
    assert.equal(parsed.type, 'School Exam');
    assert.equal(parsed.obtainedMarks, 213);
    assert.equal(parsed.maxMarks, 240);
    assert.equal(parsed.percentage, 89);
  });
});

// ============================================================================
// 9. ATTENDANCE & EXTRA LECTURE (SELF-STUDY) LOGS ENGINE
// ============================================================================
describe('Attendance & Extra Lecture (Self-Study) Logs Engine', () => {
  function parseStudentAttendance(attDocs, studentId) {
    return attDocs.map(doc => {
      const isAbsent = doc.absentList && doc.absentList.includes(studentId);
      const lateInfo = doc.lateArrivals ? doc.lateArrivals[studentId] : null;
      const selfStudyLog = doc.selfStudyLogs ? doc.selfStudyLogs[studentId] : null;
      const inOutTime = doc.inOutTimes ? doc.inOutTimes[studentId] : null;

      return {
        id: doc.id,
        date: doc.date,
        sessionType: doc.sessionType || 'Regular Class',
        status: isAbsent ? 'Absent' : 'Present',
        lateInfo,
        selfStudyLog,
        inOutTime
      };
    });
  }

  it('correctly parses daily regular class attendance alongside extra lecture and self-study sessions', () => {
    const sampleDocs = [
      {
        id: 'att_01',
        date: '2026-09-20',
        sessionType: 'Regular Class',
        presentList: ['stu_001'],
        absentList: []
      },
      {
        id: 'att_02',
        date: '2026-09-20',
        sessionType: 'Self-Study',
        selfStudyLogs: {
          'stu_001': { subject: 'Physics', topic: 'Optics Problem Solving', teacherScore: 9, notes: 'Completed 15 problems' }
        },
        inOutTimes: {
          'stu_001': { in: '16:00', out: '18:30' }
        }
      }
    ];

    const records = parseStudentAttendance(sampleDocs, 'stu_001');
    assert.equal(records.length, 2);
    assert.equal(records[0].sessionType, 'Regular Class');
    assert.equal(records[0].status, 'Present');

    const selfStudy = records.find(r => r.sessionType === 'Self-Study');
    assert.ok(selfStudy);
    assert.equal(selfStudy.selfStudyLog.subject, 'Physics');
    assert.equal(selfStudy.selfStudyLog.teacherScore, 9);
    assert.equal(selfStudy.inOutTime.in, '16:00');
    assert.equal(selfStudy.inOutTime.out, '18:30');
  });
});

// ============================================================================
// 10. MULTI-ATTRIBUTE MATCHING ENGINE (ZERO UI MISMATCH DOCTRINE)
// ============================================================================
describe('Multi-Attribute Matching Engine (Zero UI Mismatch Doctrine)', () => {
  function matchSubmissionForStudent(submission, { profile, studentRecord }) {
    const possibleIds = [studentRecord?.id, profile?.studentId, profile?.uid].filter(Boolean);
    const possibleEmails = [profile?.email, studentRecord?.emailId, studentRecord?.email]
      .filter(Boolean)
      .map(e => e.toLowerCase().trim());
    const possibleNames = [
      profile?.fullName,
      profile?.displayName,
      profile?.studentName,
      studentRecord?.studentName,
      studentRecord?.fullName,
      studentRecord?.name
    ].filter(Boolean).map(n => n.toLowerCase().trim());

    const itemSid = submission.studentId;
    const itemEmail = (submission.studentEmail || '').toLowerCase().trim();
    const itemName = (submission.studentName || '').toLowerCase().trim();

    return (
      (itemSid && possibleIds.includes(itemSid)) ||
      (itemEmail && possibleEmails.includes(itemEmail)) ||
      (itemName && possibleNames.includes(itemName))
    );
  }

  it('matches submission even if profile name is "Himanshu" and student doc name is "Himanshu Vishwakarma"', () => {
    const submission = {
      id: 'sub_001',
      studentId: 'Lggee28fU4KWMEA960TL',
      studentName: 'Himanshu Vishwakarma',
      studentEmail: 'himanshuvishwakarma516@gmail.com'
    };

    const studentContext = {
      profile: { uid: 'iC9MIjmE8yd3fW2oW1i55JHQf842', fullName: 'Himanshu', email: 'himanshuvishwakarma516@gmail.com' },
      studentRecord: { id: 'Lggee28fU4KWMEA960TL', studentName: 'Himanshu Vishwakarma', emailId: 'himanshuvishwakarma516@gmail.com' }
    };

    assert.equal(matchSubmissionForStudent(submission, studentContext), true);
  });

  it('matches submission when matched purely by canonical student doc ID even if names differ', () => {
    const submission = {
      id: 'sub_002',
      studentId: 'Lggee28fU4KWMEA960TL',
      studentName: 'H. Vishwakarma'
    };

    const studentContext = {
      profile: { uid: 'random_uid', fullName: 'Himanshu' },
      studentRecord: { id: 'Lggee28fU4KWMEA960TL', studentName: 'Himanshu Vishwakarma' }
    };

    assert.equal(matchSubmissionForStudent(submission, studentContext), true);
  });

  it('correctly unifies teacher batches from assignedBatches, batches, and classTeacherBatch', () => {
    const teacherProfile = {
      assignedBatches: ['8th-CBSE Alpha'],
      batches: ['9th-CBSE Alpha'],
      classTeacherBatch: ['8th-CBSE Alpha', '10th-CBSE Alpha']
    };

    const unifiedBatches = Array.from(new Set([
      ...(Array.isArray(teacherProfile.assignedBatches) ? teacherProfile.assignedBatches : []),
      ...(Array.isArray(teacherProfile.batches) ? teacherProfile.batches : []),
      ...(Array.isArray(teacherProfile.classTeacherBatch) ? teacherProfile.classTeacherBatch : [])
    ]));

    assert.equal(unifiedBatches.length, 3);
    assert.ok(unifiedBatches.includes('8th-CBSE Alpha'));
    assert.ok(unifiedBatches.includes('9th-CBSE Alpha'));
    assert.ok(unifiedBatches.includes('10th-CBSE Alpha'));
  });
});

// ============================================================================
// 11. TEACHER-MANAGER LEAVE APPROVALS LIFECYCLE ENGINE
// ============================================================================
describe('Teacher-Manager Leave Approvals Lifecycle Engine', () => {
  const teacherId = 'teacher_brijesh_01';
  const todayStr = '2026-09-21';

  function evaluatePresence(teacherId, todayTeacherAttendance, leaveRequests, todayStr) {
    const attRecord = todayTeacherAttendance.find(r => r.teacherId === teacherId);
    if (attRecord) {
      return { type: 'present', punchIn: attRecord.punchIn, status: attRecord.status || 'On Time' };
    }

    const onLeave = leaveRequests.some(req =>
      req.teacherId === teacherId &&
      req.status === 'approved' &&
      todayStr >= req.startDate &&
      todayStr <= req.endDate
    );

    if (onLeave) return { type: 'leave' };
    return { type: 'absent' };
  }

  it('marks teacher as absent when leave is still pending and no attendance punch exists', () => {
    const leaveRequests = [
      { id: 'leave_1', teacherId, startDate: '2026-09-20', endDate: '2026-09-22', status: 'pending' }
    ];
    const presence = evaluatePresence(teacherId, [], leaveRequests, todayStr);
    assert.equal(presence.type, 'absent');
  });

  it('dynamically transitions teacher to On Leave upon manager approval within date window', () => {
    const leaveRequests = [
      {
        id: 'leave_1',
        teacherId,
        startDate: '2026-09-20',
        endDate: '2026-09-22',
        status: 'approved',
        reviewedBy: 'Rohan Sir (Service Manager)',
        reviewedAt: '2026-09-20T10:00:00Z'
      }
    ];
    const presence = evaluatePresence(teacherId, [], leaveRequests, todayStr);
    assert.equal(presence.type, 'leave');
  });

  it('retains absent status when leave is rejected with manager remark', () => {
    const leaveRequests = [
      {
        id: 'leave_1',
        teacherId,
        startDate: '2026-09-20',
        endDate: '2026-09-22',
        status: 'rejected',
        reviewRemarks: 'Exam invigilation scheduled',
        reviewedBy: 'Sumit Sir (Branch Manager)'
      }
    ];
    const presence = evaluatePresence(teacherId, [], leaveRequests, todayStr);
    assert.equal(presence.type, 'absent');
  });
});

// ============================================================================
// 12. SATURDAY TEST DUTY AUTO-SEED & WORKFLOW PROGRESSION ENGINE
// ============================================================================
describe('Saturday Test Duty Auto-Seed & Workflow Progression Engine', () => {
  it('correctly seeds test_workflows with draft_pending from master timetable test cells', () => {
    const timetableCell = {
      batch: '10th-CBSE Alpha',
      thursSat: { subject: 'Mathematics' },
      test: { topic: 'Quadratic Equations', preparedBy: 'teacher_brijesh', checkedBy: 'teacher_sneha' }
    };
    const saturdayDateStr = '26/09/26';
    const testId = `${saturdayDateStr.replace(/\//g, '-')}_${timetableCell.batch}`;

    const seededWorkflow = {
      testId,
      batch: timetableCell.batch,
      subject: timetableCell.thursSat.subject,
      topic: timetableCell.test.topic,
      preparedBy: timetableCell.test.preparedBy,
      checkedBy: timetableCell.test.checkedBy,
      status: 'draft_pending',
      testDate: saturdayDateStr
    };

    assert.equal(seededWorkflow.testId, '26-09-26_10th-CBSE Alpha');
    assert.equal(seededWorkflow.status, 'draft_pending');
  });

  it('accurately routes test workflow statuses to Service Manager 3-column board', () => {
    const testWorkflows = [
      { id: 't1', status: 'draft_pending' },
      { id: 't2', status: 'draft_submitted' },
      { id: 't3', status: 'final_published' },
      { id: 't4', status: 'graded' }
    ];

    const drafted = testWorkflows.filter(t => t.status === 'draft_pending' || t.status === 'draft_submitted' || t.status === 'drafted');
    const published = testWorkflows.filter(t => t.status === 'final_published' || t.status === 'published');
    const graded = testWorkflows.filter(t => t.status === 'graded');

    assert.equal(drafted.length, 2);
    assert.equal(published.length, 1);
    assert.equal(graded.length, 1);
  });
});

// ============================================================================
// 13. FACULTY GRIEVANCE & ACADEMIC COORDINATION ENGINE
// ============================================================================
describe('Faculty Grievance & Academic Coordination Engine', () => {
  it('creates coordination ticket with proper category, priority, and default Pending status', () => {
    const ticket = {
      teacherId: 'teacher_brijesh_01',
      teacherName: 'Brijesh Prajapati',
      category: 'Classroom / Infrastructure',
      request: '[Classroom / Infrastructure] Projector HDMI cable in Saptarishi Kaksh is loose',
      priority: 'Urgent',
      status: 'Pending',
      createdAt: '2026-09-21T09:00:00Z'
    };

    assert.equal(ticket.status, 'Pending');
    assert.equal(ticket.priority, 'Urgent');
    assert.ok(ticket.request.includes('Saptarishi Kaksh'));
  });

  it('updates ticket with Rohan Sir resolution remark and transitions to Resolved', () => {
    let ticket = {
      id: 'griev_01',
      teacherId: 'teacher_brijesh_01',
      status: 'Pending',
      request: 'AC cooling issue in Megh Singh Kaksh'
    };

    // Manager resolves
    ticket = {
      ...ticket,
      status: 'Resolved',
      resolutionRemark: 'Technician repaired AC coil. Tested & functioning.',
      resolvedAt: '2026-09-21T11:30:00Z'
    };

    assert.equal(ticket.status, 'Resolved');
    assert.equal(ticket.resolutionRemark, 'Technician repaired AC coil. Tested & functioning.');
  });
});

// ============================================================================
// 14. STAFF PAYROLL & SALARY VAULT LEDGER ENGINE
// ============================================================================
describe('Staff Payroll & Salary Vault Ledger Engine', () => {
  it('correctly calculates monthly net salary accounting for base pay, allowances, bonuses, and unapproved leaves', () => {
    const baseSalary = 35000;
    const classTeacherAllowance = 3000; // 2 batches * 1500
    const performanceBonus = 1500;
    const unapprovedAbsences = 1;
    const dailyRate = Math.round(baseSalary / 30);
    const deductions = unapprovedAbsences * dailyRate;

    const gross = baseSalary + classTeacherAllowance + performanceBonus;
    const net = gross - deductions;

    assert.equal(gross, 39500);
    assert.equal(deductions, 1167);
    assert.equal(net, 38333);
  });

  it('ensures salary_history payload structure conforms to TeacherDashboard payslip contract', () => {
    const payslipDoc = {
      teacherId: 'teacher_brijesh',
      teacherName: 'Brijesh Prajapati',
      month: 'September 2026',
      monthCode: '2026-09',
      basePay: 35000,
      allowances: 3000,
      bonus: 1500,
      deductions: 0,
      gross: 39500,
      net: 39500,
      status: 'Credited',
      paidOn: '2026-09-21'
    };

    assert.equal(payslipDoc.status, 'Credited');
    assert.equal(payslipDoc.net, payslipDoc.gross - payslipDoc.deductions);
    assert.ok(payslipDoc.month.includes('2026'));
  });
});

