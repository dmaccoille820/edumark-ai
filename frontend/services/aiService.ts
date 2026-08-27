import { GoogleGenAI, Type } from '@google/genai';
import { Question, AnswerFeedback } from '../types';

// Initialize the SDK. Assumes process.env.API_KEY is available in the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY, vertexai: true });

export const gradeWrittenAnswer = async (
  question: Question,
  studentAnswer: string
): Promise<AnswerFeedback> => {
  if (question.type !== 'written') {
    throw new Error('Can only grade written questions with AI.');
  }

  const prompt = `
    You are an expert, impartial bilingual examiner grading a student's answer.
    
    Question (English): "${question.text.en}"
    Question (Irish): "${question.text.ga}"
    Maximum Marks Available: ${question.maxMarks}
    Mark Scheme (English): "${question.markScheme?.en}"
    Mark Scheme (Irish): "${question.markScheme?.ga}"
    
    Student's Answer: "${studentAnswer}"
    
    Evaluate the student's answer strictly against the provided mark scheme. The student may have answered in English, Irish, or a mix of both.
    Determine the score (an integer between 0 and ${question.maxMarks}).
    Provide concise, constructive feedback explaining why the marks were awarded or lost based on the mark scheme.
    You MUST provide the feedback in BOTH Irish (Gaeilge) and English.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: {
              type: Type.INTEGER,
              description: `The awarded marks, from 0 to ${question.maxMarks}.`,
            },
            feedbackIrish: {
              type: Type.STRING,
              description: 'Constructive feedback in Irish (Gaeilge) explaining the score.',
            },
            feedbackEnglish: {
              type: Type.STRING,
              description: 'Constructive feedback in English explaining the score.',
            },
          },
          required: ['score', 'feedbackIrish', 'feedbackEnglish'],
        },
        temperature: 0.1, // Low temperature for more deterministic grading
      },
    });

    let jsonStr = response.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/```$/, '').trim();
    }
    const result = JSON.parse(jsonStr);
    
    // Ensure score is within bounds just in case
    const clampedScore = Math.max(0, Math.min(result.score, question.maxMarks));

    return {
      score: clampedScore,
      commentGa: result.feedbackIrish,
      commentEn: result.feedbackEnglish,
    };
  } catch (error: any) {
    console.error('Error grading answer with AI:', error);
    return {
      score: 0,
      commentGa: 'Earráid le linn grádaithe uathoibrithe. Iarr athbhreithniú láimhe le do thoil.',
      commentEn: `Error during automated grading: ${error.message || 'Unknown error'}. Please request manual review.`,
    };
  }
};

export const generateAssessmentFromPdfs = async (
  enPdfBase64: string,
  gaPdfBase64: string,
  msPdfBase64: string
): Promise<Question[]> => {
  const prompt = `
    You are an expert curriculum designer and bilingual educator. I am providing 3 PDF documents:
    1. The assessment in English.
    2. The exact same assessment translated to Irish (Gaeilge).
    3. The mark scheme in English.

    Your task is to extract all questions, their maximum marks, and their mark scheme.
    - Correlate the English questions with their exact Irish translations.
    - If a question is multiple choice (MCQ), extract the options in both languages and determine the correct answer index (0-based) based on the mark scheme.
    - If a question is a written answer, extract the mark scheme in English and translate it accurately to Irish.
    - Output a JSON object containing a "questions" array.
  `;

  try {
    console.log("Sending PDF generation request to Gemini...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: enPdfBase64 } },
          { inlineData: { mimeType: 'application/pdf', data: gaPdfBase64 } },
          { inlineData: { mimeType: 'application/pdf', data: msPdfBase64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: 'A unique ID like q1, q2, etc.' },
                  type: { type: Type.STRING, description: 'Must be exactly "mcq" or "written"' },
                  text: {
                    type: Type.OBJECT,
                    properties: {
                      en: { type: Type.STRING },
                      ga: { type: Type.STRING }
                    },
                    required: ['en', 'ga']
                  },
                  maxMarks: { type: Type.INTEGER },
                  options: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        en: { type: Type.STRING },
                        ga: { type: Type.STRING }
                      },
                      required: ['en', 'ga']
                    },
                    description: 'Only include if type is "mcq"'
                  },
                  correctAnswerIndex: { type: Type.INTEGER, description: 'Only include if type is "mcq"' },
                  markScheme: {
                    type: Type.OBJECT,
                    properties: {
                      en: { type: Type.STRING },
                      ga: { type: Type.STRING }
                    },
                    description: 'Only include if type is "written"'
                  }
                },
                required: ['id', 'type', 'text', 'maxMarks']
              }
            }
          },
          required: ['questions']
        },
        temperature: 0.2,
      },
    });

    let jsonStr = response.text.trim();
    console.log("Raw response from Gemini:", jsonStr);
    
    // Strip markdown code blocks if the model accidentally includes them despite responseMimeType
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/```$/, '').trim();
    }
    
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error("Parsed JSON does not contain a 'questions' array.");
      }
      return parsed.questions;
    } catch (parseError: any) {
      console.error("Failed to parse JSON. Raw string:", jsonStr);
      throw new Error(`JSON Parse Error: ${parseError.message}\n\nRaw Output from AI:\n${jsonStr}`);
    }
  } catch (error: any) {
    console.error('Error generating assessment from PDFs:', error);
    // Pass the full error message up to the UI
    throw new Error(error.message || 'Failed to parse PDFs and generate assessment.');
  }
};
