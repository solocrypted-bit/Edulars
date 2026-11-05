/**
 * @openapi
 * components:
 *   schemas:
 *     Student:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         name: { type: string }
 *         className: { type: string }
 *         gradeLevel: { type: string }
 *         parentName: { type: string }
 *         status: { type: string }
 *     Teacher:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         name: { type: string }
 *         subject: { type: string }
 *         classNames:
 *           type: array
 *           items: { type: string }
 *         status: { type: string }
 *     ClassRecord:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         name: { type: string }
 *         formTeacher: { type: string }
 *         students: { type: integer }
 *         section: { type: string }
 *     GradeRecord:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         studentId: { type: string }
 *         studentName: { type: string }
 *         subject: { type: string }
 *         assessment: { type: string }
 *         score: { type: number }
 *         remark: { type: string }
 *     FeeRecord:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         studentId: { type: string }
 *         studentName: { type: string }
 *         term: { type: string }
 *         amount: { type: number }
 *         paid: { type: number }
 *         balance: { type: number }
 *         status: { type: string }
 */
const { randomUUID } = require('node:crypto');
const express = require('express');
const { authenticate, authorize, asyncHandler } = require('../middleware/auth');
const { mongoose } = require('../config/db');
const {
  Student,
  Teacher,
  ClassRecord,
  Grade,
  LessonPlan,
  Attendance,
  Assignment,
  FeeRecord,
  Payment,
  Invoice,
  Announcement,
  LibraryBook,
  TimetableEntry,
  Message,
  SchoolSettings,
  Report
} = require('../models');
const { getVisibleStudents, getStudentDataFilter } = require('../services/access');

const router = express.Router();
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

function getLimit(req) {
  const requested = Number.parseInt(req.query.limit, 10);
  return Number.isInteger(requested) && requested > 0
    ? Math.min(requested, MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
}

function clean(record) {
  if (!record) return record;
  const { _id, __v, ...data } = record;
  return data;
}

async function list(Model, filter, req) {
  const records = await Model.find(filter)
    .sort({ createdAt: -1 })
    .limit(getLimit(req))
    .lean();
  return records.map(clean);
}

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * @openapi
 * /api/students:
 *   get:
 *     tags: [Directory]
 *     summary: List students visible to the authenticated user
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 500 }
 *     responses:
 *       200:
 *         description: A list of authorized student records
 */
router.get('/students', authenticate, authorize(['admin', 'teacher', 'student', 'parent']), asyncHandler(async (req, res) => {
  const students = await getVisibleStudents(req.user, getLimit(req));
  res.json(students.map(clean));
}));

/**
 * @openapi
 * /api/teachers:
 *   get:
 *     tags: [Directory]
 *     summary: List teachers
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Teacher records
 */
router.get('/teachers', authenticate, authorize(['admin', 'teacher', 'student', 'parent']), asyncHandler(async (req, res) => {
  res.json(await list(Teacher, {}, req));
}));

/**
 * @openapi
 * /api/classes:
 *   get:
 *     tags: [Directory]
 *     summary: List classes visible to the authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Class records
 */
router.get('/classes', authenticate, authorize(['admin', 'teacher', 'student', 'parent']), asyncHandler(async (req, res) => {
  let filter = {};
  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id }).lean();
    filter = { name: { $in: teacher ? teacher.classNames : [] } };
  } else if (req.user.role === 'student' || req.user.role === 'parent') {
    const students = await getVisibleStudents(req.user);
    filter = { name: { $in: students.map((student) => student.className) } };
  }
  res.json(await list(ClassRecord, filter, req));
}));

/**
 * @openapi
 * /api/academics/grades:
 *   get:
 *     tags: [Academics]
 *     summary: List grade records visible to the authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Authorized grade records
 */
router.get('/academics/grades', authenticate, authorize(['admin', 'teacher', 'student', 'parent']), asyncHandler(async (req, res) => {
  res.json(await list(Grade, await getStudentDataFilter(req.user), req));
}));

/**
 * @openapi
 * /api/academics/lesson-plans:
 *   get:
 *     tags: [Academics]
 *     summary: List lesson plans visible to the authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Authorized lesson plans
 */
router.get('/academics/lesson-plans', authenticate, authorize(['admin', 'teacher', 'student', 'parent']), asyncHandler(async (req, res) => {
  let filter = {};
  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id }).lean();
    filter = teacher
      ? { $or: [{ teacherUserId: req.user.id }, { teacherName: teacher.name }] }
      : { teacherUserId: null };
  } else if (req.user.role === 'student' || req.user.role === 'parent') {
    const students = await getVisibleStudents(req.user);
    filter = {
      className: { $in: students.map((student) => student.className) },
      status: 'Approved'
    };
  }
  res.json(await list(LessonPlan, filter, req));
}));

