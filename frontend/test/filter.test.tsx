/**
 * filter.test.tsx
 * Tests for the assessment search / filter feature on the student Dashboard
 * and the teacher Dashboard's Available Assessments section.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

// ─── Shared mock data ──────────────────────────────────────────────────────────

const { mockLoginStudent, mockLoginTeacher, mockAssessments } = vi.hoisted(() => ({
  mockLoginStudent: vi.fn(),
  mockLoginTeacher: vi.fn(),
  mockAssessments: [
    {
      id: 'a1',
      title: { en: 'Introduction to Biology', ga: 'Réamhrá don Bhitheolaíocht' },
      description: { en: 'A biology assessment covering cells.', ga: 'Measúnú bitheolaíochta.' },
      questions: [
        {
          id: 'q1',
          type: 'mcq',
          text: { en: 'What is the powerhouse of the cell?', ga: '...' },
          maxMarks: 1,
          options: [
            { en: 'Nucleus', ga: '...' },
            { en: 'Mitochondria', ga: '...' },
          ],
          correctAnswerIndex: 1,
        },
      ],
    },
    {
      id: 'a2',
      title: { en: 'Chemistry Fundamentals', ga: 'Bunúsanna Ceimice' },
      description: { en: 'Basic chemistry concepts.', ga: 'Coincheapa bunúsacha ceimice.' },
      questions: [
        {
          id: 'q2',
          type: 'mcq',
          text: { en: 'What is H2O?', ga: '...' },
          maxMarks: 1,
          options: [
            { en: 'Water', ga: '...' },
            { en: 'Oxygen', ga: '...' },
          ],
          correctAnswerIndex: 0,
        },
      ],
    },
    {
      id: 'a3',
      title: { en: 'Irish History', ga: 'Stair na hÉireann' },
      description: { en: 'History of Ireland 1800-1922.', ga: 'Stair na hÉireann.' },
      questions: [
        {
          id: 'q3',
          type: 'mcq',
          text: { en: 'When was the Easter Rising?', ga: '...' },
          maxMarks: 1,
          options: [
            { en: '1916', ga: '...' },
            { en: '1918', ga: '...' },
          ],
          correctAnswerIndex: 0,
        },
      ],
    },
  ],
}));

vi.mock('../services/aiService', () => ({
  gradeWrittenAnswer: vi.fn(),
  generateAssessmentFromPdfs: vi.fn(),
  generateAssessmentFromFactFiles: vi.fn(),
}));

vi.mock('../services/api', () => ({
  login: (...args: any[]) => {
    const email = args[0] as string;
    if (email.includes('teacher')) return mockLoginTeacher(...args);
    return mockLoginStudent(...args);
  },
  saveSubmission: vi.fn().mockImplementation((s: any) => Promise.resolve(s)),
  getSubmissions: vi.fn().mockResolvedValue([]),
  getAssessments: vi.fn().mockResolvedValue(mockAssessments),
  getStudents: vi.fn().mockResolvedValue([]),
  clearSession: vi.fn(),
}));

// ─── Helper: log in as student and reach Dashboard ────────────────────────────

async function loginAsStudent() {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Email Address'), {
    target: { value: 'student@school.edu' },
  });
  fireEvent.change(screen.getByLabelText('Password (4 digits)'), {
    target: { value: '0123' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Access Portal' }));
  await screen.findByText('My Assessments');
}

// ─── Helper: log in as teacher and reach Teacher Dashboard ────────────────────

async function loginAsTeacher() {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Email Address'), {
    target: { value: 'teacher@school.edu' },
  });
  fireEvent.change(screen.getByLabelText('Password (4 digits)'), {
    target: { value: '9999' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Access Portal' }));
  await screen.findByText('Teacher Dashboard');
}

// ─── Student Dashboard filter tests ──────────────────────────────────────────

describe('Student Dashboard - assessment search / filter', () => {
  beforeEach(() => {
    mockLoginStudent.mockResolvedValue({
      id: 's1',
      email: 'student@school.edu',
      name: 'Alex Johnson',
      role: 'student',
      examNumber: 'EXAM123',
    });
  });

  it('renders all assessments on initial load with the search input visible', async () => {
    await loginAsStudent();

    expect(screen.getByLabelText('Search assessments')).toBeInTheDocument();
    expect(screen.getByText('Introduction to Biology')).toBeInTheDocument();
    expect(screen.getByText('Chemistry Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('Irish History')).toBeInTheDocument();
  });

  it('filters assessments by English title (case-insensitive)', async () => {
    await loginAsStudent();

    fireEvent.change(screen.getByLabelText('Search assessments'), {
      target: { value: 'biology' },
    });

    await waitFor(() => {
      expect(screen.getByText('Introduction to Biology')).toBeInTheDocument();
    });

    expect(screen.queryByText('Chemistry Fundamentals')).not.toBeInTheDocument();
    expect(screen.queryByText('Irish History')).not.toBeInTheDocument();
  });

  it('filters assessments by Irish (Gaeilge) title', async () => {
    await loginAsStudent();

    fireEvent.change(screen.getByLabelText('Search assessments'), {
      target: { value: 'Ceimice' },
    });

    await waitFor(() => {
      expect(screen.getByText('Chemistry Fundamentals')).toBeInTheDocument();
    });

    expect(screen.queryByText('Introduction to Biology')).not.toBeInTheDocument();
    expect(screen.queryByText('Irish History')).not.toBeInTheDocument();
  });

  it('filters assessments by description text', async () => {
    await loginAsStudent();

    fireEvent.change(screen.getByLabelText('Search assessments'), {
      target: { value: 'cells' },
    });

    await waitFor(() => {
      expect(screen.getByText('Introduction to Biology')).toBeInTheDocument();
    });

    expect(screen.queryByText('Chemistry Fundamentals')).not.toBeInTheDocument();
  });

  it('shows an empty state when no assessments match the query', async () => {
    await loginAsStudent();

    fireEvent.change(screen.getByLabelText('Search assessments'), {
      target: { value: 'xyznonexistent' },
    });

    await waitFor(() => {
      expect(screen.getByText(/No assessments match/i)).toBeInTheDocument();
    });

    expect(screen.queryByText('Introduction to Biology')).not.toBeInTheDocument();
  });

  it('restores all assessments when the search query is cleared', async () => {
    await loginAsStudent();

    const searchInput = screen.getByLabelText('Search assessments');
    fireEvent.change(searchInput, { target: { value: 'biology' } });

    await waitFor(() =>
      expect(screen.queryByText('Chemistry Fundamentals')).not.toBeInTheDocument()
    );

    fireEvent.change(searchInput, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.getByText('Introduction to Biology')).toBeInTheDocument();
      expect(screen.getByText('Chemistry Fundamentals')).toBeInTheDocument();
      expect(screen.getByText('Irish History')).toBeInTheDocument();
    });
  });
});

// ─── Teacher Dashboard filter tests ──────────────────────────────────────────

describe('Teacher Dashboard - assessment filter', () => {
  beforeEach(() => {
    mockLoginTeacher.mockResolvedValue({
      id: 't1',
      email: 'teacher@school.edu',
      name: 'Ms. Smith',
      role: 'teacher',
      teacherId: 'T001',
    });
  });

  it('renders all assessments on initial load with filter input visible', async () => {
    await loginAsTeacher();

    expect(screen.getByLabelText('Filter assessments')).toBeInTheDocument();
    expect(screen.getByText('Introduction to Biology')).toBeInTheDocument();
    expect(screen.getByText('Chemistry Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('Irish History')).toBeInTheDocument();
  });

  it('filters assessments by English title', async () => {
    await loginAsTeacher();

    fireEvent.change(screen.getByLabelText('Filter assessments'), {
      target: { value: 'Chemistry' },
    });

    await waitFor(() => {
      expect(screen.getByText('Chemistry Fundamentals')).toBeInTheDocument();
    });

    expect(screen.queryByText('Introduction to Biology')).not.toBeInTheDocument();
    expect(screen.queryByText('Irish History')).not.toBeInTheDocument();
  });

  it('filters assessments by Irish title (case-insensitive)', async () => {
    await loginAsTeacher();

    fireEvent.change(screen.getByLabelText('Filter assessments'), {
      target: { value: 'stair' },
    });

    await waitFor(() => {
      expect(screen.getByText('Irish History')).toBeInTheDocument();
    });

    expect(screen.queryByText('Introduction to Biology')).not.toBeInTheDocument();
    expect(screen.queryByText('Chemistry Fundamentals')).not.toBeInTheDocument();
  });

  it('shows empty state message when no assessments match', async () => {
    await loginAsTeacher();

    fireEvent.change(screen.getByLabelText('Filter assessments'), {
      target: { value: 'zzznomatch' },
    });

    await waitFor(() => {
      expect(screen.getByText(/No assessments match/i)).toBeInTheDocument();
    });
  });
});
