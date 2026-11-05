const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const express = require('express');
const { authenticate, authorize, asyncHandler } = require('../middleware/auth');
const { mongoose } = require('../config/db');
const {
  User,
  Student,
  Teacher,
  ClassRecord,
  Grade,
  LessonPlan,
  Attendance,
  Assignment,
  AssignmentSubmission,
  FeeRecord,
  Announcement,
  Invoice,
  Payment,
  LibraryBook,
  BorrowedBook,
  TimetableEntry,
  Message,
  SchoolSettings
} = require('../models');

/**
 * @openapi
 * /api/users:
 *   post:
 *     tags: [Authentication]
 *     summary: Create a user account (administrator only)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 12 }
 *               role: { type: string, enum: [admin, teacher, student, parent] }
 *     responses:
 *       201: { description: Account created with a hashed password }
 *       400: { description: Invalid account fields }
 *       409: { description: Email is already registered }
 * /api/students:
 *   post:
 *     tags: [Directory]
 *     summary: Create a student and optionally a login account
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, classId]
 *             properties:
 *               name: { type: string }
 *               classId: { type: string }
 *               parent: { type: string }
 *               parentEmail: { type: string, format: email }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 12 }
 *     responses:
 *       201: { description: Student created }
 *       400: { description: Invalid student fields }
 * /api/students/{id}:
 *   put:
 *     tags: [Directory]
 *     summary: Update a student
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200: { description: Student updated }
 *       404: { description: Student not found }
 *   delete:
 *     tags: [Directory]
 *     summary: Deactivate a student and retain history
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Student deactivated }
 * /api/teachers:
 *   post:
 *     tags: [Directory]
 *     summary: Create a teacher and login account
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, subject, classNames]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 12 }
 *               subject: { type: string }
 *               classNames: { type: array, items: { type: string } }
 *     responses:
 *       201: { description: Teacher and account created }
 * /api/teachers/{id}:
 *   put:
 *     tags: [Directory]
 *     summary: Update a teacher and class assignments
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200: { description: Teacher updated }
 *   delete:
 *     tags: [Directory]
 *     summary: Deactivate a teacher and retain history
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Teacher deactivated }
 * /api/classes:
 *   post:
 *     tags: [Directory]
 *     summary: Create a class
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [name], properties: { name: { type: string }, room: { type: string }, teacherId: { type: string } } }
 *     responses:
 *       201: { description: Class created }
 * /api/classes/{id}:
 *   put:
 *     tags: [Directory]
 *     summary: Update a class
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [name], properties: { name: { type: string }, room: { type: string }, teacherId: { type: string } } }
 *     responses:
 *       200: { description: Class updated }
 *   delete:
 *     tags: [Directory]
 *     summary: Remove an unoccupied class
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Class removed }
 *       409: { description: Active students are still enrolled }
 * /api/classes/{id}/fee:
 *   patch:
 *     tags: [Finance]
 *     summary: Set class tuition and update student fee accounts
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [amount], properties: { amount: { type: number, minimum: 0 } } }
 *     responses:
 *       200: { description: Fee schedule and student fee accounts updated }
 * /api/finance/invoices:
 *   get:
 *     tags: [Finance]
 *     summary: List invoices visible to the authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Authorized invoice records }
 *   post:
 *     tags: [Finance]
 *     summary: Generate a persistent invoice for fully paid fees
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [studentId], properties: { studentId: { type: string } } }
 *     responses:
 *       201: { description: Invoice created or existing invoice returned }
 *       409: { description: Fee accounts are not fully paid }
 * /api/academics/grades:
 *   post:
 *     tags: [Academics]
 *     summary: Record a student grade
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [studentId, subject, assessment, score], properties: { studentId: { type: string }, subject: { type: string }, assessment: { type: string }, score: { type: number, minimum: 0, maximum: 100 }, term: { type: string }, remark: { type: string } } }
 *     responses:
 *       201: { description: Grade saved }
 * /api/academics/attendance:
 *   post:
 *     tags: [Academics]
 *     summary: Record or update attendance for one student and date
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [studentId, date, present], properties: { studentId: { type: string }, date: { type: string, format: date }, present: { type: boolean }, term: { type: string }, week: { type: integer }, weekday: { type: string } } }
 *     responses:
 *       200: { description: Attendance saved }
 * /api/academics/lesson-plans:
 *   post:
 *     tags: [Academics]
 *     summary: Create a lesson plan
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [subject, topic, className], properties: { subject: { type: string }, topic: { type: string }, className: { type: string }, date: { type: string, format: date }, content: { type: string } } }
 *     responses:
 *       201: { description: Lesson plan saved as a draft }
 * /api/academics/lesson-plans/{id}:
 *   put:
 *     tags: [Academics]
 *     summary: Update, submit, or review a lesson plan
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { subject: { type: string }, topic: { type: string }, className: { type: string }, content: { type: string }, status: { type: string, enum: [Draft, Submitted, Approved, Rejected] } } }
 *     responses:
 *       200: { description: Lesson plan updated }
 * /api/assignment-submissions:
 *   get:
 *     tags: [Assignments]
 *     summary: List submissions visible to the authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Assignment submissions }
 *   post:
 *     tags: [Assignments]
 *     summary: Submit or update a student's assignment response
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [assignmentId, response], properties: { assignmentId: { type: string }, response: { type: string, maxLength: 10000 } } }
 *     responses:
 *       201: { description: Submission saved }
 * /api/school-life/announcements:
 *   post:
 *     tags: [SchoolLife]
 *     summary: Publish an announcement
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [title, content], properties: { title: { type: string }, content: { type: string }, audience: { type: string }, priority: { type: string } } }
 *     responses:
 *       201: { description: Announcement published }
 * /api/school-life/library:
 *   post:
 *     tags: [SchoolLife]
 *     summary: Add a library book
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [title, author, copies], properties: { title: { type: string }, author: { type: string }, category: { type: string }, copies: { type: integer, minimum: 0 } } }
 *     responses:
 *       201: { description: Book added }
 * /api/school-life/library/borrowed:
 *   get:
 *     tags: [SchoolLife]
 *     summary: List book loans visible to the authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Borrowed books }
 * /api/school-life/library/{id}/borrow:
 *   post:
 *     tags: [SchoolLife]
 *     summary: Borrow an available book
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       201: { description: Book borrowed }
 *       409: { description: No copies are available }
 * /api/school-life/library/returns/{id}:
 *   post:
 *     tags: [SchoolLife]
 *     summary: Return a borrowed book
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Book returned }
 * /api/school-life/timetable:
 *   post:
 *     tags: [SchoolLife]
 *     summary: Add a timetable period
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [day, period, className, subject, teacher], properties: { day: { type: string }, period: { type: string }, className: { type: string }, subject: { type: string }, teacher: { type: string }, time: { type: string }, room: { type: string } } }
 *     responses:
 *       201: { description: Timetable entry created }
 * /api/school-life/messages:
 *   post:
 *     tags: [SchoolLife]
 *     summary: Send a message
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [recipientUserId, subject, content], properties: { recipientUserId: { type: string }, subject: { type: string }, content: { type: string } } }
 *     responses:
 *       201: { description: Message saved }
 * /api/settings:
 *   put:
 *     tags: [Settings]
 *     summary: Update school settings
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [schoolName, academicYear], properties: { schoolName: { type: string }, academicYear: { type: string }, emailNotifications: { type: boolean }, smsNotifications: { type: boolean }, onlinePayments: { type: boolean }, lateFeePenalty: { type: boolean } } }
 *     responses:
 *       200: { description: Settings updated }
 */
