const mongoose = require('mongoose');

const { Schema } = mongoose;

function createModel(name, fields, options = {}) {
  const schema = new Schema(fields, {
    timestamps: true,
    strict: 'throw',
    ...options
  });

  return mongoose.models[name] || mongoose.model(name, schema);
}

const User = createModel('User', {
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, required: true, enum: ['admin', 'teacher', 'student', 'parent'] },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  emailVerified: { type: Boolean, default: true }
});

const AdminRegistration = createModel('AdminRegistration', {
  key: { type: String, required: true, unique: true, default: 'initial-admin' },
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  schoolName: { type: String, required: true, trim: true },
  schoolLogoData: { type: String, default: '', maxlength: 1400000 },
  verificationTokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
});

const Student = createModel('Student', {
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, default: null, index: true },
  parentUserId: { type: String, default: null, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, default: '', lowercase: true, trim: true },
  className: { type: String, required: true, index: true },
  gradeLevel: { type: String, required: true },
  parentName: { type: String, default: '' },
  parentEmail: { type: String, default: '', lowercase: true, trim: true },
  attendance: { type: Number, min: 0, max: 100, default: 0 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
});

const Teacher = createModel('Teacher', {
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, default: null, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  subject: { type: String, required: true },
  phone: { type: String, default: '' },
  qualification: { type: String, default: '' },
  experience: { type: Number, min: 0, default: 0 },
  classNames: { type: [String], default: [] },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
});

const ClassRecord = createModel('ClassRecord', {
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, unique: true, trim: true },
  grade: { type: String, default: '' },
  room: { type: String, default: '' },
  formTeacher: { type: String, default: '' },
  teacherId: { type: String, default: '' },
  teacherEmail: { type: String, default: '' },
  feeAmount: { type: Number, min: 0, default: 0 },
  students: { type: Number, min: 0, default: 0 },
  section: { type: String, default: '' }
});

const Grade = createModel('Grade', {
  id: { type: String, required: true, unique: true, index: true },
  studentId: { type: String, required: true, index: true },
  studentName: { type: String, required: true },
  className: { type: String, required: true, index: true },
  term: { type: String, default: '' },
  teacher: { type: String, default: '' },
  subject: { type: String, required: true },
  assessment: { type: String, required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  remark: { type: String, default: '' }
});

const LessonPlan = createModel('LessonPlan', {
  id: { type: String, required: true, unique: true, index: true },
  teacherName: { type: String, required: true },
  subject: { type: String, required: true },
  className: { type: String, required: true, index: true },
  teacherUserId: { type: String, default: null, index: true },
  topic: { type: String, required: true },
  title: { type: String, default: '' },
  date: { type: String, default: '' },
  duration: { type: String, default: '' },
  objectives: { type: String, default: '' },
  materials: { type: String, default: '' },
  content: { type: String, default: '' },
  status: { type: String, enum: ['Draft', 'Submitted', 'Approved', 'Rejected'], default: 'Draft' },
  week: { type: String, default: '' }
});

const Attendance = createModel('Attendance', {
  id: { type: String, required: true, unique: true, index: true },
  studentId: { type: String, required: true, index: true },
  studentName: { type: String, required: true },
  className: { type: String, required: true, index: true },
  present: { type: Boolean, required: true },
  date: { type: String, required: true, index: true },
  term: { type: String, default: '' },
  week: { type: Number, min: 1, default: 1 },
  weekday: { type: String, default: '' }
});

const Assignment = createModel('Assignment', {
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  subject: { type: String, required: true, trim: true, maxlength: 100 },
  className: { type: String, required: true, index: true },
  teacher: { type: String, required: true },
  teacherUserId: { type: String, required: true, index: true },
  dueDate: { type: String, required: true },
  description: { type: String, required: true, maxlength: 5000 },
  status: { type: String, enum: ['active', 'closed'], default: 'active' }
});

const AssignmentSubmission = createModel('AssignmentSubmission', {
  id: { type: String, required: true, unique: true, index: true },
  assignmentId: { type: String, required: true },
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  response: { type: String, required: true, maxlength: 10000 },
  submittedAt: { type: Date, required: true, default: Date.now },
  status: { type: String, enum: ['submitted', 'reviewed'], default: 'submitted' }
});
AssignmentSubmission.schema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

const FeeRecord = createModel('FeeRecord', {
  id: { type: String, required: true, unique: true, index: true },
  studentId: { type: String, required: true, index: true },
  studentName: { type: String, required: true },
  term: { type: String, required: true },
  classId: { type: String, default: '' },
  type: { type: String, default: 'Tuition' },
  dueDate: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0 },
  paid: { type: Number, min: 0, default: 0 },
  balance: { type: Number, min: 0, required: true },
  status: { type: String, enum: ['Paid', 'Partial', 'Unpaid'], required: true }
});

