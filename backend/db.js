import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEMORY_DB = {
  users: [
    { id: 's1', email: 'student@school.edu', name: 'Alex Johnson', role: 'student', exam_number: 'EXAM123', teacher_id: null },
    { id: 's2', email: 'jane@school.edu', name: 'Jane Smith', role: 'student', exam_number: 'EXAM456', teacher_id: null },
    { id: 't1', email: 'teacher@school.edu', name: 'Mr. Davis', role: 'teacher', exam_number: null, teacher_id: 'TEACH999' }
  ],
  assessments: [],
  submissions: []
};

let pool = null;
let usePostgreSQL = false;

export const initDb = async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[Database] DATABASE_URL not set. Falling back to in-memory store.');
    return;
  }

  try {
    pool = new pg.Pool({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });

    const client = await pool.connect();
    client.release();
    usePostgreSQL = true;
    console.log('[Database] Connected to Neon PostgreSQL successfully.');

    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(sql);
      console.log('[Database] Schema verified.');
    }
  } catch (error) {
    console.error('[Database] Failed to connect to Neon PostgreSQL. Falling back to in-memory.', error.message);
    usePostgreSQL = false;
    pool = null;
  }
};

export const getUser = async (email, accessId) => {
  if (usePostgreSQL) {
    try {
      const res = await pool.query(
        `SELECT * FROM users 
         WHERE LOWER(email) = LOWER($1) 
         AND (exam_number = $2 OR teacher_id = $2)`,
        [email, accessId]
      );
      if (res.rows.length > 0) {
        const u = res.rows[0];
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          examNumber: u.exam_number || undefined,
          teacherId: u.teacher_id || undefined
        };
      }
      return null;
    } catch (err) {
      console.error('[Database] getUser error:', err);
      throw err;
    }
  } else {
    const u = MEMORY_DB.users.find(
      x => x.email.toLowerCase() === email.toLowerCase() && (x.exam_number === accessId || x.teacher_id === accessId)
    );
    if (u) {
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        examNumber: u.exam_number || undefined,
        teacherId: u.teacher_id || undefined
      };
    }
    return null;
  }
};

export const getUsers = async (role = null) => {
  if (usePostgreSQL) {
    try {
      let queryStr = 'SELECT * FROM users';
      const params = [];
      if (role) {
        queryStr += ' WHERE role = $1';
        params.push(role);
      }
      const res = await pool.query(queryStr, params);
      return res.rows.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        examNumber: u.exam_number || undefined,
        teacherId: u.teacher_id || undefined
      }));
    } catch (err) {
      console.error('[Database] getUsers error:', err);
      throw err;
    }
  } else {
    let list = MEMORY_DB.users;
    if (role) {
      list = list.filter(u => u.role === role);
    }
    return list.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      examNumber: u.exam_number || undefined,
      teacherId: u.teacher_id || undefined
    }));
  }
};

export const getAssessments = async () => {
  if (usePostgreSQL) {
    try {
      const assessRes = await pool.query('SELECT * FROM assessments');
      const assessments = [];

      for (const a of assessRes.rows) {
        const questionsRes = await pool.query(
          'SELECT * FROM questions WHERE assessment_id = $1 ORDER BY sort_order ASC',
          [a.id]
        );
        const questions = questionsRes.rows.map(q => {
          const item = {
            id: q.id,
            type: q.type,
            text: { en: q.text_en, ga: q.text_ga },
            maxMarks: q.max_marks,
            image: (q.image_en || q.image_ga) ? { en: q.image_en, ga: q.image_ga } : undefined,
            markSchemeImage: q.mark_scheme_image || undefined
          };
          if (q.type === 'mcq') {
            item.options = q.options;
            item.correctAnswerIndex = q.correct_answer_index;
          } else {
            item.markScheme = { en: q.mark_scheme_en, ga: q.mark_scheme_ga };
          }
          return item;
        });

        assessments.push({
          id: a.id,
          title: { en: a.title_en, ga: a.title_ga },
          description: { en: a.description_en, ga: a.description_ga },
          questions
        });
      }
      return assessments;
    } catch (err) {
      console.error('[Database] getAssessments error:', err);
      throw err;
    }
  } else {
    return MEMORY_DB.assessments;
  }
};

