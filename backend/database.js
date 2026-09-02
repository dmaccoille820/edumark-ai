import Database from 'better-sqlite3';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
const databasePath = process.env.DATABASE_PATH || path.join(backendDirectory, 'data', 'edumark.sqlite');
const dbUrl = process.env.DATABASE_URL;

export let usePostgreSQL = false;
let pool = null;
export let db = null; // SQLite db instance

// Password Hashing helpers
export function hashExamNumber(examNumber) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(examNumber, salt, 64).toString('hex')}`;
}

export function verifyExamNumber(examNumber, storedHash) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const actual = crypto.scryptSync(examNumber, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function initializeSQLite() {
  if (db) return;
  if (databasePath !== ':memory:') {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
      access_id TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      title_en TEXT NOT NULL,
      title_ga TEXT NOT NULL,
      description_en TEXT,
      description_ga TEXT
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('mcq', 'written')),
      text_en TEXT NOT NULL,
      text_ga TEXT NOT NULL,
      max_marks INTEGER NOT NULL,
      options_json TEXT,
      correct_answer_index INTEGER,
      mark_scheme_en TEXT,
      mark_scheme_ga TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      student_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      assessment_id TEXT REFERENCES assessments(id) ON DELETE SET NULL,
      answers_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'graded')),
      total_score INTEGER,
      submitted_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id TEXT REFERENCES submissions(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      comment_en TEXT,
      comment_ga TEXT,
      UNIQUE(submission_id, question_id)
    );
  `);

  // Migrate legacy users or seed default users
  const seedUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, email, name, role, access_id, password)
    VALUES (@id, @email, @name, @role, @accessId, @password)
  `);
  for (const user of [
    { id: 's1', email: 'student@school.edu', name: 'Alex Johnson', role: 'student', accessId: '0123', password: '0123' },
    { id: 's2', email: 'jane@school.edu', name: 'Jane Smith', role: 'student', accessId: '0456', password: '0456' },
    { id: 't1', email: 'teacher@school.edu', name: 'Mr. Davis', role: 'teacher', accessId: '9999', password: '9999' },
  ]) {
    seedUser.run({ ...user, password: hashExamNumber(user.password) });
  }

  seedDefaultAssessmentsAndQuestions();
}

function seedDefaultAssessmentsAndQuestions() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM assessments').get().count;
  if (count > 0) return;

  const assessments = [
    {
      id: 'a1',
      title: { en: 'Introduction to Biology', ga: 'Réamhrá don Bhitheolaíocht' },
      description: { en: 'A brief assessment covering basic biological concepts.', ga: 'Measúnú gairid a chlúdaíonn buneilimintí bitheolaíochta.' },
      questions: [
        {
          id: 'q1',
          type: 'mcq',
          text: { en: 'Which organelle is known as the powerhouse of the cell?', ga: 'Cén t-organán a dtugtar teach cumhachta na cille air?' },
          maxMarks: 1,
          options: [
            { en: 'Nucleus', ga: 'Núicléas' },
            { en: 'Mitochondria', ga: 'Miteacoindre' },
            { en: 'Ribosome', ga: 'Ribeasóm' },
            { en: 'Endoplasmic Reticulum', ga: 'Líonra Ionplásmach' }
          ],
          correctAnswerIndex: 1
        },
        {
          id: 'q2',
          type: 'written',
          text: { en: 'Explain the basic process of photosynthesis in plants.', ga: 'Mínigh bunphróiseas na fótaisintéise i bplandaí.' },
          maxMarks: 3,
          markScheme: {
            en: 'Award 1 mark for mentioning sunlight/light energy. Award 1 mark for mentioning the conversion of carbon dioxide and water. Award 1 mark for mentioning the production of glucose/sugar and oxygen.',
            ga: 'Bronn marc amháin as fuinneamh gréine/solais a lua. Bronn marc amháin as tiontú dé-ocsaíd charbóin agus uisce a lua. Bronn marc amháin as táirgeadh glúcóis/siúcra agus ocsaigine a lua.'
          }
        },
        {
          id: 'q3',
          type: 'written',
          text: { en: 'Describe the difference between a prokaryotic and a eukaryotic cell.', ga: 'Déan cur síos ar an difríocht idir cill phrócarótach agus cill eocarótach.' },
          maxMarks: 2,
          markScheme: {
            en: 'Award 1 mark for stating eukaryotic cells have a membrane-bound nucleus. Award 1 mark for stating prokaryotic cells lack a membrane-bound nucleus (or lack membrane-bound organelles).',
            ga: 'Bronn marc amháin as a rá go bhfuil núicléas scannán-cheangailte ag cealla eocarótacha. Bronn marc amháin as a rá nach bhfuil núicléas scannán-cheangailte ag cealla prócarótacha.'
          }
        }
      ]
    },
    {
      id: 'a2',
      title: { en: 'Computer Science 101', ga: 'Ríomheolaíocht 101' },
      description: { en: 'Basic programming and hardware concepts.', ga: 'Buneilimintí ríomhchlárúcháin agus crua-earraí.' },
      questions: [
        {
          id: 'q4',
          type: 'mcq',
          text: { en: 'What does CPU stand for?', ga: 'Cad a sheasann CPU dó?' },
          maxMarks: 1,
          options: [
            { en: 'Central Process Unit', ga: 'Aonad Próisis Lárnach' },
            { en: 'Computer Personal Unit', ga: 'Aonad Pearsanta Ríomhaire' },
            { en: 'Central Processing Unit', ga: 'Láraonad Próiseála' },
            { en: 'Central Processor Unit', ga: 'Aonad Próiseálaí Lárnach' }
          ],
          correctAnswerIndex: 2
        },
        {
          id: 'q5',
          type: 'written',
          text: { en: 'Explain what a variable is in programming.', ga: 'Mínigh cad is athróg ann sa ríomhchlárú.' },
          maxMarks: 2,
          markScheme: {
            en: 'Award 1 mark for describing it as a storage location or container. Award 1 mark for mentioning it holds data/values that can change during program execution.',
            ga: 'Bronn marc amháin as é a mhíniú mar shuíomh stórála nó coimeádán. Bronn marc amháin as a lua go gcoinníonn sé sonraí/luachanna is féidir a athrú le linn rith an chláir.'
          }
        }
      ]
    }
  ];

  for (const a of assessments) {
    createAssessment(a);
  }
}

// Initialise DB connection on module load
if (dbUrl && databasePath !== ':memory:') {
  usePostgreSQL = true;
  pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });
} else {
  initializeSQLite();
}

export async function initDb() {
  if (usePostgreSQL) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('[Database] Connected to Neon PostgreSQL successfully.');
      
      const schemaPath = path.join(backendDirectory, 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(sql);
        console.log('[Database] Schema initialised / verified.');
      }
    } catch (err) {
      console.error('[Database] Failed to connect to Neon PostgreSQL:', err.message);
      if (process.env.VERCEL) {
        console.error('[Database] Running on Vercel: SQLite fallback disabled. Keeping PostgreSQL active.');
      } else {
        console.log('[Database] Falling back to SQLite.');
        usePostgreSQL = false;
        initializeSQLite();
      }
    }
  } else {
    console.log('[Database] Using SQLite database.');
  }
}

// Database Operations

export function findUser(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  
  if (usePostgreSQL) {
    // 1. Try to find the user first
    return pool.query(
      `SELECT * FROM users WHERE LOWER(email) = $1`,
      [normalizedEmail]
    ).then(res => {
      if (res.rows.length > 0) {
        // User exists! Verify password
        const u = res.rows[0];
        const storedPassword = u.role === 'student' ? u.exam_number : u.teacher_id;
        if (storedPassword === password) {
          return {
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            accessId: storedPassword
          };
        }
        return undefined;
      }
      
      // User does NOT exist! Can we register them dynamically?
      const isFourDigit = /^\d{4}$/.test(password);
      if (password === 'TEACH123') {
        // Register as a new teacher!
        const newId = crypto.randomUUID();
        const prefix = email.split('@')[0];
        const name = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        
        return pool.query(
          `INSERT INTO users (id, email, name, role, exam_number, teacher_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [newId, normalizedEmail, name, 'teacher', null, 'TEACH123']
        ).then(() => {
          return {
            id: newId,
            email: normalizedEmail,
            name: name,
            role: 'teacher',
            accessId: 'TEACH123'
          };
        });
      } else if (isFourDigit) {
        // Register as a new student!
        const newId = crypto.randomUUID();
        const prefix = email.split('@')[0];
        const name = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        
        return pool.query(
          `INSERT INTO users (id, email, name, role, exam_number, teacher_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [newId, normalizedEmail, name, 'student', password, null]
        ).then(() => {
          return {
            id: newId,
            email: normalizedEmail,
            name: name,
            role: 'student',
            accessId: password
          };
        });
      }
      
      return undefined;
    });
    
  } else {
    // SQLite mode - synchronous
    const user = db.prepare(`
      SELECT id, email, name, role, access_id AS accessId, password
      FROM users
      WHERE LOWER(email) = LOWER(?)
    `).get(normalizedEmail);
    
    if (user) {
      // User exists! Verify password
      if (!verifyExamNumber(password, user.password)) return undefined;
      const { password: _password, ...safeUser } = user;
      return safeUser;
    }
    
    // User does NOT exist! Can we register them dynamically?
    const isFourDigit = /^\d{4}$/.test(password);
    if (password === 'TEACH123') {
      // Register as a new teacher!
      const newId = crypto.randomUUID();
      const prefix = email.split('@')[0];
      const name = prefix.charAt(0).toUpperCase() + prefix.slice(1);
      const hashedPassword = hashExamNumber('TEACH123');
      
      db.prepare(`
        INSERT INTO users (id, email, name, role, access_id, password)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(newId, normalizedEmail, name, 'teacher', 'TEACH123', hashedPassword);
      
      return {
        id: newId,
        email: normalizedEmail,
        name: name,
        role: 'teacher',
        accessId: 'TEACH123'
      };
    } else if (isFourDigit) {
      // Register as a new student!
      const newId = crypto.randomUUID();
      const prefix = email.split('@')[0];
      const name = prefix.charAt(0).toUpperCase() + prefix.slice(1);
      const hashedPassword = hashExamNumber(password);
      
      db.prepare(`
        INSERT INTO users (id, email, name, role, access_id, password)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(newId, normalizedEmail, name, 'student', password, hashedPassword);
      
      return {
        id: newId,
        email: normalizedEmail,
        name: name,
        role: 'student',
        accessId: password
      };
    }
    
    return undefined;
  }
}

export function listUsers(role = null) {
  if (usePostgreSQL) {
    let queryStr = 'SELECT * FROM users';
    const params = [];
    if (role) {
      queryStr += ' WHERE role = $1';
      params.push(role);
    }
    return pool.query(queryStr, params).then(res => {
      return res.rows.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        examNumber: u.exam_number || undefined,
        teacherId: u.teacher_id || undefined
      }));
    });
  } else {
    let list = db.prepare('SELECT id, email, name, role, access_id AS accessId FROM users').all();
    if (role) {
      list = list.filter(u => u.role === role);
    }
    return list.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      examNumber: u.role === 'student' ? u.accessId : undefined,
      teacherId: u.role === 'teacher' ? u.accessId : undefined
    }));
  }
}

export function getAssessments() {
  if (usePostgreSQL) {
    return pool.query('SELECT * FROM assessments').then(async (assessRes) => {
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
            maxMarks: q.max_marks
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
    });
  } else {
    const assessList = db.prepare('SELECT * FROM assessments').all();
    const assessments = [];
    for (const a of assessList) {
      const questionsList = db.prepare('SELECT * FROM questions WHERE assessment_id = ? ORDER BY sort_order ASC').all(a.id);
      const questions = questionsList.map(q => {
        const item = {
          id: q.id,
          type: q.type,
          text: { en: q.text_en, ga: q.text_ga },
          maxMarks: q.max_marks
        };
        if (q.type === 'mcq') {
          item.options = JSON.parse(q.options_json);
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
  }
}

export function createAssessment(assessment) {
  if (usePostgreSQL) {
    return pool.connect().then(async (client) => {
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
            `INSERT INTO questions (id, assessment_id, type, text_en, text_ga, max_marks, options, correct_answer_index, mark_scheme_en, mark_scheme_ga, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              q.id,
              assessment.id,
              q.type,
              q.text?.en ?? q.text,
              q.text?.ga ?? q.text,
              q.maxMarks,
              q.type === 'mcq' ? JSON.stringify(q.options) : null,
              q.type === 'mcq' ? q.correctAnswerIndex : null,
              q.type === 'written' ? q.markScheme?.en : null,
              q.type === 'written' ? q.markScheme?.ga : null,
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
    });
  } else {
    const insertAssess = db.prepare(`
      INSERT INTO assessments (id, title_en, title_ga, description_en, description_ga)
      VALUES (@id, @title_en, @title_ga, @description_en, @description_ga)
    `);
    const insertQuestion = db.prepare(`
      INSERT INTO questions (id, assessment_id, type, text_en, text_ga, max_marks, options_json, correct_answer_index, mark_scheme_en, mark_scheme_ga, sort_order)
      VALUES (@id, @assessment_id, @type, @text_en, @text_ga, @max_marks, @options_json, @correct_answer_index, @mark_scheme_en, @mark_scheme_ga, @sort_order)
    `);
    
    const runTransaction = db.transaction((assess, questions) => {
      insertAssess.run({
        id: assess.id,
        title_en: assess.title.en,
        title_ga: assess.title.ga,
        description_en: assess.description.en,
        description_ga: assess.description.ga
      });
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        insertQuestion.run({
          id: q.id,
          assessment_id: assess.id,
          type: q.type,
          text_en: q.text.en,
          text_ga: q.text.ga,
          max_marks: q.maxMarks,
          options_json: q.type === 'mcq' ? JSON.stringify(q.options) : null,
          correct_answer_index: q.type === 'mcq' ? q.correctAnswerIndex : null,
          mark_scheme_en: q.type === 'written' ? q.markScheme?.en : null,
          mark_scheme_ga: q.type === 'written' ? q.markScheme?.ga : null,
          sort_order: i
        });
      }
    });

    runTransaction(assessment, assessment.questions);
    return assessment;
  }
}

