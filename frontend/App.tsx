import React, { useState, useCallback, useEffect } from 'react';
import { User, Assessment, Submission, AppState, AnswerFeedback } from './types';
import { gradeWrittenAnswer } from './services/aiService';

import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { TeacherDashboard } from './components/TeacherDashboard';
import { AssessmentView } from './components/AssessmentView';
import { ResultsView } from './components/ResultsView';
import { GradingOverlay } from './components/GradingOverlay';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentAssessment, setCurrentAssessment] = useState<Assessment | null>(null);
  const [currentSubmission, setCurrentSubmission] = useState<Submission | null>(null);

  // DB backend states
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!currentUser) {
      setAssessments([]);
      setSubmissions([]);
      setStudents([]);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const assRes = await fetch('/api-proxy/assessments');
        if (assRes.ok) {
          const assData = await assRes.json();
          setAssessments(assData);
        }

        const subUrl = currentUser.role === 'student'
          ? `/api-proxy/submissions?studentId=${currentUser.id}`
          : '/api-proxy/submissions';
        const subRes = await fetch(subUrl);
        if (subRes.ok) {
          const subData = await subRes.json();
          setSubmissions(subData);
        }

        if (currentUser.role === 'teacher') {
          const uRes = await fetch('/api-proxy/users?role=student');
          if (uRes.ok) {
            const uData = await uRes.json();
            setStudents(uData);
          }
        }
      } catch (err) {
        console.error('Error fetching data from database API:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'teacher') {
      setAppState('teacher-dashboard');
    } else {
      setAppState('dashboard');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentAssessment(null);
    setCurrentSubmission(null);
    setAppState('login');
  };

  const handleStartAssessment = (assessment: Assessment) => {
    setCurrentAssessment(assessment);
    setAppState('assessment');
  };

  const handleViewResults = (submission: Submission) => {
    const assessment = assessments.find(a => a.id === submission.assessmentId);
    if (assessment) {
      setCurrentAssessment(assessment);
      setCurrentSubmission(submission);
      setAppState('results');
    }
  };

  const handleAssessmentSubmit = useCallback(async (answers: Record<string, string>) => {
    if (!currentUser || !currentAssessment) return;

    setAppState('grading');

    const submissionId = `sub_${Date.now()}`;
    const feedback: Record<string, AnswerFeedback> = {};
    let totalScore = 0;

    // Process each question
    for (const question of currentAssessment.questions) {
      const studentAnswer = answers[question.id] || '';

      if (question.type === 'mcq') {
        // Auto-grade MCQ
        const answerIndex = parseInt(studentAnswer);
        const isCorrect = !isNaN(answerIndex) && answerIndex === question.correctAnswerIndex;
        const score = isCorrect ? question.maxMarks : 0;
        totalScore += score;
        
        const correctOptionGa = question.options?.[question.correctAnswerIndex ?? 0]?.ga || '';
        const correctOptionEn = question.options?.[question.correctAnswerIndex ?? 0]?.en || '';

        feedback[question.id] = {
          score,
          commentGa: isCorrect ? 'Ceart.' : `Mícheart. Is é an freagra ceart ná: ${correctOptionGa}.`,
          commentEn: isCorrect ? 'Correct.' : `Incorrect. The correct answer is: ${correctOptionEn}.`,
        };
      } else if (question.type === 'written') {
        // Grade written with AI
        if (studentAnswer.trim() === '') {
           feedback[question.id] = { 
             score: 0, 
             commentGa: 'Níor cuireadh aon fhreagra ar fáil.', 
             commentEn: 'No answer provided.' 
           };
        } else {
           const aiFeedback = await gradeWrittenAnswer(question, studentAnswer);
           feedback[question.id] = aiFeedback;
           totalScore += aiFeedback.score;
        }
      }
    }

    const newSubmission: Submission = {
      id: submissionId,
      studentId: currentUser.id,
      assessmentId: currentAssessment.id,
      answers,
      status: 'graded',
      totalScore,
      feedback,
      submittedAt: new Date().toISOString(),
    };

    try {
      // Save to Database via API
      const res = await fetch('/api-proxy/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSubmission)
      });
      if (!res.ok) {
        throw new Error('Failed to save submission to the database.');
      }
      const savedSubmission = await res.json();
      setSubmissions(prev => [savedSubmission, ...prev]);
      setCurrentSubmission(savedSubmission);
    } catch (err) {
      console.error('Error submitting assessment:', err);
      // Fallback locally
      setCurrentSubmission(newSubmission);
    }
    
    setAppState('results');
  }, [currentUser, currentAssessment]);

  // Render logic based on state
  if (appState === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  if (!currentUser) {
    setAppState('login');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-600 font-medium">Loading data from portal...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {appState === 'teacher-dashboard' && currentUser.role === 'teacher' && (
        <TeacherDashboard
          teacher={currentUser}
          initialAssessments={assessments}
          initialSubmissions={submissions}
          students={students}
          onLogout={handleLogout}
        />
      )}

      {appState === 'dashboard' && currentUser.role === 'student' && (
        <Dashboard
          student={currentUser}
          assessments={assessments}
          submissions={submissions}
          onStartAssessment={handleStartAssessment}
          onViewResults={handleViewResults}
          onLogout={handleLogout}
        />
      )}

      {appState === 'assessment' && currentAssessment && (
        <AssessmentView
          assessment={currentAssessment}
          onSubmit={handleAssessmentSubmit}
          onCancel={() => setAppState('dashboard')}
        />
      )}

      {appState === 'grading' && (
        <GradingOverlay />
      )}

      {appState === 'results' && currentAssessment && currentSubmission && (
        <ResultsView
          assessment={currentAssessment}
          submission={currentSubmission}
          onBack={() => setAppState('dashboard')}
        />
      )}
    </>
  );
};

export default App;
