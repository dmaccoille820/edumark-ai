import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
    password TEXT NOT NULL CHECK (password GLOB '[0-9][0-9][0-9][0-9]')
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

const seedUser = db.prepare(`
  INSERT OR IGNORE INTO users (id, email, name, role, access_id, password)
  VALUES (@id, @email, @name, @role, @accessId, @password)
`);

for (const user of [
  { id: 's1', email: 'student@school.edu', name: 'Alex Johnson', role: 'student', accessId: 'EXAM123', password: '1234' },
  { id: 's2', email: 'jane@school.edu', name: 'Jane Smith', role: 'student', accessId: 'EXAM456', password: '4567' },
  { id: 't1', email: 'teacher@school.edu', name: 'Mr. Davis', role: 'teacher', accessId: 'TEACH999', password: '9999' },
]) {
  seedUser.run(user);
}

export function findUser(email, password) {
  return db.prepare(`
    SELECT id, email, name, role, access_id AS accessId
    FROM users
    WHERE email = ? AND password = ?
  `).get(email, password);
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