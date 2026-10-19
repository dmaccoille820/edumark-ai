import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Question } from '../types';

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    })),
    Type: {
      OBJECT: 'OBJECT',
      INTEGER: 'INTEGER',
      STRING: 'STRING',
      ARRAY: 'ARRAY',
    },
  };
});

// Import aiService after mock
import { gradeWrittenAnswer } from '../services/aiService';

describe('aiService - gradeWrittenAnswer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleQuestion: Question = {
    id: 'q1',
    type: 'written',
    text: { en: 'What is photosynthesis?', ga: 'Cad is fótaisintéis ann?' },
    maxMarks: 4,
    markScheme: { en: 'Mentions light energy converted to chemical energy.', ga: 'Fuinnimh solais...' },
  };

  it('grades successfully when AI returns valid JSON', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        score: 3,
        feedbackIrish: 'Freagra maith ach easpa sonraí.',
        feedbackEnglish: 'Good answer but lacks some details.',
      }),
    });

    const result = await gradeWrittenAnswer(sampleQuestion, 'Plants make food using sunlight');
    expect(result.score).toBe(3);
    expect(result.commentEn).toBe('Good answer but lacks some details.');
    expect(result.commentGa).toBe('Freagra maith ach easpa sonraí.');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('recovers if a 429 rate limit happens initially and succeeds on retry', async () => {
    mockGenerateContent
      .mockRejectedValueOnce({
        status: 429,
        message: 'Resource exhausted. Please try again later.',
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          score: 4,
          feedbackIrish: 'Freagra foirfe.',
          feedbackEnglish: 'Perfect answer.',
        }),
      });

    const result = await gradeWrittenAnswer(sampleQuestion, 'Complete photosynthesis explanation');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(result.score).toBe(4);
    expect(result.commentEn).toBe('Perfect answer.');
  });

  it('provides student-friendly delayed review message if 429 persists after all retries', async () => {
    mockGenerateContent.mockRejectedValue({
      status: 429,
      message: 'Resource exhausted. Please try again later.',
    });

    const result = await gradeWrittenAnswer(sampleQuestion, 'Some answer');
    expect(result.score).toBe(0);
    expect(result.commentEn).toContain('Automated grading is temporarily delayed due to high server traffic');
    expect(result.commentGa).toContain('Tá moill ar an ngrádú uathoibrithe');
  });
});
