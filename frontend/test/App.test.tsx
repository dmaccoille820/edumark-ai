import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

const { mockLogin, mockSaveSubmission, mockAssessments } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockSaveSubmission: vi.fn(),
  mockAssessments: [
    {
      id: 'a1',
      title: { en: 'Introduction to Biology', ga: 'Réamhrá don Bhitheolaíocht' },
      description: { en: 'Biology assessment', ga: 'Measúnú bitheolaíochta' },
      questions: [
        {
          id: 'q1',
          type: 'mcq',
          text: { en: 'Which organelle is known as the powerhouse of the cell?', ga: '...' },
          maxMarks: 1,
          options: [
            { en: 'Nucleus', ga: '...' },
            { en: 'Mitochondria', ga: '...' },
            { en: 'Ribosome', ga: '...' },
            { en: 'Endoplasmic Reticulum', ga: '...' }
          ],
          correctAnswerIndex: 1
        },
        {
          id: 'q2',
          type: 'written',
          text: { en: 'Explain the basic process of photosynthesis in plants.', ga: '...' },
          maxMarks: 3,
          markScheme: { en: 'Award 1 mark for mentioning sunlight/light energy.', ga: '...' }
        },
        {
          id: 'q3',
          type: 'written',
          text: { en: 'Describe the difference between a prokaryotic and a eukaryotic cell.', ga: '...' },
          maxMarks: 2,
          markScheme: { en: 'Award 1 mark for stating eukaryotic cells have a membrane-bound nucleus.', ga: '...' }
        }
      ]
    }
  ]
}));

vi.mock('../services/aiService', () => ({
  gradeWrittenAnswer: vi.fn(),
}));
vi.mock('../services/api', () => ({
  login: mockLogin,
  saveSubmission: mockSaveSubmission,
  getSubmissions: vi.fn().mockResolvedValue([]),
  getAssessments: vi.fn().mockResolvedValue(mockAssessments),
  getStudents: vi.fn().mockResolvedValue([]),
  clearSession: vi.fn(),
}));

describe('student assessment flow', () => {
  beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    mockLogin.mockResolvedValue({
      id: 's1', email: 'student@school.edu', name: 'Alex Johnson', role: 'student', examNumber: 'EXAM123',
    });
    mockSaveSubmission.mockImplementation((submission) => Promise.resolve(submission));
  });

  it('logs a student in, submits an assessment, and shows the MCQ score', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'student@school.edu' },
    });
    fireEvent.change(screen.getByLabelText('Password (4 digits)'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Access Portal' }));

    expect(await screen.findByText('My Assessments')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Start Assessment' })[0]);

    expect(await screen.findByText('Introduction to Biology')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Mitochondria'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Assessment' }));

    expect(window.confirm).toHaveBeenCalledWith(
      'You have 2 unanswered questions. Are you sure you want to submit?'
    );
    expect(
      await screen.findByRole('heading', { name: /Assessment Results/ })
    ).toBeInTheDocument();
    const scorePanel = screen.getByText('Total Score').parentElement;
    expect(scorePanel).not.toBeNull();
    await waitFor(() => expect(scorePanel).toHaveTextContent(/1\s*\/\s*6/));
  });

  it('keeps invalid credentials on the login screen', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'student@school.edu' },
    });
    fireEvent.change(screen.getByLabelText('Password (4 digits)'), { target: { value: '0000' } });
    mockLogin.mockRejectedValueOnce(new Error('Invalid email or password.'));
    fireEvent.click(screen.getByRole('button', { name: 'Access Portal' }));

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
  });
});