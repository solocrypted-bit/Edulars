const demoUsers = [
  {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@edulars.com',
    role: 'admin'
  },
  {
    id: 'teacher-1',
    name: 'Mrs. Folashade Adebayo',
    email: 'teacher@edulars.com',
    role: 'teacher'
  },
  {
    id: 'student-1',
    name: 'Chinedu Okafor',
    email: 'student@edulars.com',
    role: 'student'
  },
  {
    id: 'parent-1',
    name: 'Mr. & Mrs. Okafor',
    email: 'parent@edulars.com',
    role: 'parent'
  }
];

const students = [
  { id: 'stu-101', name: 'Chinedu Okafor', className: 'SS2A', gradeLevel: 'SS2', parentName: 'Mr. & Mrs. Okafor', status: 'active' },
  { id: 'stu-102', name: 'Aisha Ibrahim', className: 'SS1B', gradeLevel: 'SS1', parentName: 'Mr. Ibrahim', status: 'active' },
  { id: 'stu-103', name: 'Tobi Adeyemi', className: 'JSS3A', gradeLevel: 'JSS3', parentName: 'Mrs. Adeyemi', status: 'active' }
];

const teachers = [
  { id: 'tch-201', name: 'Mrs. Folashade Adebayo', subject: 'Mathematics', classNames: ['SS1B', 'SS2A'], status: 'active' },
  { id: 'tch-202', name: 'Mr. Daniel Okafor', subject: 'English', classNames: ['JSS3A', 'SS2A'], status: 'active' },
  { id: 'tch-203', name: 'Mrs. Grace Eze', subject: 'Biology', classNames: ['SS1B'], status: 'active' }
];

const classes = [
  { id: 'cls-301', name: 'SS1B', formTeacher: 'Mrs. Folashade Adebayo', students: 32, section: 'Science' },
  { id: 'cls-302', name: 'SS2A', formTeacher: 'Mrs. Folashade Adebayo', students: 28, section: 'Commercial' },
  { id: 'cls-303', name: 'JSS3A', formTeacher: 'Mr. Daniel Okafor', students: 36, section: 'General' }
];

const grades = [
  { id: 'gr-401', studentId: 'stu-101', studentName: 'Chinedu Okafor', subject: 'Mathematics', assessment: 'Mid-term', score: 89, remark: 'Excellent' },
  { id: 'gr-402', studentId: 'stu-101', studentName: 'Chinedu Okafor', subject: 'English', assessment: 'Mid-term', score: 82, remark: 'Very good' },
  { id: 'gr-403', studentId: 'stu-102', studentName: 'Aisha Ibrahim', subject: 'Biology', assessment: 'Quiz', score: 91, remark: 'Outstanding' }
];

const lessonPlans = [
  { id: 'lp-501', teacherName: 'Mrs. Folashade Adebayo', subject: 'Mathematics', className: 'SS2A', topic: 'Quadratic Equations', status: 'Approved', week: 'Week 4' },
  { id: 'lp-502', teacherName: 'Mr. Daniel Okafor', subject: 'English', className: 'JSS3A', topic: 'Narrative Writing', status: 'Draft', week: 'Week 5' }
];

const attendance = [
  { id: 'att-601', studentName: 'Chinedu Okafor', className: 'SS2A', present: true, date: '2025-01-15' },
  { id: 'att-602', studentName: 'Aisha Ibrahim', className: 'SS1B', present: false, date: '2025-01-15' }
];

const assignments = [
  {
    id: 'asg-1301',
    title: 'Quadratic Equations Practice',
    subject: 'Mathematics',
    className: 'SS2A',
    teacher: 'Mrs. Folashade Adebayo',
    dueDate: '2026-11-20',
    description: 'Complete the assigned quadratic equation exercises.',
    status: 'active'
  }
];

const feeRecords = [
  { id: 'fee-701', studentName: 'Chinedu Okafor', term: 'First Term', amount: 45000, paid: 45000, balance: 0, status: 'Paid' },
  { id: 'fee-702', studentName: 'Aisha Ibrahim', term: 'First Term', amount: 45000, paid: 30000, balance: 15000, status: 'Partial' }
];

const announcements = [
  { id: 'ann-801', title: 'School Assembly', message: 'Assembly is scheduled for 8:00 AM on Monday.', date: '2025-01-20' },
  { id: 'ann-802', title: 'Parents Meeting', message: 'Parents are invited to the academic review meeting.', date: '2025-01-22' }
];

const libraryBooks = [
  { id: 'lib-901', title: 'Understanding Biology', author: 'K. O. Okafor', availableCopies: 3 },
  { id: 'lib-902', title: 'The Merchant of Venice', author: 'William Shakespeare', availableCopies: 2 }
];

const timetable = [
  { id: 'tt-1001', day: 'Monday', period: '1', className: 'SS2A', subject: 'Mathematics', teacher: 'Mrs. Folashade Adebayo' },
  { id: 'tt-1002', day: 'Tuesday', period: '2', className: 'SS1B', subject: 'Biology', teacher: 'Mrs. Grace Eze' }
];

const messages = [
  { id: 'msg-1101', sender: 'Teacher', subject: 'Exam Schedule', preview: 'The first exam paper will begin at 9:00 AM next Friday.' },
  { id: 'msg-1102', sender: 'Administrator', subject: 'Fee Update', preview: 'Your account has an outstanding balance of N15,000.' }
];

const settings = {
  schoolName: 'EDULARS Academy',
  academicYear: '2025/2026',
  term: 'First Term',
  language: 'English',
  timezone: 'Africa/Lagos'
};

const reports = [
  { id: 'rep-1201', name: 'Termly Summary', category: 'Academic', status: 'Generated' },
  { id: 'rep-1202', name: 'Fee Compliance', category: 'Finance', status: 'Pending' }
];

module.exports = {
  demoUsers,
  students,
  teachers,
  classes,
  grades,
  lessonPlans,
  attendance,
  assignments,
  feeRecords,
  announcements,
  libraryBooks,
  timetable,
  messages,
  settings,
  reports
};