const router = express.Router();

function clean(record) {
  if (!record) return record;
  const { _id, __v, ...data } = record;
  return data;
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  return error;
}

async function findClassOrFail(classId) {
  const classroom = await ClassRecord.findOne({ id: classId }).lean();
  if (!classroom) throw notFound('Class was not found');
  return classroom;
}

router.post('/users', authenticate, authorize(['admin']), asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (
    typeof name !== 'string' || !name.trim() ||
    typeof email !== 'string' || !email.trim() ||
    typeof password !== 'string' || password.length < 12 ||
    !['admin', 'teacher', 'student', 'parent'].includes(role)
  ) {
    throw badRequest('Name, email, a password of at least 12 characters, and a valid role are required');
  }
  const user = await User.create({
    id: randomUUID(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    role,
    status: 'active'
  });
  return res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
}));

router.post('/students', authenticate, authorize(['admin']), asyncHandler(async (req, res) => {
  const { name, classId, parent, parentEmail, email, password } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || typeof classId !== 'string') {
    throw badRequest('Student name and classId are required');
  }
  const classroom = await findClassOrFail(classId);
  let userId = null;
  let passwordHash = null;
  if (email || password) {
    if (typeof email !== 'string' || typeof password !== 'string' || password.length < 12) {
      throw badRequest('Student login requires an email and a password of at least 12 characters');
    }
    userId = randomUUID();
    passwordHash = await bcrypt.hash(password, 12);
  }
  const parentUser = typeof parentEmail === 'string' && parentEmail.trim()
    ? await User.findOne({ email: parentEmail.trim().toLowerCase(), role: 'parent' }).lean()
    : null;
  const session = await mongoose.startSession();
  let student;
  try {
    await session.withTransaction(async () => {
      if (userId) {
        await User.create([{
          id: userId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          passwordHash,
          role: 'student'
        }], { session });
      }
      const created = await Student.create([{
        id: randomUUID(),
        userId,
        parentUserId: parentUser ? parentUser.id : null,
        name: name.trim(),
        email: email ? email.trim().toLowerCase() : '',
        className: classroom.name,
        gradeLevel: classroom.grade || classroom.name,
        parentName: typeof parent === 'string' ? parent.trim() : '',
        parentEmail: typeof parentEmail === 'string' ? parentEmail.trim().toLowerCase() : '',
        status: 'active'
      }], { session });
      student = created[0];
      if (Number(classroom.feeAmount || 0) > 0) {
        await FeeRecord.create([{
          id: randomUUID(),
          studentId: student.id,
          studentName: student.name,
          classId: classroom.id,
          type: 'Tuition',
          term: 'Current Term',
          amount: classroom.feeAmount,
          paid: 0,
          balance: classroom.feeAmount,
          status: 'Unpaid'
        }], { session });
      }
    });
  } finally {
    await session.endSession();
  }
  return res.status(201).json({ student: clean(student.toObject()) });
}));