export function listSubmissions(studentId = null) {
  if (usePostgreSQL) {
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

    return pool.query(queryStr, params).then(async (res) => {
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
          submittedAt: row.submitted_at instanceof Date ? row.submitted_at.toISOString() : new Date(row.submitted_at).toISOString(),
          feedback
        });
      }
      return submissions;
    });
  } else {
    let queryStr = `
      SELECT s.id, s.student_id AS studentId, s.assessment_id AS assessmentId,
             s.answers_json AS answersJson, s.status, s.total_score AS totalScore,
             s.submitted_at AS submittedAt
      FROM submissions s
    `;
    const params = [];
    if (studentId) {
      queryStr += ' WHERE s.student_id = ?';
      params.push(studentId);
    }
    queryStr += ' ORDER BY s.submitted_at DESC';
    
    const rows = db.prepare(queryStr).all(params);
    const submissions = [];
    for (const r of rows) {
      const feeds = db.prepare('SELECT * FROM feedbacks WHERE submission_id = ?').all(r.id);
      const feedback = {};
      feeds.forEach(f => {
        feedback[f.question_id] = {
          score: f.score,
          commentEn: f.comment_en,
          commentGa: f.comment_ga
        };
      });
      submissions.push({
        id: r.id,
        studentId: r.studentId,
        assessmentId: r.assessmentId,
        answers: JSON.parse(r.answersJson),
        status: r.status,
        totalScore: r.totalScore,
        submittedAt: r.submittedAt,
        feedback
      });
    }
    return submissions;
  }
}

