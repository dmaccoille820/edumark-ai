export interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'teacher';
  examNumber?: string;
  teacherId?: string;
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
  options?: BilingualText[];
  correctAnswerIndex?: number;
  markScheme?: BilingualText;
  image?: {
    en?: string;
    ga?: string;
  };
  markSchemeImage?: string;
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
  studentImage?: string;
  isAmended?: boolean;
}

export interface Submission {
  id: string;
  studentId: string;
  assessmentId: string;
  answers: Record<string, string>;
  status: 'pending' | 'provisional' | 'graded';
  totalScore?: number;
  feedback?: Record<string, AnswerFeedback>;
  submittedAt: string;
  amendedAt?: string;
  teacherNotes?: string;
}

export type AppState = 'login' | 'dashboard' | 'teacher-dashboard' | 'assessment' | 'grading' | 'results';