router.put('/students/:id', authenticate, authorize(['admin']), asyncHandler(async (req, res) => {
  const { name, classId, parent, parentEmail, email, status, attendance } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || typeof classId !== 'string') {
    throw badRequest('Student name and classId are required');
  }
  const classroom = await findClassOrFail(classId);
  const parentUser = typeof parentEmail === 'string' && parentEmail.trim()
    ? await User.findOne({ email: parentEmail.trim().toLowerCase(), role: 'parent' }).lean()
    : null;
  const student = await Student.findOneAndUpdate(
    { id: req.params.id },
    {
      $set: {
        name: name.trim(),
        email: typeof email === 'string' ? email.trim().toLowerCase() : '',
        className: classroom.name,
        gradeLevel: classroom.grade || classroom.name,
        parentName: typeof parent === 'string' ? parent.trim() : '',
        parentEmail: typeof parentEmail === 'string' ? parentEmail.trim().toLowerCase() : '',
        parentUserId: parentUser ? parentUser.id : null,
        status: status === 'Inactive' || status === 'inactive' ? 'inactive' : 'active',
        attendance: Number.isFinite(Number(attendance)) ? Number(attendance) : 0
      }
    },
    { new: true, runValidators: true }
  ).lean();
  if (!student) throw notFound('Student was not found');
  if (student.userId) {
    await User.updateOne(
      { id: student.userId },
      { $set: { name: name.trim(), ...(typeof email === 'string' && email.trim() ? { email: email.trim().toLowerCase() } : {}) } }
    );
  }
  const tuition = await FeeRecord.findOne({ studentId: student.id, type: 'Tuition' }).sort({ createdAt: 1 });
  const amount = Number(classroom.feeAmount || 0);
  if (tuition) {
    tuition.studentName = student.name;
    tuition.classId = classroom.id;
    tuition.amount = amount;
    tuition.balance = Math.max(0, amount - tuition.paid);
    tuition.status = tuition.balance === 0 ? 'Paid' : tuition.paid > 0 ? 'Partial' : 'Unpaid';
    await tuition.save();
  } else if (amount > 0) {
    await FeeRecord.create({
      id: randomUUID(),
      studentId: student.id,
      studentName: student.name,
      classId: classroom.id,
      type: 'Tuition',
      term: 'Current Term',
      amount,
      paid: 0,
      balance: amount,
      status: 'Unpaid'
    });
  }
  return res.json({ student: clean(student) });
}));

router.delete('/students/:id', authenticate, authorize(['admin']), asyncHandler(async (req, res) => {
  const student = await Student.findOneAndUpdate({ id: req.params.id }, { $set: { status: 'inactive' } }, { new: true }).lean();
  if (!student) throw notFound('Student was not found');
  if (student.userId) await User.updateOne({ id: student.userId }, { $set: { status: 'inactive' } });
  return res.json({ message: 'Student deactivated' });
}));

