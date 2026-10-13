import * as XLSX from 'xlsx';
import { Assessment, Submission, User } from '../types';

export interface ExportDataParams {
  assessments: Assessment[];
  submissions: Submission[];
  students: User[];
  assessmentMaxMarks: Record<string, number>;
  exportAssessmentId?: string;
}

export interface SummaryExportRow {
  'Student Name': string;
  'Email': string;
  'Exam Number': string;
  'Assessment (EN)': string;
  'Assessment (GA)': string;
  'Score': number;
  'Max Marks': number;
  'Percentage': string;
  'Status': string;
  'Date Submitted': string;
  'Teacher Notes': string;
}

export interface DetailedExportRow {
  'Student Name': string;
  'Exam Number': string;
  'Assessment': string;
  'Question #': number;
  'Question Type': string;
  'Question (EN)': string;
  'Question (GA)': string;
  'Max Marks': number;
  'Student Answer': string;
  'Score Awarded': number | string;
  'Feedback (EN)': string;
  'Feedback (GA)': string;
  'Amended': string;
  'Date Submitted': string;
}

/**
 * Builds high-level summary rows (one per student submission).
 */
export function buildSummaryRows(params: ExportDataParams): SummaryExportRow[] {
  const { assessments, submissions, students, assessmentMaxMarks, exportAssessmentId } = params;

  const subsToExport = exportAssessmentId
    ? submissions.filter(s => s.assessmentId === exportAssessmentId)
    : submissions;

  const results: SummaryExportRow[] = [];

  for (const sub of subsToExport) {
    const student = students.find(u => u.id === sub.studentId);
    const assessment = assessments.find(a => a.id === sub.assessmentId);
    if (!student || !assessment) continue;

    const maxMarks = assessmentMaxMarks[assessment.id] || 1;
    const score = sub.totalScore ?? 0;
    const percentage = `${Math.round((score / maxMarks) * 100)}%`;
    const date = sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : '';

    results.push({
      'Student Name': student.name,
      'Email': student.email,
      'Exam Number': student.examNumber || 'N/A',
      'Assessment (EN)': assessment.title.en,
      'Assessment (GA)': assessment.title.ga || assessment.title.en,
      'Score': score,
      'Max Marks': maxMarks,
      'Percentage': percentage,
      'Status': sub.status,
      'Date Submitted': date,
      'Teacher Notes': sub.teacherNotes || ''
    });
  }

  return results;
}

/**
 * Builds detailed question-by-question breakdown rows (one row per student per question).
 * This eliminates cell length truncation and makes viewing/filtering seamless.
 */
export function buildDetailedRows(params: ExportDataParams): DetailedExportRow[] {
  const { assessments, submissions, students, exportAssessmentId } = params;

  const subsToExport = exportAssessmentId
    ? submissions.filter(s => s.assessmentId === exportAssessmentId)
    : submissions;

  const detailedRows: DetailedExportRow[] = [];

  for (const sub of subsToExport) {
    const student = students.find(u => u.id === sub.studentId);
    const assessment = assessments.find(a => a.id === sub.assessmentId);
    if (!student || !assessment) continue;

    const date = sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : '';

    assessment.questions.forEach((q, idx) => {
      const studentAnswerRaw = sub.answers[q.id] || '';
      const qFeedback = sub.feedback?.[q.id];

      let formattedAnswer = studentAnswerRaw;
      if (q.type === 'mcq') {
        const optIdx = parseInt(studentAnswerRaw, 10);
        if (!isNaN(optIdx) && q.options && q.options[optIdx]) {
          const opt = q.options[optIdx];
          formattedAnswer = `Option ${optIdx + 1}: ${opt.en}${opt.ga ? ` / ${opt.ga}` : ''}`;
        }
      }

      const scoreAwarded = qFeedback ? qFeedback.score : 'N/A';
      const commentEn = qFeedback?.commentEn || 'No feedback';
      const commentGa = qFeedback?.commentGa || 'Gan aiseolas';
      const amendedStr = qFeedback?.isAmended ? 'Yes' : 'No';

      detailedRows.push({
        'Student Name': student.name,
        'Exam Number': student.examNumber || 'N/A',
        'Assessment': assessment.title.en,
        'Question #': idx + 1,
        'Question Type': q.type.toUpperCase(),
        'Question (EN)': q.text.en,
        'Question (GA)': q.text.ga || q.text.en,
        'Max Marks': q.maxMarks,
        'Student Answer': formattedAnswer,
        'Score Awarded': scoreAwarded,
        'Feedback (EN)': commentEn,
        'Feedback (GA)': commentGa,
        'Amended': amendedStr,
        'Date Submitted': date
      });
    });
  }

  return detailedRows;
}

