import { describe, it, expect, vi } from 'vitest';
import {
  buildSummaryRows,
  buildDetailedRows,
  convertToCsv,
  exportToExcel,
  exportToDetailedCsv,
  exportToSummaryCsv,
  ExportDataParams
} from '../services/exportService';
import { Assessment, Submission, User } from '../types';

describe('exportService', () => {
  const mockStudents: User[] = [
    {
      id: 'student-1',
      name: 'Pádraig Ó Conaill',
      email: 'padraig@example.ie',
      role: 'student',
      examNumber: 'EX10234'
    },
    {
      id: 'student-2',
      name: 'Aoife Ní Bhriain',
      email: 'aoife@example.ie',
      role: 'student',
      examNumber: 'EX10235'
    }
  ];

  const mockAssessments: Assessment[] = [
    {
      id: 'assess-1',
      title: {
        en: 'Leaving Cert Biology - Cell Structure',
        ga: 'Bitheolaíocht na hArdteiste - Struchtúr Cille'
      },
      description: {
        en: 'Cell structure exam',
        ga: 'Scrúdú struchtúr cille'
      },
      questions: [
        {
          id: 'q1',
          type: 'mcq',
          text: {
            en: 'What is the function of the ribosome?',
            ga: 'Céard é feidhm an ribeasóim?'
          },
          maxMarks: 5,
          options: [
            { en: 'Protein synthesis', ga: 'Sintéis próitéine' },
            { en: 'Lipid synthesis', ga: 'Sintéis lipidí' }
          ]
        },
        {
          id: 'q2',
          type: 'written',
          text: {
            en: 'Explain osmosis in plant cells.',
            ga: 'Mínigh osmóis i gcealla plandaí.'
          },
          maxMarks: 15
        }
      ]
    }
  ];

  const mockSubmissions: Submission[] = [
    {
      id: 'sub-1',
      studentId: 'student-1',
      assessmentId: 'assess-1',
      answers: {
        q1: '0',
        q2: 'Is éard is osmóis ann ná gluaiseacht uisce trí scannán leath-thréscaoilteach ó réigiún ina bhfuil tiúchan ard uisce go réigiún ina bhfuil tiúchan íseal.'
      },
      status: 'graded',
      totalScore: 18,
      submittedAt: '2026-10-12T10:00:00.000Z',
      teacherNotes: 'Obair iontach, a Phádraig!',
      feedback: {
        q1: {
          score: 5,
          commentEn: 'Correct answer.',
          commentGa: 'Freagra ceart. Sintéis próitéine atá i gceist.'
        },
        q2: {
          score: 13,
          commentEn: 'Excellent detailed explanation of osmosis in plant cells, including semi-permeable membrane.',
          commentGa: 'Míniú den scoth ar osmóis i gcealla plandaí, ag lua an scannáin leath-thréscaoiltigh.',
          isAmended: true
        }
      }
    }
  ];

  const params: ExportDataParams = {
    assessments: mockAssessments,
    submissions: mockSubmissions,
    students: mockStudents,
    assessmentMaxMarks: { 'assess-1': 20 }
  };

  it('buildSummaryRows creates accurate summary data with Irish titles and notes', () => {
    const rows = buildSummaryRows(params);
    expect(rows).toHaveLength(1);
    expect(rows[0]['Student Name']).toBe('Pádraig Ó Conaill');
    expect(rows[0]['Assessment (GA)']).toBe('Bitheolaíocht na hArdteiste - Struchtúr Cille');
    expect(rows[0]['Percentage']).toBe('90%');
    expect(rows[0]['Teacher Notes']).toBe('Obair iontach, a Phádraig!');
  });

  it('buildDetailedRows produces one row per question and preserves long answers & Irish fadas without truncation', () => {
    const rows = buildDetailedRows(params);
    expect(rows).toHaveLength(2);

    // Q1 (MCQ)
    expect(rows[0]['Question #']).toBe(1);
    expect(rows[0]['Question Type']).toBe('MCQ');
    expect(rows[0]['Student Answer']).toContain('Protein synthesis / Sintéis próitéine');
    expect(rows[0]['Score Awarded']).toBe(5);
    expect(rows[0]['Feedback (GA)']).toBe('Freagra ceart. Sintéis próitéine atá i gceist.');

    // Q2 (Written - long Irish answer & feedback)
    expect(rows[1]['Question #']).toBe(2);
    expect(rows[1]['Question Type']).toBe('WRITTEN');
    expect(rows[1]['Question (GA)']).toBe('Mínigh osmóis i gcealla plandaí.');
    expect(rows[1]['Student Answer']).toContain('leath-thréscaoilteach');
    expect(rows[1]['Score Awarded']).toBe(13);
    expect(rows[1]['Feedback (GA)']).toContain('Míniú den scoth ar osmóis');
    expect(rows[1]['Amended']).toBe('Yes');
  });

  it('convertToCsv includes UTF-8 BOM, sep=, directive, and correctly escapes Irish strings', () => {
    const detailed = buildDetailedRows(params);
    const headers = Object.keys(detailed[0]) as (keyof typeof detailed[0])[];
    const csv = convertToCsv(headers, detailed);

    // Starts with UTF-8 BOM (\uFEFF) and Excel separator instruction
    expect(csv.startsWith('\uFEFFsep=,\r\n')).toBe(true);
    // Preserves Irish characters (á, é, í, ó, ú)
    expect(csv).toContain('Pádraig Ó Conaill');
    expect(csv).toContain('leath-thréscaoilteach');
    expect(csv).toContain('Míniú den scoth');
  });

  it('exportToExcel generates workbook without throwing', () => {
    // Mock browser download helpers
    const clickSpy = vi.fn();
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
      setAttribute: vi.fn(),
      click: clickSpy
    } as any);
    const originalCreate = globalThis.URL.createObjectURL;
    const originalRevoke = globalThis.URL.revokeObjectURL;
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    globalThis.URL.revokeObjectURL = vi.fn();

    expect(() => exportToExcel(params)).not.toThrow();
    expect(clickSpy).toHaveBeenCalled();

    createElementSpy.mockRestore();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
    globalThis.URL.createObjectURL = originalCreate;
    globalThis.URL.revokeObjectURL = originalRevoke;
  });
});