router.post('/teachers', authenticate, authorize(['admin']), asyncHandler(async (req, res) => {
  const { name, email, password, subject, phone, qualification, classNames = [] } = req.body || {};
  if (
    typeof name !== 'string' || !name.trim() ||
    typeof email !== 'string' || !email.trim() ||
    typeof password !== 'string' || password.length < 12 ||
    typeof subject !== 'string' || !subject.trim() ||
    !Array.isArray(classNames) || !classNames.every(item => typeof item === 'string')
  ) {
    throw badRequest('Name, email, subject, classNames, and a password of at least 12 characters are required');
  }
  const classes = classNames.length ? await ClassRecord.find({ name: { $in: classNames } }).lean() : [];
  if (classes.length !== new Set(classNames).size) throw badRequest('One or more selected classes do not exist');
  if (classes.some(classroom => classroom.teacherId || classroom.teacherEmail || classroom.formTeacher)) {
    throw Object.assign(new Error('One or more selected classes already have a class teacher'), { status: 409 });
  }
  const session = await mongoose.startSession();
  let teacher;
  try {
    await session.withTransaction(async () => {
      const user = await User.create([{
        id: randomUUID(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: await bcrypt.hash(password, 12),
        role: 'teacher'
      }], { session });
      const created = await Teacher.create([{
        id: randomUUID(),
        userId: user[0].id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        phone: typeof phone === 'string' ? phone.trim() : '',
        qualification: typeof qualification === 'string' ? qualification.trim() : '',
        classNames
      }], { session });
      teacher = clean(created[0].toObject());
      await ClassRecord.updateMany(
        { name: { $in: classNames } },
        { $set: { formTeacher: teacher.name, teacherId: teacher.id, teacherEmail: teacher.email } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
  return res.status(201).json({ teacher });
}));

router.put('/teachers/:id', authenticate, authorize(['admin']), asyncHandler(async (req, res) => {
  const { name, email, subject, phone, qualification, classNames = [] } = req.body || {};
  if (
    typeof name !== 'string' || !name.trim() ||
    typeof email !== 'string' || !email.trim() ||
    typeof subject !== 'string' || !subject.trim() ||
    !Array.isArray(classNames) || !classNames.every(item => typeof item === 'string')
  ) {
    throw badRequest('Name, email, subject, and valid classNames are required');
  }
  const classes = classNames.length ? await ClassRecord.find({ name: { $in: classNames } }).lean() : [];
  if (classes.length !== new Set(classNames).size) throw badRequest('One or more selected classes do not exist');
  const teacher = await Teacher.findOne({ id: req.params.id });
  if (!teacher) throw notFound('Teacher was not found');
  if (classes.some(classroom => classroom.teacherId && classroom.teacherId !== teacher.id)) {
    throw Object.assign(new Error('One or more selected classes already have another class teacher'), { status: 409 });
  }
  teacher.name = name.trim();
  teacher.email = email.trim().toLowerCase();
  teacher.subject = subject.trim();
  teacher.phone = typeof phone === 'string' ? phone.trim() : '';
  teacher.qualification = typeof qualification === 'string' ? qualification.trim() : '';
  teacher.classNames = classNames;
  await teacher.save();
  if (teacher.userId) {
    await User.updateOne({ id: teacher.userId }, { $set: { name: teacher.name, email: teacher.email } });
  }
  await ClassRecord.updateMany(
    { teacherId: teacher.id, name: { $nin: classNames } },
    { $set: { teacherId: '', teacherEmail: '', formTeacher: '' } }
  );
  await ClassRecord.updateMany(
    { name: { $in: classNames } },
    { $set: { teacherId: teacher.id, teacherEmail: teacher.email, formTeacher: teacher.name } }
  );
  return res.json({ teacher: clean(teacher.toObject()) });
}));

router.delete('/teachers/:id', authenticate, authorize(['admin']), asyncHandler(async (req, res) => {
  const teacher = await Teacher.findOneAndUpdate({ id: req.params.id }, { $set: { status: 'inactive' } }, { new: true }).lean();
  if (!teacher) throw notFound('Teacher was not found');
  if (teacher.userId) await User.updateOne({ id: teacher.userId }, { $set: { status: 'inactive' } });
  await ClassRecord.updateMany({ teacherId: teacher.id }, { $set: { teacherId: '', teacherEmail: '', formTeacher: '' } });
  return res.json({ message: 'Teacher deactivated' });
}));

router.post('/classes', authenticate, authorize(['admin']), asyncHandler(async (req, res) => {
  const { name, room, teacherId } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) throw badRequest('Class name is required');
  const teacher = teacherId ? await Teacher.findOne({ id: teacherId }).lean() : null;
  if (teacherId && !teacher) throw notFound('Teacher was not found');
  const parsed = name.trim().match(/^(.*?)(?:\s+([A-Za-z0-9]+))?$/);
  const classroom = await ClassRecord.create({
    id: randomUUID(),
    name: name.trim(),
    grade: parsed ? parsed[1] : name.trim(),
    section: parsed?.[2] || '',
    room: typeof room === 'string' ? room.trim() : '',
    teacherId: teacher?.id || '',
    teacherEmail: teacher?.email || '',
    formTeacher: teacher?.name || ''
  });
  if (teacher) {
    await Teacher.updateOne({ id: teacher.id }, { $addToSet: { classNames: classroom.name } });
  }
  return res.status(201).json({ classroom: clean(classroom.toObject()) });
}));

router.put('/classes/:id', authenticate, authorize(['admin']), asyncHandler(async (req, res) => {
  const { name, room, teacherId } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) throw badRequest('Class name is required');
  const current = await ClassRecord.findOne({ id: req.params.id });
  if (!current) throw notFound('Class was not found');
  const previousName = current.name;
  const teacher = teacherId ? await Teacher.findOne({ id: teacherId }).lean() : null;
  if (teacherId && !teacher) throw notFound('Teacher was not found');
  const parsed = name.trim().match(/^(.*?)(?:\s+([A-Za-z0-9]+))?$/);
  current.name = name.trim();
  current.grade = parsed ? parsed[1] : name.trim();
  current.section = parsed?.[2] || '';
  current.room = typeof room === 'string' ? room.trim() : '';
  current.teacherId = teacher?.id || '';
  current.teacherEmail = teacher?.email || '';
  current.formTeacher = teacher?.name || '';
  await current.save();
  await Student.updateMany(
    { className: previousName },
    { $set: { className: current.name, gradeLevel: current.grade } }
  );
  await Teacher.updateMany({ classNames: previousName }, { $pull: { classNames: previousName } });
  if (teacher) await Teacher.updateOne({ id: teacher.id }, { $addToSet: { classNames: current.name } });
  return res.json({ classroom: clean(current.toObject()) });
}));

router.delete('/classes/:id', authenticate, authorize(['admin']), asyncHandler(async (req, res) => {
  const classroom = await ClassRecord.findOne({ id: req.params.id }).lean();
  if (!classroom) throw notFound('Class was not found');
  if (await Student.exists({ className: classroom.name, status: 'active' })) {
    throw Object.assign(new Error('Move or deactivate enrolled students before removing this class'), { status: 409 });
  }
  await ClassRecord.deleteOne({ id: classroom.id });
  await Teacher.updateMany({ classNames: classroom.name }, { $pull: { classNames: classroom.name } });
  return res.json({ message: 'Class removed' });
}));

router.patch('/classes/:id/fee', authenticate, authorize(['admin']), asyncHandler(async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount < 0) throw badRequest('Fee amount must be a non-negative number');
  const session = await mongoose.startSession();
  let classroom;
  let updatedFeeAccounts = 0;
  try {
    await session.withTransaction(async () => {
      classroom = await ClassRecord.findOneAndUpdate(
        { id: req.params.id },
        { $set: { feeAmount: amount } },
        { new: true, runValidators: true, session }
      ).lean();
      if (!classroom) throw notFound('Class was not found');
      const students = await Student.find({ className: classroom.name, status: 'active' }).session(session).lean();
      updatedFeeAccounts = students.length;
      for (const student of students) {
        const existing = await FeeRecord.findOne({
          studentId: student.id,
          classId: classroom.id,
          term: 'Current Term'
        }).session(session);
        const paid = existing ? existing.paid : 0;
        const balance = Math.max(0, amount - paid);
        await FeeRecord.updateOne(
          { studentId: student.id, classId: classroom.id, term: 'Current Term' },
          {
            $set: {
              id: existing ? existing.id : randomUUID(),
              studentId: student.id,
              studentName: student.name,
              classId: classroom.id,
              type: 'Tuition',
              term: 'Current Term',
              amount,
              paid,
              balance,
              status: balance === 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid'
            }
          },
          { upsert: true, session, runValidators: true }
        );
      }
    });
  } finally {
    await session.endSession();
  }
  return res.json({ classroom, updatedFeeAccounts });
}));

router.post('/finance/invoices', authenticate, authorize(['admin', 'parent']), asyncHandler(async (req, res) => {
  const { studentId } = req.body || {};
  if (typeof studentId !== 'string' || !studentId) throw badRequest('studentId is required');
  const student = await Student.findOne({ id: studentId, status: 'active' }).lean();
  if (!student) throw notFound('Student was not found');
  if (req.user.role === 'parent' && student.parentUserId !== req.user.id) {
    throw Object.assign(new Error('You cannot generate an invoice for this student'), { status: 403 });
  }
  const fees = await FeeRecord.find({ studentId: student.id }).sort({ id: 1 }).lean();
  if (!fees.length || fees.some(fee => fee.balance > 0)) {
    throw Object.assign(new Error('An invoice is available after all fee accounts are paid'), { status: 409 });
  }
  const feeLines = fees.map(fee => ({
    feeId: fee.id,
    type: fee.type,
    amount: fee.amount,
    paid: fee.paid
  }));
  const snapshotKey = JSON.stringify(feeLines);
  const payments = await Payment.find({ studentId: student.id }).select('id').lean();
  const settings = await SchoolSettings.findOne({ key: 'global' }).select('schoolName').lean();
  const invoice = await Invoice.findOneAndUpdate(
    { studentId: student.id, snapshotKey },
    {
      $setOnInsert: {
        id: randomUUID(),
        studentId: student.id,
        studentName: student.name,
        parentName: student.parentName,
        parentEmail: student.parentEmail,
        className: student.className,
        schoolName: settings?.schoolName || '',
        issueDate: new Date().toISOString().slice(0, 10),
        feeLines,
        totalAmount: feeLines.reduce((sum, fee) => sum + fee.amount, 0),
        amountPaid: feeLines.reduce((sum, fee) => sum + fee.paid, 0),
        amountDue: 0,
        snapshotKey,
        paymentIds: payments.map(payment => payment.id),
        emailStatus: student.parentEmail ? 'unconfigured' : 'missing'
      }
    },
    { new: true, upsert: true, runValidators: true }
  ).lean();
  return res.status(201).json({ invoice: clean(invoice) });
}));

router.get('/assignment-submissions', authenticate, authorize(['admin', 'teacher', 'student']), asyncHandler(async (req, res) => {
  let filter = {};
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user.id, status: 'active' }).lean();
    filter = { studentId: student ? student.id : null };
  } else if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id }).lean();
    const assignments = await Assignment.find({
      className: { $in: teacher ? teacher.classNames : [] }
    }).select('id').lean();
    filter = { assignmentId: { $in: assignments.map(assignment => assignment.id) } };
  }
  const submissions = await AssignmentSubmission.find(filter).sort({ submittedAt: -1 }).limit(500).lean();
  return res.json(submissions.map(clean));
}));