/**
 * Triggers a browser download of a given Blob.
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates filename label based on assessment selection.
 */
function getFilenameBase(params: ExportDataParams): string {
  const selectedAssessment = params.assessments.find(a => a.id === params.exportAssessmentId);
  const fileLabel = selectedAssessment
    ? selectedAssessment.title.en.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    : 'all_assessments';
  const dateStr = new Date().toISOString().split('T')[0];
  return `results_${fileLabel}_${dateStr}`;
}

/**
 * Converts headers and row objects into RFC-4180 compliant CSV string with UTF-8 BOM and sep=,
 */
export function convertToCsv<T extends Record<string, any>>(headers: (keyof T)[], data: T[]): string {
  const escapeCell = (val: any): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const headerLine = (headers as string[]).map(escapeCell).join(',');
  const rowLines = data.map(row => headers.map(h => escapeCell(row[h])).join(','));

  // UTF-8 BOM (\uFEFF) + sep=,\r\n allows Windows Excel to:
  // 1. Correctly render Irish diacritics (á, é, í, ó, ú)
  // 2. Open columns directly with commas without needing 'Text to Columns'
  const BOM = '\uFEFF';
  return BOM + 'sep=,\r\n' + [headerLine, ...rowLines].join('\r\n');
}

/**
 * Exports data to native Excel (.xlsx) with two separate worksheets:
 * 1. Summary Results
 * 2. Question Breakdown
 */
export function exportToExcel(params: ExportDataParams): void {
  const summaryRows = buildSummaryRows(params);
  const detailedRows = buildDetailedRows(params);

  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet['!cols'] = [
    { wch: 20 }, // Student Name
    { wch: 26 }, // Email
    { wch: 15 }, // Exam Number
    { wch: 25 }, // Assessment (EN)
    { wch: 25 }, // Assessment (GA)
    { wch: 10 }, // Score
    { wch: 12 }, // Max Marks
    { wch: 14 }, // Percentage
    { wch: 12 }, // Status
    { wch: 16 }, // Date Submitted
    { wch: 30 }  // Teacher Notes
  ];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary Results');

  // Question Breakdown sheet
  const detailedSheet = XLSX.utils.json_to_sheet(detailedRows);
  detailedSheet['!cols'] = [
    { wch: 20 }, // Student Name
    { wch: 15 }, // Exam Number
    { wch: 25 }, // Assessment
    { wch: 8 },  // Q#
    { wch: 10 }, // Question Type
    { wch: 35 }, // Question (EN)
    { wch: 35 }, // Question (GA)
    { wch: 12 }, // Max Marks
    { wch: 40 }, // Student Answer
    { wch: 14 }, // Score Awarded
    { wch: 50 }, // Feedback (EN)
    { wch: 50 }, // Feedback (GA)
    { wch: 12 }, // Amended
    { wch: 16 }  // Date Submitted
  ];
  XLSX.utils.book_append_sheet(workbook, detailedSheet, 'Question Breakdown');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  triggerDownload(blob, `${getFilenameBase(params)}.xlsx`);
}

/**
 * Exports detailed question-by-question data as UTF-8 CSV.
 */
export function exportToDetailedCsv(params: ExportDataParams): void {
  const detailedRows = buildDetailedRows(params);
  const headers: (keyof DetailedExportRow)[] = [
    'Student Name',
    'Exam Number',
    'Assessment',
    'Question #',
    'Question Type',
    'Question (EN)',
    'Question (GA)',
    'Max Marks',
    'Student Answer',
    'Score Awarded',
    'Feedback (EN)',
    'Feedback (GA)',
    'Amended',
    'Date Submitted'
  ];

  const csvContent = convertToCsv(headers, detailedRows);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${getFilenameBase(params)}_breakdown.csv`);
}

/**
 * Exports summary data as UTF-8 CSV.
 */
export function exportToSummaryCsv(params: ExportDataParams): void {
  const summaryRows = buildSummaryRows(params);
  const headers: (keyof SummaryExportRow)[] = [
    'Student Name',
    'Email',
    'Exam Number',
    'Assessment (EN)',
    'Assessment (GA)',
    'Score',
    'Max Marks',
    'Percentage',
    'Status',
    'Date Submitted',
    'Teacher Notes'
  ];

  const csvContent = convertToCsv(headers, summaryRows);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${getFilenameBase(params)}_summary.csv`);
}
