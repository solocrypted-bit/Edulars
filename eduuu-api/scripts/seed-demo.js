require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDatabase, mongoose } = require('../src/config/db');
const demo = require('../src/data/demoStore');
const models = require('../src/models');

function operations(Model, records) {
  return records.map((record) => ({
    updateOne: {
      filter: { id: record.id },
      update: { $set: record },
      upsert: true
    }
  }));
}

async function seedDemo() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo data seeding is disabled in production.');
  }
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('Set DEMO_PASSWORD to a value of at least 12 characters before seeding.');
  }

  await connectDatabase();
  const users = await Promise.all(demo.demoUsers.map(async (user) => ({
    ...user,
    passwordHash: await bcrypt.hash(demoPassword, 12),
    status: 'active'
  })));
  const userIdByEmail = Object.fromEntries(users.map((user) => [user.email, user.id]));
  const studentIdByName = Object.fromEntries(demo.students.map((student) => [student.name, student.id]));
  const classNameByStudentId = Object.fromEntries(demo.students.map((student) => [student.id, student.className]));
  const classIdByName = Object.fromEntries(demo.classes.map((classroom) => [classroom.name, classroom.id]));

  const students = demo.students.map((student) => ({
    ...student,
    userId: student.id === 'stu-101' ? userIdByEmail['student@edulars.com'] : null,
    parentUserId: student.id === 'stu-101' ? userIdByEmail['parent@edulars.com'] : null,
    parentEmail: student.id === 'stu-101' ? 'parent@edulars.com' : ''
  }));
  const teachers = demo.teachers.map((teacher) => ({
    ...teacher,
    userId: teacher.name === 'Mrs. Folashade Adebayo' ? userIdByEmail['teacher@edulars.com'] : null,
    email: teacher.name === 'Mrs. Folashade Adebayo'
      ? 'teacher@edulars.com'
      : `${teacher.name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '')}@demo.edulars.com`
  }));
  const seededTeacherByName = Object.fromEntries(teachers.map((teacher) => [teacher.name, teacher]));
  const grades = demo.grades.map((grade) => ({
    ...grade,
    className: classNameByStudentId[grade.studentId]
  }));
  const attendance = demo.attendance.map((record) => {
    const student = demo.students.find((entry) => entry.name === record.studentName);
    return { ...record, studentId: student.id, className: student.className };
  });
  const feeRecords = demo.feeRecords.map((fee) => {
    const student = demo.students.find((entry) => entry.name === fee.studentName);
    return {
      ...fee,
      studentId: student.id,
      classId: classIdByName[student.className],
      type: 'Tuition'
    };
  });
  const classes = demo.classes.map((classroom) => {
    const teacher = seededTeacherByName[classroom.formTeacher];
    return {
      ...classroom,
      teacherId: teacher?.id || '',
      teacherEmail: teacher?.email || ''
    };
  });
  const lessonPlans = demo.lessonPlans.map((plan) => ({
    ...plan,
    title: plan.title || plan.topic,
    teacherUserId: userIdByEmail['teacher@edulars.com'] && plan.teacherName === 'Mrs. Folashade Adebayo'
      ? userIdByEmail['teacher@edulars.com']
      : null
  }));
  const libraryBooks = demo.libraryBooks.map((book) => ({
    ...book,
    copies: book.copies ?? book.availableCopies,
    availableCopies: book.availableCopies
  }));
  const messages = demo.messages.map((message, index) => ({
    ...message,
    recipientUserId: index === 0
      ? userIdByEmail['student@edulars.com']
      : userIdByEmail['parent@edulars.com']
  }));

  await models.User.bulkWrite(operations(models.User, users));
  await models.Student.bulkWrite(operations(models.Student, students));
  await models.Teacher.bulkWrite(operations(models.Teacher, teachers));
  await models.ClassRecord.bulkWrite(operations(models.ClassRecord, classes));
  await models.Grade.bulkWrite(operations(models.Grade, grades));
  await models.LessonPlan.bulkWrite(operations(models.LessonPlan, lessonPlans));
  await models.Attendance.bulkWrite(operations(models.Attendance, attendance));
  await models.Assignment.bulkWrite(operations(models.Assignment, demo.assignments.map((assignment) => ({
    ...assignment,
    teacherUserId: userIdByEmail['teacher@edulars.com']
  }))));
  await models.FeeRecord.bulkWrite(operations(models.FeeRecord, feeRecords));
  await models.Announcement.bulkWrite(operations(models.Announcement, demo.announcements));
  await models.LibraryBook.bulkWrite(operations(models.LibraryBook, libraryBooks));
  await models.TimetableEntry.bulkWrite(operations(models.TimetableEntry, demo.timetable));
  await models.Message.bulkWrite(operations(models.Message, messages));
  await models.Report.bulkWrite(operations(models.Report, demo.reports));
  await models.SchoolSettings.updateOne(
    { key: 'global' },
    { $set: { key: 'global', ...demo.settings } },
    { upsert: true }
  );

  console.log('Demo data seeded. All four demo accounts use the DEMO_PASSWORD value.');
}

seedDemo()
  .catch((error) => {
    console.error(`Demo seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
