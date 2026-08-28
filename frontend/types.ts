export interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'teacher';
  examNumber?: string; // For students
  teacherId?: string; // For teachers
  accessId?: string;
}

export interface BilingualText {
  en: string;
  ga: string;
}

export type QuestionType = 'mcq' | 'written';

export interface Question {
  id: string;
  type: QuestionType;
  text: BilingualText;
  maxMarks: number;
  // For MCQ
  options?: BilingualText[];
  correctAnswerIndex?: number;
  // For Written
  markScheme?: BilingualText;
}

export interface Assessment {
  id: string;
  title: BilingualText;
  description: BilingualText;
  questions: Question[];
}

export interface AnswerFeedback {
  score: number;
  commentGa: string;
  commentEn: string;
}

export interface Submission {
  id: string;
  studentId: string;
  assessmentId: string;
  answers: Record<string, string>; // questionId -> student's answer (for MCQ, it's the option index as a string)
  status: 'pending' | 'graded';
  totalScore?: number;
  feedback?: Record<string, AnswerFeedback>; // questionId -> feedback
  submittedAt: string;
}

export type AppState = 'login' | 'dashboard' | 'teacher-dashboard' | 'assessment' | 'grading' | 'results';