export const createAssessment = async (assessment) => {
  if (usePostgreSQL) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO assessments (id, title_en, title_ga, description_en, description_ga)
         VALUES ($1, $2, $3, $4, $5)`,
        [assessment.id, assessment.title.en, assessment.title.ga, assessment.description.en, assessment.description.ga]
      );

      for (let i = 0; i < assessment.questions.length; i++) {
        const q = assessment.questions[i];
        await client.query(
          `INSERT INTO questions (id, assessment_id, type, text_en, text_ga, max_marks, options, correct_answer_index, mark_scheme_en, mark_scheme_ga, image_en, image_ga, mark_scheme_image, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            q.id,
            assessment.id,
            q.type,
            q.text.en,
            q.text.ga,
            q.maxMarks,
            q.type === 'mcq' ? JSON.stringify(q.options) : null,
            q.type === 'mcq' ? q.correctAnswerIndex : null,
            q.type === 'written' ? q.markScheme?.en : null,
            q.type === 'written' ? q.markScheme?.ga : null,
            q.image?.en || null,
            q.image?.ga || null,
            q.markSchemeImage || null,
            i
          ]
        );
      }
      await client.query('COMMIT');
      return assessment;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[Database] createAssessment error:', err);
      throw err;
    } finally {
      client.release();
    }
  } else {
    MEMORY_DB.assessments.push(assessment);
    return assessment;
  }
};

export const updateAssessment = async (id, { titleEn, titleGa, descEn, descGa }) => {
  if (usePostgreSQL) {
    await pool.query(
      `UPDATE assessments SET title_en = $1, title_ga = $2, description_en = $3, description_ga = $4 WHERE id = $5`,
      [titleEn, titleGa, descEn, descGa, id]
    );
  } else {
    const a = MEMORY_DB.assessments.find(x => x.id === id);
    if (a) {
      a.title = { en: titleEn, ga: titleGa };
      a.description = { en: descEn, ga: descGa };
    }
  }
};

export const deleteAssessment = async (id) => {
  if (usePostgreSQL) {
    await pool.query('DELETE FROM assessments WHERE id = $1', [id]);
  } else {
    MEMORY_DB.assessments = MEMORY_DB.assessments.filter(a => a.id !== id);
  }
};

export const getSubmissions = async (studentId = null) => {
  if (usePostgreSQL) {
    try {
      let queryStr = `
        SELECT s.*, u.name as student_name, u.exam_number as student_exam_number,
               a.title_en as assessment_title_en, a.title_ga as assessment_title_ga
        FROM submissions s
        JOIN users u ON s.student_id = u.id
        JOIN assessments a ON s.assessment_id = a.id
      `;
      const params = [];
      if (studentId) {
        queryStr += ' WHERE s.student_id = $1';
        params.push(studentId);
      }
      queryStr += ' ORDER BY s.submitted_at DESC';

      const res = await pool.query(queryStr, params);
      const submissions = [];

      for (const row of res.rows) {
        const feedRes = await pool.query('SELECT * FROM feedbacks WHERE submission_id = $1', [row.id]);
        const feedback = {};
        feedRes.rows.forEach(f => {
          feedback[f.question_id] = {
            score: f.score,
            commentEn: f.comment_en,
            commentGa: f.comment_ga
          };
        });

        submissions.push({
          id: row.id,
          studentId: row.student_id,
          assessmentId: row.assessment_id,
          answers: row.answers,
          status: row.status,
          totalScore: row.total_score,
          submittedAt: row.submitted_at.toISOString(),
          feedback
        });
      }
      return submissions;
    } catch (err) {
      console.error('[Database] getSubmissions error:', err);
      throw err;
    }
  } else {
    let subs = MEMORY_DB.submissions;
    if (studentId) {
      subs = subs.filter(s => s.studentId === studentId);
    }
    return subs;
  }
};

export const createSubmission = async (submission) => {
  if (usePostgreSQL) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO submissions (id, student_id, assessment_id, answers, status, total_score, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          submission.id,
          submission.studentId,
          submission.assessmentId,
          JSON.stringify(submission.answers),
          submission.status,
          submission.totalScore,
          submission.submittedAt
        ]
      );

      if (submission.feedback) {
        for (const [qId, f] of Object.entries(submission.feedback)) {
          await client.query(
            `INSERT INTO feedbacks (submission_id, question_id, score, comment_en, comment_ga)
             VALUES ($1, $2, $3, $4, $5)`,
            [submission.id, qId, f.score, f.commentEn, f.commentGa]
          );
        }
      }
      await client.query('COMMIT');
      return submission;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[Database] createSubmission error:', err);
      throw err;
    } finally {
      client.release();
    }
  } else {
    MEMORY_DB.submissions.push(submission);
    return submission;
  }
};