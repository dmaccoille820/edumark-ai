import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = ':memory:';
const { db, findUser, listSubmissions, saveSubmission } = await import('./database.js');

test('accepts four-digit passwords and persists submissions for teacher retrieval', () => {
  assert.equal(findUser('student@school.edu', '1234').id, 's1');
  db.prepare(`
    INSERT INTO users (id, email, name, role, access_id, password)
    VALUES ('leading-zero', 'zero@school.edu', 'Zero Student', 'student', 'EXAM000', '0123')
  `).run();
  assert.equal(findUser('zero@school.edu', '0123').id, 'leading-zero');

  saveSubmission({
    id: 'test_submission',
    studentId: 's1',
    assessmentId: 'a1',
    answers: { q1: '1' },
    status: 'graded',
    totalScore: 1,
    feedback: { q1: { score: 1, commentEn: 'Correct.', commentGa: 'Ceart.' } },
    submittedAt: '2026-08-28T00:00:00.000Z',
  });

  assert.deepEqual(listSubmissions()[0], {
    id: 'test_submission',
    studentId: 's1',
    assessmentId: 'a1',
    answers: { q1: '1' },
    status: 'graded',
    totalScore: 1,
    feedback: { q1: { score: 1, commentEn: 'Correct.', commentGa: 'Ceart.' } },
    submittedAt: '2026-08-28T00:00:00.000Z',
  });
});