router.post('/assignment-submissions', authenticate, authorize(['student']), asyncHandler(async (req, res) => {
  const { assignmentId, response } = req.body || {};
  if (typeof assignmentId !== 'string' || typeof response !== 'string' || !response.trim() || response.length > 10000) {
    throw badRequest('assignmentId and a response of 1 to 10000 characters are required');
  }
  const student = await Student.findOne({ userId: req.user.id, status: 'active' }).lean();
  if (!student) throw notFound('Student profile was not found');
  const assignment = await Assignment.findOne({
    id: assignmentId,
    className: student.className,
    status: 'active'
  }).lean();
  if (!assignment) throw notFound('Active assignment was not found for your class');
  const submission = await AssignmentSubmission.findOneAndUpdate(
    { assignmentId: assignment.id, studentId: student.id },
    {
      $set: { response: response.trim(), submittedAt: new Date(), status: 'submitted' },
      $setOnInsert: {
        id: randomUUID(),
        assignmentId: assignment.id,
        studentId: student.id,
        studentName: student.name
      }
    },
    { new: true, upsert: true, runValidators: true }
  ).lean();
  return res.status(201).json({ submission: clean(submission) });
}));

router.post('/academics/grades', authenticate, authorize(['admin', 'teacher']), asyncHandler(async (req, res) => {
  const { studentId, subject, score, assessment, term = '', remark = '' } = req.body || {};
  if (typeof studentId !== 'string' || typeof subject !== 'string' || !subject.trim() ||
      typeof assessment !== 'string' || !assessment.trim() ||
      typeof score !== 'number' || score < 0 || score > 100) {
    throw badRequest('studentId, subject, assessment, and a score from 0 to 100 are required');
  }
  const student = await Student.findOne({ id: studentId, status: 'active' }).lean();
  if (!student) throw notFound('Student was not found');
  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id }).lean();
    if (!teacher || !teacher.classNames.includes(student.className)) {
      throw Object.assign(new Error('You cannot grade this student'), { status: 403 });
    }
  }
  const grade = await Grade.create({
    id: randomUUID(),
    studentId: student.id,
    studentName: student.name,
    className: student.className,
    teacher: req.user.name,
    subject: subject.trim(),
    term: typeof term === 'string' ? term.trim() : '',
    assessment: assessment.trim(),
    score,
    remark: typeof remark === 'string' ? remark.trim() : ''
  });
  return res.status(201).json({ grade: clean(grade.toObject()) });
}));