/**
 * @openapi
 * /api/academics/attendance:
 *   get:
 *     tags: [Academics]
 *     summary: List attendance records visible to the authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Authorized attendance records
 */
router.get('/academics/attendance', authenticate, authorize(['admin', 'teacher', 'student', 'parent']), asyncHandler(async (req, res) => {
  res.json(await list(Attendance, await getStudentDataFilter(req.user), req));
}));

/**
 * @openapi
 * /api/assignments:
 *   get:
 *     tags: [Assignments]
 *     summary: List assignments visible to the authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Authorized class assignments
 *   post:
 *     tags: [Assignments]
 *     summary: Publish an assignment for an assigned class
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, subject, className, dueDate, description]
 *             properties:
 *               title: { type: string, maxLength: 160 }
 *               subject: { type: string, maxLength: 100 }
 *               className: { type: string }
 *               dueDate: { type: string, format: date }
 *               description: { type: string, maxLength: 5000 }
 *     responses:
 *       201:
 *         description: Assignment created
 */
router.get('/assignments', authenticate, authorize(['admin', 'teacher', 'student', 'parent']), asyncHandler(async (req, res) => {
  let filter = { status: 'active' };
  if (req.user.role === 'teacher') {
    filter.teacherUserId = req.user.id;
  } else if (req.user.role === 'student' || req.user.role === 'parent') {
    const students = await getVisibleStudents(req.user);
    filter.className = { $in: students.map((student) => student.className) };
  }
  res.json(await list(Assignment, filter, req));
}));

router.post('/assignments', authenticate, authorize(['admin', 'teacher']), asyncHandler(async (req, res) => {
  const { title, subject, className, dueDate, description } = req.body || {};
  if (
    typeof title !== 'string' ||
    typeof subject !== 'string' ||
    typeof className !== 'string' ||
    typeof dueDate !== 'string' ||
    typeof description !== 'string' ||
    !title.trim() ||
    !subject.trim() ||
    !className.trim() ||
    !description.trim() ||
    !isValidDate(dueDate)
  ) {
    return res.status(400).json({ message: 'Valid title, subject, className, dueDate, and description are required' });
  }

  const teacher = req.user.role === 'teacher'
    ? await Teacher.findOne({ userId: req.user.id }).lean()
    : null;
  if (req.user.role === 'teacher' && (!teacher || !teacher.classNames.includes(className))) {
    return res.status(403).json({ message: 'You cannot publish assignments for this class' });
  }
  if (!await ClassRecord.exists({ name: className })) {
    return res.status(404).json({ message: 'Class was not found' });
  }

  const assignment = await Assignment.create({
    id: randomUUID(),
    title: title.trim(),
    subject: subject.trim(),
    className: className.trim(),
    teacher: req.user.name,
    teacherUserId: req.user.id,
    dueDate,
    description: description.trim(),
    status: 'active'
  });
  return res.status(201).json({ assignment: clean(assignment.toObject()) });
}));

/**
 * @openapi
 * /api/finance/fees:
 *   get:
 *     tags: [Finance]
 *     summary: List fee records visible to the authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Authorized fee records
 */
router.get('/finance/fees', authenticate, authorize(['admin', 'student', 'parent']), asyncHandler(async (req, res) => {
  res.json(await list(FeeRecord, await getStudentDataFilter(req.user), req));
}));

/**
 * @openapi
 * /api/finance/payments:
 *   get:
 *     tags: [Finance]
 *     summary: List payments visible to the authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Authorized payment records
 *   post:
 *     tags: [Finance]
 *     summary: Record a fee payment
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [studentId, feeId, amount]
 *             properties:
 *               studentId: { type: string }
 *               feeId: { type: string }
 *               amount: { type: number, minimum: 0, exclusiveMinimum: true }
 *               reference: { type: string }
 *     responses:
 *       201:
 *         description: Payment recorded and fee balance updated
 */
router.get('/finance/payments', authenticate, authorize(['admin', 'parent']), asyncHandler(async (req, res) => {
  const filter = req.user.role === 'admin'
    ? {}
    : await getStudentDataFilter(req.user);
  res.json(await list(Payment, filter, req));
}));

router.get('/finance/invoices', authenticate, authorize(['admin', 'parent']), asyncHandler(async (req, res) => {
  res.json(await list(Invoice, await getStudentDataFilter(req.user), req));
}));

