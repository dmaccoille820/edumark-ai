import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

const { mockLogin, mockSaveSubmission } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockSaveSubmission: vi.fn(),
}));

vi.mock('../services/aiService', () => ({
  gradeWrittenAnswer: vi.fn(),
}));
vi.mock('../services/api', () => ({
  login: mockLogin,
  saveSubmission: mockSaveSubmission,
  getSubmissions: vi.fn().mockResolvedValue([]),
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