router.post('/academics/attendance', authenticate, authorize(['admin', 'teacher']), asyncHandler(async (req, res) => {
  const { studentId, date, present, term = '', week = 1, weekday = '' } = req.body || {};
  if (typeof studentId !== 'string' || typeof date !== 'string' || typeof present !== 'boolean') {
    throw badRequest('studentId, date, and present are required');
  }
  const student = await Student.findOne({ id: studentId, status: 'active' }).lean();
  if (!student) throw notFound('Student was not found');
  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id }).lean();
    if (!teacher || !teacher.classNames.includes(student.className)) {
      throw Object.assign(new Error('You cannot record attendance for this student'), { status: 403 });
    }
  }
  const record = await Attendance.findOneAndUpdate(
    { studentId, date },
    {
      $set: {
        id: randomUUID(),
        studentName: student.name,
        className: student.className,
        present,
        term: String(term),
        week: Number(week) || 1,
        weekday: String(weekday)
      }
    },
    { new: true, upsert: true, runValidators: true }
  ).lean();
  return res.json({ attendance: clean(record) });
}));

router.post('/academics/lesson-plans', authenticate, authorize(['admin', 'teacher']), asyncHandler(async (req, res) => {
  const { subject, topic, title, className, date, duration, objectives, materials, content = '', status = 'Draft' } = req.body || {};
  if (typeof subject !== 'string' || !subject.trim() ||
      typeof (topic || title) !== 'string' || !(topic || title).trim() ||
      typeof className !== 'string' || !className.trim()) {
    throw badRequest('Subject, topic, and className are required');
  }
  const classroom = await ClassRecord.findOne({ name: className.trim() }).lean();
  if (!classroom) throw notFound('Class was not found');
  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id }).lean();
    if (!teacher || !teacher.classNames.includes(classroom.name)) {
      throw Object.assign(new Error('You cannot create a lesson plan for this class'), { status: 403 });
    }
  }
  const plan = await LessonPlan.create({
    id: randomUUID(),
    teacherName: req.user.name,
    teacherUserId: req.user.id,
    subject: subject.trim(),
    className: classroom.name,
    topic: (topic || title).trim(),
    title: (title || topic).trim(),
    date: typeof date === 'string' ? date : '',
    duration: typeof duration === 'string' ? duration : '',
    objectives: typeof objectives === 'string' ? objectives : '',
    materials: typeof materials === 'string' ? materials : '',
    content: typeof content === 'string' ? content : '',
    status: req.user.role === 'teacher' ? 'Draft' : status
  });
  return res.status(201).json({ lessonPlan: clean(plan.toObject()) });
}));

