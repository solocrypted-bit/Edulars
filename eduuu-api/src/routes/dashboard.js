/**
 * @openapi
 * /api/dashboard:
 *   get:
 *     tags: [Dashboard]
 *     summary: Fetch persisted school dashboard metrics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard overview returned successfully
 */
const express = require('express');
const { authenticate, authorize, asyncHandler } = require('../middleware/auth');
const { Student, Teacher, ClassRecord, FeeRecord, SchoolSettings } = require('../models');

const router = express.Router();

router.get('/', authenticate, authorize(['admin', 'teacher', 'student', 'parent']), asyncHandler(async (req, res) => {
  const [settings, totalStudents, totalTeachers, totalClasses, feeTotals] = await Promise.all([
    SchoolSettings.findOne({ key: 'global' }).lean(),
    Student.countDocuments(),
    Teacher.countDocuments(),
    ClassRecord.countDocuments(),
    req.user.role === 'admin'
      ? FeeRecord.aggregate([{ $group: { _id: null, balance: { $sum: '$balance' } } }])
      : Promise.resolve([])
  ]);

  res.json({
    overview: {
      schoolName: settings ? settings.schoolName : null,
      role: req.user.role,
      totalStudents,
      totalTeachers,
      totalClasses,
      feeBalance: req.user.role === 'admin'
        ? (feeTotals.length ? feeTotals[0].balance : 0)
        : null
    }
  });
}));

module.exports = router;
