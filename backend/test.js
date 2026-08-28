import 'dotenv/config';
import http from 'http';
import app from './server.js';
import {
  initDb,
  getUser,
  getUsers,
  getAssessments,
  createAssessment,
  getSubmissions,
  createSubmission
} from './db.js';

// Simple Assert Helper
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`  ✓ Pass: ${message}`);
};

const runTests = async () => {
  console.log('==================================================');
  console.log('           RUNNING EDUMARK AI TEST SUITE          ');
  console.log('==================================================\n');

  // Test 1: Initialize Database Connection
  console.log('1. Testing Database Initialization...');
  try {
    await initDb();
    console.log('  ✓ Database initDb finished without crash.\n');
  } catch (err) {
    console.error('  ✗ Database initialization crashed:', err);
    process.exit(1);
  }

  // Test 2: Database Layer Unit Tests
  console.log('2. Testing Database Abstraction Methods...');
  try {
    // 2.1 getUser
    const validStudent = await getUser('student@school.edu', 'EXAM123');
    assert(validStudent !== null, 'Valid student should be retrieved');
    assert(validStudent.name === 'Alex Johnson', 'Retrieved student name matches seed data');
    assert(validStudent.role === 'student', 'Retrieved student role is "student"');

    const invalidUser = await getUser('none@school.edu', 'WRONG');
    assert(invalidUser === null, 'Invalid credentials should return null user');

    // 2.2 getUsers
    const allStudents = await getUsers('student');
    assert(Array.isArray(allStudents), 'getUsers should return an array');
    assert(allStudents.length >= 2, 'Should retrieve at least 2 seeded students');

    // 2.3 getAssessments
    const assessments = await getAssessments();
    assert(Array.isArray(assessments), 'getAssessments should return an array');
    assert(assessments.length >= 2, 'Should retrieve at least 2 seeded assessments');
    const a1 = assessments.find(a => a.id === 'a1');
    assert(a1 !== undefined, 'Assessment a1 should exist');
    assert(a1.questions.length === 3, 'Assessment a1 should contain exactly 3 questions');
    assert(a1.questions[0].type === 'mcq', 'First question of a1 should be multiple choice');

    // 2.4 createAssessment
    const testAssessmentId = `test_a_${Date.now()}`;
    const testAssessment = {
      id: testAssessmentId,
      title: { en: 'Test Assessment', ga: 'Triail-Mheasúnú' },
      description: { en: 'Unit testing assessment creation', ga: 'Measúnú tástála aonaid' },
      questions: [
        {
          id: 'test_q1',
          type: 'written',
          text: { en: 'Explain test parameters', ga: 'Mínigh paraiméadair tástála' },
          maxMarks: 5,
          markScheme: { en: 'Verify explanation', ga: 'Fíoraigh míniú' }
        }
      ]
    };
    const createdAss = await createAssessment(testAssessment);
    assert(createdAss.id === testAssessmentId, 'Created assessment id matches');
    
    const updatedAssessments = await getAssessments();
    const foundNewAss = updatedAssessments.find(a => a.id === testAssessmentId);
    assert(foundNewAss !== undefined, 'New assessment is successfully persisted and retrieved');

    // 2.5 getSubmissions & createSubmission
    const initialSubmissions = await getSubmissions();
    assert(Array.isArray(initialSubmissions), 'getSubmissions should return an array');

    const testSubmissionId = `test_sub_${Date.now()}`;
    const newSub = {
      id: testSubmissionId,
      studentId: 's2',
      assessmentId: 'a1',
      answers: { 'q1': '1' },
      status: 'graded',
      totalScore: 1,
      feedback: {
        'q1': { score: 1, commentEn: 'Unit test correct', commentGa: 'Ceart tástáil' }
      },
      submittedAt: new Date().toISOString()
    };
    await createSubmission(newSub);

    const updatedSubmissions = await getSubmissions();
    const foundNewSub = updatedSubmissions.find(s => s.id === testSubmissionId);
    assert(foundNewSub !== undefined, 'Created submission is successfully persisted and retrieved');
    assert(foundNewSub.totalScore === 1, 'Persisted submission retains correct score');

    console.log('  ✓ All database abstraction tests passed successfully.\n');
  } catch (err) {
    console.error('  ✗ Database abstraction test failed:', err);
    process.exit(1);
  }

  // Test 3: API Endpoint Routing Tests
  console.log('3. Testing Server API Routing...');
  const testPort = 5009;
  const server = http.createServer(app);

  server.listen(testPort, '127.0.0.1', async () => {
    try {
      // Helper function to make HTTP requests
      const request = (method, path, body = null) => {
        return new Promise((resolve, reject) => {
          const req = http.request({
            hostname: '127.0.0.1',
            port: testPort,
            path,
            method,
            headers: {
              'Content-Type': 'application/json',
            }
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                const parsed = JSON.parse(data);
                resolve({ status: res.statusCode, body: parsed });
              } catch (e) {
                resolve({ status: res.statusCode, rawBody: data });
              }
            });
          });
          req.on('error', reject);
          if (body) {
            req.write(JSON.stringify(body));
          }
          req.end();
        });
      };

      // 3.1 Login Endpoints
      console.log('  Testing Auth Endpoints...');
      const loginSuccess = await request('POST', '/api/auth/login', {
        email: 'student@school.edu',
        accessId: 'EXAM123'
      });
      assert(loginSuccess.status === 200, 'Valid login should return 200');
      assert(loginSuccess.body.name === 'Alex Johnson', 'Login response returns student profile');

      const loginFailure = await request('POST', '/api/auth/login', {
        email: 'student@school.edu',
        accessId: 'WRONG'
      });
      assert(loginFailure.status === 401, 'Invalid login should return 401');

      // 3.2 User Listing Endpoint
      console.log('  Testing Users Endpoint...');
      const usersList = await request('GET', '/api/users?role=student');
      assert(usersList.status === 200, 'GET /api/users should return 200');
      assert(Array.isArray(usersList.body), 'Users endpoint returns an array');
      assert(usersList.body.some(u => u.name === 'Alex Johnson'), 'Contains student in the database');

      // 3.3 Assessment Endpoints
      console.log('  Testing Assessment Endpoints...');
      const assessmentsList = await request('GET', '/api/assessments');
      assert(assessmentsList.status === 200, 'GET /api/assessments should return 200');
      assert(Array.isArray(assessmentsList.body), 'Assessments returns an array');

      const testAssessmentIdAPI = `api_a_${Date.now()}`;
      const newApiAss = {
        id: testAssessmentIdAPI,
        title: { en: 'API Test Assessment', ga: 'Triail API' },
        description: { en: 'Testing API assessments creation', ga: 'Measúnú tástála API' },
        questions: []
      };
      const createAssRes = await request('POST', '/api/assessments', newApiAss);
      assert(createAssRes.status === 200, 'POST /api/assessments should create successfully');
      assert(createAssRes.body.id === testAssessmentIdAPI, 'Returned created assessment matches');

      // 3.4 Submission Endpoints
      console.log('  Testing Submission Endpoints...');
      const submissionsList = await request('GET', '/api/submissions');
      assert(submissionsList.status === 200, 'GET /api/submissions should return 200');

      const testSubIdAPI = `api_sub_${Date.now()}`;
      const newApiSub = {
        id: testSubIdAPI,
        studentId: 's2',
        assessmentId: 'a1',
        answers: { 'q1': '1' }
      };
      const createSubRes = await request('POST', '/api/submissions', newApiSub);
      assert(createSubRes.status === 200, 'POST /api/submissions should submit successfully');
      assert(createSubRes.body.id === testSubIdAPI, 'Returned created submission matches');

      console.log('\n  ✓ All API routing tests passed successfully!');
      console.log('\n==================================================');
      console.log('          ALL TESTS PASSED SUCCESSFULLY!          ');
      console.log('==================================================');

      server.close();
      process.exit(0);
    } catch (err) {
      console.error('\n  ✗ API routing test failed:', err);
      server.close();
      process.exit(1);
    }
  });
};

runTests();
