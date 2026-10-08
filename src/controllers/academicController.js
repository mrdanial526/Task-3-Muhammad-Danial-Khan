const db = require('../database/db');
const ApiResponse = require('../utils/apiResponse');

class AcademicController {
  /**
   * List students with their enrolled courses (M:M relational aggregation)
   * GET /api/v1/academics/students
   */
  static listStudents(req, res, next) {
    try {
      const sql = `
        SELECT 
          s.id,
          s.student_code AS studentCode,
          s.full_name AS fullName,
          s.email,
          s.enrollment_year AS enrollmentYear,
          s.gpa,
          (
            SELECT json_group_array(
              json_object(
                'courseId', c.id,
                'courseCode', c.course_code,
                'title', c.title,
                'credits', c.credits,
                'grade', sc.grade,
                'enrolledDate', sc.enrolled_date
              )
            )
            FROM student_courses sc
            JOIN courses c ON sc.course_id = c.id
            WHERE sc.student_id = s.id
          ) AS courses_json
        FROM students s
        ORDER BY s.student_code ASC
      `;

      const rows = db.query(sql);
      const students = rows.map((r) => ({
        id: r.id,
        studentCode: r.studentCode,
        fullName: r.fullName,
        email: r.email,
        enrollmentYear: r.enrollmentYear,
        gpa: r.gpa,
        enrolledCourses: r.courses_json ? JSON.parse(r.courses_json) : []
      }));

      return ApiResponse.success(res, students, 'Students with enrolled courses retrieved');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create student
   * POST /api/v1/academics/students
   */
  static createStudent(req, res, next) {
    try {
      const { studentCode, fullName, email, enrollmentYear, gpa } = req.body;
      const sql = `
        INSERT INTO students (student_code, full_name, email, enrollment_year, gpa, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `;
      const result = db.execute(sql, [studentCode, fullName, email, enrollmentYear, gpa]);

      const student = db.queryOne('SELECT * FROM students WHERE id = ?', [result.lastInsertRowid]);
      return ApiResponse.created(res, student, 'Student enrolled in system');
    } catch (err) {
      next(err);
    }
  }

  /**
   * List courses with enrollment counts
   * GET /api/v1/academics/courses
   */
  static listCourses(req, res, next) {
    try {
      const sql = `
        SELECT 
          c.id,
          c.course_code AS courseCode,
          c.title,
          c.credits,
          c.department,
          c.created_at AS createdAt,
          COUNT(sc.student_id) AS enrolledStudentsCount
        FROM courses c
        LEFT JOIN student_courses sc ON c.id = sc.course_id
        GROUP BY c.id
        ORDER BY c.course_code ASC
      `;

      const courses = db.query(sql);
      return ApiResponse.success(res, courses, 'Courses retrieved');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create Course
   * POST /api/v1/academics/courses
   */
  static createCourse(req, res, next) {
    try {
      const { courseCode, title, credits, department } = req.body;
      const sql = `
        INSERT INTO courses (course_code, title, credits, department, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `;
      const result = db.execute(sql, [courseCode, title, credits, department]);

      const course = db.queryOne('SELECT * FROM courses WHERE id = ?', [result.lastInsertRowid]);
      return ApiResponse.created(res, course, 'Course created');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Enroll student in course (Insert into Junction Table `student_courses` - M:M)
   * POST /api/v1/academics/enroll
   */
  static enrollStudent(req, res, next) {
    try {
      const { studentId, courseId, grade } = req.body;

      const sql = `
        INSERT INTO student_courses (student_id, course_id, grade, enrolled_date)
        VALUES (?, ?, ?, datetime('now'))
      `;
      db.execute(sql, [studentId, courseId, grade || 'IN_PROGRESS']);

      return ApiResponse.created(
        res,
        { studentId, courseId, grade: grade || 'IN_PROGRESS' },
        'Student successfully enrolled in course via junction table'
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * Drop enrollment
   * DELETE /api/v1/academics/enroll
   */
  static dropEnrollment(req, res, next) {
    try {
      const { studentId, courseId } = req.body;
      const resExec = db.execute('DELETE FROM student_courses WHERE student_id = ? AND course_id = ?', [studentId, courseId]);

      if (resExec.changes === 0) {
        return ApiResponse.error(res, 'Enrollment record not found in junction table', 404, 'ENROLLMENT_NOT_FOUND');
      }

      return ApiResponse.success(res, { studentId, courseId }, 'Enrollment dropped');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = { AcademicController };