const Payment = createModel('Payment', {
  id: { type: String, required: true, unique: true, index: true },
  studentId: { type: String, required: true, index: true },
  feeId: { type: String, required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  reference: { type: String, required: true, unique: true },
  recordedBy: { type: String, required: true },
  date: { type: String, default: '' },
  method: { type: String, default: 'Manual' },
  type: { type: String, default: 'Tuition' }
});

const Invoice = createModel('Invoice', {
  id: { type: String, required: true, unique: true, index: true },
  studentId: { type: String, required: true, index: true },
  studentName: { type: String, required: true },
  parentName: { type: String, default: '' },
  parentEmail: { type: String, default: '' },
  className: { type: String, required: true },
  schoolName: { type: String, default: '' },
  issueDate: { type: String, required: true },
  feeLines: {
    type: [{
      feeId: { type: String, required: true },
      type: { type: String, required: true },
      amount: { type: Number, required: true, min: 0 },
      paid: { type: Number, required: true, min: 0 }
    }],
    required: true
  },
  totalAmount: { type: Number, required: true, min: 0 },
  amountPaid: { type: Number, required: true, min: 0 },
  amountDue: { type: Number, required: true, min: 0, default: 0 },
  snapshotKey: { type: String, required: true },
  paymentIds: { type: [String], default: [] },
  emailStatus: { type: String, enum: ['unconfigured', 'missing'], required: true }
});
Invoice.schema.index({ studentId: 1, snapshotKey: 1 }, { unique: true });

const Announcement = createModel('Announcement', {
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  date: { type: String, required: true },
  author: { type: String, default: '' },
  audience: { type: String, default: 'All' },
  priority: { type: String, enum: ['Normal', 'High'], default: 'Normal' }
});

const LibraryBook = createModel('LibraryBook', {
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  author: { type: String, required: true },
  category: { type: String, default: '' },
  copies: { type: Number, required: true, min: 0 },
  availableCopies: { type: Number, required: true, min: 0 }
});

const BorrowedBook = createModel('BorrowedBook', {
  id: { type: String, required: true, unique: true, index: true },
  bookId: { type: String, required: true, index: true },
  borrowerUserId: { type: String, required: true, index: true },
  borrower: { type: String, required: true },
  date: { type: String, required: true },
  returned: { type: Boolean, default: false }
});

const TimetableEntry = createModel('TimetableEntry', {
  id: { type: String, required: true, unique: true, index: true },
  day: { type: String, required: true },
  period: { type: String, required: true },
  className: { type: String, required: true, index: true },
  subject: { type: String, required: true },
  teacher: { type: String, required: true },
  time: { type: String, default: '' },
  room: { type: String, default: '' }
});

const Message = createModel('Message', {
  id: { type: String, required: true, unique: true, index: true },
  recipientUserId: { type: String, required: true, index: true },
  senderUserId: { type: String, default: null, index: true },
  sender: { type: String, required: true },
  subject: { type: String, required: true },
  preview: { type: String, required: true },
  content: { type: String, default: '' },
  unread: { type: Boolean, default: true },
  time: { type: String, default: '' }
});

const SchoolSettings = createModel('SchoolSettings', {
  key: { type: String, required: true, unique: true, default: 'global' },
  schoolName: { type: String, required: true },
  schoolLogoData: { type: String, default: '', maxlength: 1400000 },
  academicYear: { type: String, required: true },
  term: { type: String, required: true },
  language: { type: String, required: true },
  timezone: { type: String, required: true },
  emailNotifications: { type: Boolean, default: false },
  smsNotifications: { type: Boolean, default: false },
  onlinePayments: { type: Boolean, default: false },
  lateFeePenalty: { type: Boolean, default: false }
});

const Report = createModel('Report', {
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  status: { type: String, required: true }
});

module.exports = {
  User,
  AdminRegistration,
  Student,
  Teacher,
  ClassRecord,
  Grade,
  LessonPlan,
  Attendance,
  Assignment,
  AssignmentSubmission,
  FeeRecord,
  Payment,
  Invoice,
  Announcement,
  LibraryBook,
  BorrowedBook,
  TimetableEntry,
  Message,
  SchoolSettings,
  Report
};
