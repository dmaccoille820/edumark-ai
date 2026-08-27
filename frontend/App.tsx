import React, { useState, useCallback } from 'react';
import { User, Assessment, Submission, AppState, AnswerFeedback } from './types';
import { MOCK_SUBMISSIONS } from './mockDb';
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
    import('./mockDb').then(({ MOCK_ASSESSMENTS }) => {
      const assessment = MOCK_ASSESSMENTS.find(a => a.id === submission.assessmentId);
      if (assessment) {
        setCurrentAssessment(assessment);
        setCurrentSubmission(submission);
        setAppState('results');
      }
    });
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

    // Save to mock DB
    MOCK_SUBMISSIONS.push(newSubmission);
    
    setCurrentSubmission(newSubmission);
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

  return (
    <>
      {appState === 'teacher-dashboard' && currentUser.role === 'teacher' && (
        <TeacherDashboard
          teacher={currentUser}
          onLogout={handleLogout}
        />
      )}

      {appState === 'dashboard' && currentUser.role === 'student' && (
        <Dashboard
          student={currentUser}
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