router.put('/academics/lesson-plans/:id', authenticate, authorize(['admin', 'teacher']), asyncHandler(async (req, res) => {
  const plan = await LessonPlan.findOne({ id: req.params.id });
  if (!plan) throw notFound('Lesson plan was not found');
  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id }).lean();
    if (!teacher || !teacher.classNames.includes(plan.className) ||
        (plan.teacherUserId !== req.user.id && plan.teacherName !== req.user.name)) {
      throw Object.assign(new Error('You cannot update this lesson plan'), { status: 403 });
    }
  }
  if (req.user.role === 'teacher' && req.body?.status && !['Draft', 'Submitted'].includes(req.body.status)) {
    throw badRequest('Teachers can only save lesson plans as drafts or submit them for review');
  }
  if (req.user.role === 'teacher' && typeof req.body?.className === 'string') {
    const teacher = await Teacher.findOne({ userId: req.user.id }).lean();
    if (!teacher || !teacher.classNames.includes(req.body.className)) {
      throw Object.assign(new Error('You can only assign lesson plans to your classes'), { status: 403 });
    }
  }
  const fields = ['subject', 'topic', 'title', 'className', 'date', 'duration', 'objectives', 'materials', 'content', 'status'];
  for (const field of fields) {
    if (Object.hasOwn(req.body || {}, field)) {
      const schemaField = field === 'className' ? 'className' : field;
      plan[schemaField] = req.body[field];
    }
  }
  if (req.body?.topic && !req.body.title) plan.title = req.body.topic;
  if (req.body?.title && !req.body.topic) plan.topic = req.body.title;
  await plan.save();
  return res.json({ lessonPlan: clean(plan.toObject()) });
}));

router.post('/school-life/announcements', authenticate, authorize(['admin', 'teacher']), asyncHandler(async (req, res) => {
  const { title, content, message, audience = 'All', priority = 'Normal' } = req.body || {};
  const body = content || message;
  if (typeof title !== 'string' || !title.trim() || typeof body !== 'string' || !body.trim()) {
    throw badRequest('Announcement title and content are required');
  }
  const announcement = await Announcement.create({
    id: randomUUID(),
    title: title.trim(),
    message: body.trim(),
    date: new Date().toISOString().slice(0, 10),
    author: req.user.name,
    audience: String(audience),
    priority: priority === 'High' ? 'High' : 'Normal'
  });
  return res.status(201).json({ announcement: clean(announcement.toObject()) });
}));

router.put('/settings', authenticate, authorize(['admin']), asyncHandler(async (req, res) => {
  const allowed = ['schoolName', 'academicYear', 'term', 'language', 'timezone', 'emailNotifications', 'smsNotifications', 'onlinePayments', 'lateFeePenalty'];
  const values = {};
  for (const key of allowed) {
    if (Object.hasOwn(req.body || {}, key)) values[key] = req.body[key];
  }
  if (typeof values.schoolName !== 'string' || !values.schoolName.trim() ||
      typeof values.academicYear !== 'string' || !values.academicYear.trim()) {
    throw badRequest('School name and academic year are required');
  }
  const previous = await SchoolSettings.findOne({ key: 'global' }).select('term language timezone').lean();
  const settings = await SchoolSettings.findOneAndUpdate(
    { key: 'global' },
    {
      $set: {
        key: 'global',
        ...values,
        schoolName: values.schoolName.trim(),
        academicYear: values.academicYear.trim(),
        term: previous?.term || 'First Term',
        language: previous?.language || 'English',
        timezone: previous?.timezone || 'Africa/Lagos'
      }
    },
    { new: true, upsert: true, runValidators: true }
  ).lean();
  return res.json({ settings: clean(settings) });
}));

