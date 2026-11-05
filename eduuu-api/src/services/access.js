const { Student, Teacher } = require('../models');

async function getVisibleStudents(user, limit = 500) {
  if (user.role === 'admin') {
    return Student.find().limit(limit).lean();
  }

  if (user.role === 'student') {
    return Student.find({ userId: user.id }).limit(limit).lean();
  }

  if (user.role === 'parent') {
    return Student.find({ parentUserId: user.id }).limit(limit).lean();
  }

  if (user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: user.id }).lean();
    return teacher ? Student.find({ className: { $in: teacher.classNames } }).limit(limit).lean() : [];
  }

  return [];
}

async function getStudentDataFilter(user) {
  if (user.role === 'admin') {
    return {};
  }

  if (user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: user.id }).lean();
    return teacher ? { className: { $in: teacher.classNames } } : { className: { $in: [] } };
  }

  const students = await getVisibleStudents(user);
  return { studentId: { $in: students.map((student) => student.id) } };
}

module.exports = { getVisibleStudents, getStudentDataFilter };