export function saveSubmission(submission) {
  if (usePostgreSQL) {
    return pool.connect().then(async (client) => {
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
        console.error('[Database] saveSubmission error:', err);
        throw err;
      } finally {
        client.release();
      }
    });
  } else {
    const insertSub = db.prepare(`
      INSERT INTO submissions (id, student_id, assessment_id, answers_json, status, total_score, submitted_at)
      VALUES (@id, @studentId, @assessmentId, @answersJson, @status, @totalScore, @submittedAt)
    `);
    const insertFeed = db.prepare(`
      INSERT INTO feedbacks (submission_id, question_id, score, comment_en, comment_ga)
      VALUES (@submissionId, @questionId, @score, @commentEn, @commentGa)
    `);

    const runTransaction = db.transaction((sub) => {
      insertSub.run({
        id: sub.id,
        studentId: sub.studentId,
        assessmentId: sub.assessmentId,
        answersJson: JSON.stringify(sub.answers),
        status: sub.status,
        totalScore: sub.totalScore ?? null,
        submittedAt: sub.submittedAt
      });
      if (sub.feedback) {
        for (const [qId, f] of Object.entries(sub.feedback)) {
          insertFeed.run({
            submissionId: sub.id,
            questionId: qId,
            score: f.score,
            commentEn: f.commentEn,
            commentGa: f.commentGa
          });
        }
      }
    });

    runTransaction(submission);
    return submission;
  }
}

