import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = ':memory:';
const { db, findUser, hashExamNumber, listSubmissions, saveSubmission } = await import('./database.js');

test('accepts four-digit passwords and persists submissions for teacher retrieval', () => {
  assert.equal(findUser('student@school.edu', '0123').id, 's1');
  db.prepare(`
    INSERT INTO users (id, email, name, role, access_id, password)
    VALUES ('leading-zero', 'zero@school.edu', 'Zero Student', 'student', 'EXAM000', ?)
  `).run(hashExamNumber('0123'));
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

  const firstSub = listSubmissions()[0];
  assert.equal(firstSub.id, 'test_submission');
  assert.equal(firstSub.studentId, 's1');
  assert.equal(firstSub.totalScore, 1);
  assert.equal(firstSub.feedback?.q1?.commentEn, 'Correct.');
});

test('deleteSubmission removes submission and associated feedbacks', async () => {
  const { deleteSubmission } = await import('./database.js');
  
  saveSubmission({
    id: 'sub_to_delete',
    studentId: 's2',
    assessmentId: 'a1',
    answers: { q1: '1' },
    status: 'graded',
    totalScore: 1,
    feedback: { q1: { score: 1, commentEn: 'Good', commentGa: 'Maith' } },
    submittedAt: '2026-08-28T00:00:00.000Z',
  });

  const subsBefore = listSubmissions();
  assert(subsBefore.some(s => s.id === 'sub_to_delete'));

  deleteSubmission('sub_to_delete');

  const subsAfter = listSubmissions();
  assert(!subsAfter.some(s => s.id === 'sub_to_delete'));
  const feedbackRows = db.prepare('SELECT * FROM feedbacks WHERE submission_id = ?').all('sub_to_delete');
  assert.equal(feedbackRows.length, 0);
});

test('deleteUser cascades and removes all student submissions and feedbacks', async () => {
  const { deleteUser } = await import('./database.js');

  // Insert a test student
  db.prepare(`
    INSERT INTO users (id, email, name, role, access_id, password)
    VALUES ('cascade_student', 'cascade@school.edu', 'Cascade Student', 'student', 'EXAM999', 'pass')
  `).run();

  saveSubmission({
    id: 'cascade_sub_1',
    studentId: 'cascade_student',
    assessmentId: 'a1',
    answers: { q1: '1' },
    status: 'graded',
    totalScore: 1,
    feedback: { q1: { score: 1, commentEn: 'Done', commentGa: 'Déanta' } },
    submittedAt: '2026-08-28T00:00:00.000Z',
  });

  saveSubmission({
    id: 'cascade_sub_2',
    studentId: 'cascade_student',
    assessmentId: 'a1',
    answers: { q1: '1' },
    status: 'graded',
    totalScore: 1,
    feedback: { q1: { score: 1, commentEn: 'Done 2', commentGa: 'Déanta 2' } },
    submittedAt: '2026-08-28T00:00:00.000Z',
  });

  const subsBefore = listSubmissions();
  assert(subsBefore.some(s => s.id === 'cascade_sub_1'));
  assert(subsBefore.some(s => s.id === 'cascade_sub_2'));

  deleteUser('cascade_student');

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get('cascade_student');
  assert.equal(userRow, undefined);

  const subsAfter = listSubmissions();
  assert(!subsAfter.some(s => s.studentId === 'cascade_student'));
  assert(!subsAfter.some(s => s.id === 'cascade_sub_1'));
  assert(!subsAfter.some(s => s.id === 'cascade_sub_2'));

  const feedbackRows1 = db.prepare('SELECT * FROM feedbacks WHERE submission_id = ?').all('cascade_sub_1');
  const feedbackRows2 = db.prepare('SELECT * FROM feedbacks WHERE submission_id = ?').all('cascade_sub_2');
  assert.equal(feedbackRows1.length, 0);
  assert.equal(feedbackRows2.length, 0);
});