router.post('/school-life/library', authenticate, authorize(['admin']), asyncHandler(async (req, res) => {
  const { title, author, category = '', copies } = req.body || {};
  if (typeof title !== 'string' || !title.trim() || typeof author !== 'string' || !author.trim() ||
      !Number.isInteger(copies) || copies < 0) {
    throw badRequest('Book title, author, and a non-negative integer copies value are required');
  }
  const book = await LibraryBook.create({
    id: randomUUID(),
    title: title.trim(),
    author: author.trim(),
    category: String(category),
    copies,
    availableCopies: copies
  });
  return res.status(201).json({ book: clean(book.toObject()) });
}));

router.post('/school-life/library/:id/borrow', authenticate, authorize(['admin', 'teacher', 'student', 'parent']), asyncHandler(async (req, res) => {
  const book = await LibraryBook.findOneAndUpdate(
    { id: req.params.id, availableCopies: { $gt: 0 } },
    { $inc: { availableCopies: -1 } },
    { new: true }
  );
  if (!book) throw Object.assign(new Error('No copies of this book are available'), { status: 409 });
  const borrowed = await BorrowedBook.create({
    id: randomUUID(),
    bookId: book.id,
    borrowerUserId: req.user.id,
    borrower: req.user.name,
    date: new Date().toISOString().slice(0, 10)
  });
  return res.status(201).json({ borrowedBook: clean(borrowed.toObject()) });
}));

router.post('/school-life/library/returns/:id', authenticate, authorize(['admin', 'teacher', 'student', 'parent']), asyncHandler(async (req, res) => {
  const filter = { id: req.params.id, returned: false };
  if (req.user.role !== 'admin') filter.borrowerUserId = req.user.id;
  const borrowed = await BorrowedBook.findOneAndUpdate(filter, { $set: { returned: true } }, { new: true });
  if (!borrowed) throw notFound('Active book loan was not found');
  await LibraryBook.updateOne({ id: borrowed.bookId }, { $inc: { availableCopies: 1 } });
  return res.json({ borrowedBook: clean(borrowed.toObject()) });
}));

router.get('/school-life/library/borrowed', authenticate, authorize(['admin', 'teacher', 'student', 'parent']), asyncHandler(async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { borrowerUserId: req.user.id };
  const loans = await BorrowedBook.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  return res.json(loans.map(clean));
}));

router.post('/school-life/timetable', authenticate, authorize(['admin']), asyncHandler(async (req, res) => {
  const { day, period, time = '', className, subject, teacher, room = '' } = req.body || {};
  if (![day, period, className, subject, teacher].every(value => typeof value === 'string' && value.trim())) {
    throw badRequest('day, period, className, subject, and teacher are required');
  }
  const entry = await TimetableEntry.create({
    id: randomUUID(),
    day: day.trim(),
    period: period.trim(),
    time: typeof time === 'string' ? time.trim() : '',
    className: className.trim(),
    subject: subject.trim(),
    teacher: teacher.trim(),
    room: typeof room === 'string' ? room.trim() : ''
  });
  return res.status(201).json({ entry: clean(entry.toObject()) });
}));

router.post('/school-life/messages', authenticate, authorize(['admin', 'teacher', 'parent']), asyncHandler(async (req, res) => {
  const { recipientUserId, subject, content } = req.body || {};
  if (typeof recipientUserId !== 'string' || typeof subject !== 'string' || !subject.trim() ||
      typeof content !== 'string' || !content.trim()) {
    throw badRequest('recipientUserId, subject, and content are required');
  }
  const recipient = await User.findOne({ id: recipientUserId, status: 'active' }).lean();
  if (!recipient) throw notFound('Recipient account was not found');
  if (req.user.role === 'parent') {
    const teacher = recipient.role === 'teacher'
      ? await Teacher.findOne({ userId: recipient.id }).lean()
      : null;
    const children = await Student.find({ parentUserId: req.user.id, status: 'active' }).select('className').lean();
    if (!teacher || !children.some(child => teacher.classNames.includes(child.className))) {
      throw Object.assign(new Error('You can only message a teacher assigned to your child'), { status: 403 });
    }
  }
  const message = await Message.create({
    id: randomUUID(),
    recipientUserId,
    senderUserId: req.user.id,
    sender: req.user.name,
    subject: subject.trim(),
    preview: content.trim().slice(0, 200),
    content: content.trim(),
    unread: true,
    time: new Date().toISOString()
  });
  return res.status(201).json({ message: clean(message.toObject()) });
}));

module.exports = router;
