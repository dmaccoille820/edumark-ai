import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
const databasePath = process.env.DATABASE_PATH || path.join(backendDirectory, 'data', 'edumark.sqlite');
if (databasePath !== ':memory:') {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

export const db = new Database(databasePath);
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

  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id),
    assessment_id TEXT NOT NULL,
    answers_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'graded')),
    total_score INTEGER,
    feedback_json TEXT,
    submitted_at TEXT NOT NULL
  );
`);

const userColumns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
if (!userColumns.includes('upn')) {
  db.exec('ALTER TABLE users ADD COLUMN upn TEXT');
}

export function hashExamNumber(examNumber) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(examNumber, salt, 64).toString('hex')}`;
}

function verifyExamNumber(examNumber, storedHash) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const actual = crypto.scryptSync(examNumber, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// Convert passwords from the original local development schema on first startup.
const legacyUsers = db.prepare("SELECT id, password FROM users WHERE password GLOB '[0-9][0-9][0-9][0-9]'").all();
const migratePassword = db.prepare('UPDATE users SET password = ? WHERE id = ?');
for (const user of legacyUsers) {
  migratePassword.run(hashExamNumber(user.password), user.id);
}

const seedUser = db.prepare(`
  INSERT OR IGNORE INTO users (id, email, upn, name, role, access_id, password)
  VALUES (@id, @email, @upn, @name, @role, @accessId, @password)
`);

for (const user of [
  { id: 's1', email: 'student@school.edu', name: 'Alex Johnson', role: 'student', accessId: '0123', password: '0123' },
  { id: 's2', email: 'jane@school.edu', name: 'Jane Smith', role: 'student', accessId: '0456', password: '0456' },
  { id: 't1', email: 'teacher@school.edu', name: 'Mr. Davis', role: 'teacher', accessId: '9999', password: '9999' },
]) {
  seedUser.run({ ...user, upn: null, password: hashExamNumber(user.password) });
}

export function findUser(email, password) {
  const user = db.prepare(`
    SELECT id, email, name, role, access_id AS accessId, password
    FROM users
    WHERE email = ?
  `).get(email);
  if (!user || !verifyExamNumber(password, user.password)) return undefined;
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

export function saveSubmission(submission) {
  db.prepare(`
    INSERT INTO submissions
      (id, student_id, assessment_id, answers_json, status, total_score, feedback_json, submitted_at)
    VALUES (@id, @studentId, @assessmentId, @answersJson, @status, @totalScore, @feedbackJson, @submittedAt)
  `).run({
    id: submission.id,
    studentId: submission.studentId,
    assessmentId: submission.assessmentId,
    answersJson: JSON.stringify(submission.answers),
    status: submission.status,
    totalScore: submission.totalScore ?? null,
    feedbackJson: submission.feedback ? JSON.stringify(submission.feedback) : null,
    submittedAt: submission.submittedAt,
  });
  return submission;
}

export function listSubmissions() {
  return db.prepare(`
    SELECT id, student_id AS studentId, assessment_id AS assessmentId,
      answers_json AS answersJson, status, total_score AS totalScore,
      feedback_json AS feedbackJson, submitted_at AS submittedAt
    FROM submissions
    ORDER BY submitted_at DESC
  `).all().map(({ answersJson, feedbackJson, ...submission }) => ({
    ...submission,
    answers: JSON.parse(answersJson),
    ...(feedbackJson ? { feedback: JSON.parse(feedbackJson) } : {}),
  }));
}