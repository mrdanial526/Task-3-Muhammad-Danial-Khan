const express = require('express');
const router = express.Router();
const { AcademicController } = require('../controllers/academicController');
const validate = require('../middleware/validator');
const { createStudentSchema, createCourseSchema, enrollSchema } = require('../schemas/academicSchema');

router.get('/students', AcademicController.listStudents);
router.post('/students', validate(createStudentSchema), AcademicController.createStudent);
router.get('/courses', AcademicController.listCourses);
router.post('/courses', validate(createCourseSchema), AcademicController.createCourse);
router.post('/enroll', validate(enrollSchema), AcademicController.enrollStudent);
router.delete('/enroll', AcademicController.dropEnrollment);

module.exports = router;