export async function getUser(email, accessId) {
  if (usePostgreSQL) {
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
  } else {
    const u = db.prepare(`
      SELECT id, email, name, role, access_id AS accessId
      FROM users
      WHERE LOWER(email) = LOWER(?) AND access_id = ?
    `).get(email, accessId);
    if (u) {
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        examNumber: u.role === 'student' ? u.accessId : undefined,
        teacherId: u.role === 'teacher' ? u.accessId : undefined
      };
    }
    return null;
  }
}

export function getUsers(role = null) {
  return listUsers(role);
}

export function getSubmissions(studentId = null) {
  return listSubmissions(studentId);
}

export function createSubmission(submission) {
  return saveSubmission(submission);
}

export function updateAssessment(id, { titleEn, titleGa, descEn, descGa }) {
  if (usePostgreSQL) {
    return pool.query(
      `UPDATE assessments
       SET title_en = $1, title_ga = $2, description_en = $3, description_ga = $4
       WHERE id = $5`,
      [titleEn, titleGa, descEn, descGa, id]
    ).then(res => {
      if (res.rowCount === 0) throw new Error(`Assessment ${id} not found`);
      return { id, titleEn, titleGa, descEn, descGa };
    });
  } else {
    const info = db.prepare(`
      UPDATE assessments
      SET title_en = @titleEn, title_ga = @titleGa,
          description_en = @descEn, description_ga = @descGa
      WHERE id = @id
    `).run({ id, titleEn, titleGa, descEn, descGa });
    if (info.changes === 0) throw new Error(`Assessment ${id} not found`);
    return { id, titleEn, titleGa, descEn, descGa };
  }
}

export function deleteAssessment(id) {
  if (usePostgreSQL) {
    return pool.query('DELETE FROM assessments WHERE id = $1', [id]).then(res => {
      if (res.rowCount === 0) throw new Error(`Assessment ${id} not found`);
    });
  } else {
    const info = db.prepare('DELETE FROM assessments WHERE id = ?').run(id);
    if (info.changes === 0) throw new Error(`Assessment ${id} not found`);
  }
}