router.post('/finance/payments', authenticate, authorize(['admin', 'parent']), asyncHandler(async (req, res) => {
  const { studentId, feeId, amount } = req.body || {};
  if (
    typeof studentId !== 'string' ||
    typeof feeId !== 'string' ||
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return res.status(400).json({ message: 'studentId, feeId, and a positive amount are required' });
  }

  if (req.user.role === 'parent') {
    const child = await Student.findOne({ id: studentId, parentUserId: req.user.id }).lean();
    if (!child) {
      return res.status(403).json({ message: 'You cannot record payment for this student' });
    }
  }

  const session = await mongoose.startSession();
  const paymentId = randomUUID();
  const reference = typeof req.body.reference === 'string' && req.body.reference.trim()
    ? req.body.reference.trim()
    : randomUUID();
  let payment;

  try {
    await session.withTransaction(async () => {
      const fee = await FeeRecord.findOne({ id: feeId, studentId }).session(session);
      if (!fee) {
        throw statusError('Fee record was not found for this student', 404);
      }
      if (amount > fee.balance) {
        throw statusError('Payment amount exceeds the outstanding fee balance', 409);
      }

      const remainingBalance = fee.balance - amount;
      const update = await FeeRecord.updateOne(
        { id: feeId, studentId, balance: { $gte: amount } },
        {
          $inc: { paid: amount, balance: -amount },
          $set: { status: remainingBalance === 0 ? 'Paid' : 'Partial' }
        },
        { session }
      );
      if (update.modifiedCount !== 1) {
        throw statusError('Fee balance changed; retry the payment', 409);
      }

      const [created] = await Payment.create([{
        id: paymentId,
        studentId,
        feeId,
        amount,
        reference,
        recordedBy: req.user.id
      }], { session });
      payment = clean(created.toObject());
    });
  } finally {
    await session.endSession();
  }

  return res.status(201).json({ message: 'Payment recorded', payment });
}));

const readRoutes = [
  ['/school-life/announcements', Announcement, ['admin', 'teacher', 'student', 'parent']],
  ['/school-life/library', LibraryBook, ['admin', 'teacher', 'student', 'parent']],
  ['/school-life/timetable', TimetableEntry, ['admin', 'teacher', 'student', 'parent']]
];

/**
 * @openapi
 * /api/school-life/announcements:
 *   get:
 *     tags: [SchoolLife]
 *     summary: List school announcements
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Announcement records
 * /api/school-life/library:
 *   get:
 *     tags: [SchoolLife]
 *     summary: List library books
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Library book records
 * /api/school-life/timetable:
 *   get:
 *     tags: [SchoolLife]
 *     summary: List timetable entries visible to the authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Authorized timetable entries
 */
for (const [path, Model, roles] of readRoutes) {
  router.get(path, authenticate, authorize(roles), asyncHandler(async (req, res) => {
    let filter = {};
    if (path === '/school-life/timetable' && req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ userId: req.user.id }).lean();
      filter = { className: { $in: teacher ? teacher.classNames : [] } };
    } else if (path === '/school-life/timetable' && ['student', 'parent'].includes(req.user.role)) {
      const students = await getVisibleStudents(req.user);
      filter = { className: { $in: students.map((student) => student.className) } };
    }
    res.json(await list(Model, filter, req));
  }));
}

/**
 * @openapi
 * /api/school-life/messages:
 *   get:
 *     tags: [SchoolLife]
 *     summary: List messages addressed to the authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: User messages
 */
router.get('/school-life/messages', authenticate, authorize(['admin', 'teacher', 'student', 'parent']), asyncHandler(async (req, res) => {
  const filter = req.user.role === 'admin'
    ? {}
    : { $or: [{ recipientUserId: req.user.id }, { senderUserId: req.user.id }] };
  res.json(await list(Message, filter, req));
}));

/**
 * @openapi
 * /api/settings:
 *   get:
 *     tags: [Settings]
 *     summary: Get school settings
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: School settings
 */
router.get('/settings', authenticate, authorize(['admin', 'teacher', 'student', 'parent']), asyncHandler(async (req, res) => {
  const settings = await SchoolSettings.findOne({ key: 'global' }).select('-schoolLogoData').lean();
  if (!settings) {
    return res.json({});
  }
  res.json(clean(settings));
}));

/**
 * @openapi
 * /api/reports:
 *   get:
 *     tags: [Reports]
 *     summary: List school reports
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Report records
 */
router.get('/reports', authenticate, authorize(['admin']), asyncHandler(async (req, res) => {
  res.json(await list(Report, {}, req));
}));

module.exports = router;
