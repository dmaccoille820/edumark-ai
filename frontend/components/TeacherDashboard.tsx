import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Download,
  LogOut,
  BarChart3,
  PlusCircle,
  FileUp,
  Loader2,
  BookOpen,
  AlertTriangle,
  Pencil,
  Trash2,
  Check,
  X,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  ClipboardEdit,
  MessageSquare
} from 'lucide-react';
import { User, Assessment, Submission, Question } from '../types';
import edumarkLogo from '../edumark.jpg';

import {
  generateAssessmentFromPdfs,
  generateAssessmentFromMultipleFactFiles
} from '../services/aiService';
import {
  getSubmissions,
  updateAssessment,
  deleteAssessment,
  amendSubmission,
  AmendmentPayload
} from '../services/api';

interface TeacherDashboardProps {
  teacher: User;
  initialAssessments: Assessment[];
  initialSubmissions: Submission[];
  students: User[];
  onLogout: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  teacher,
  initialAssessments,
  initialSubmissions,
  students,
  onLogout,
}) => {
  const [assessments, setAssessments] = useState<Assessment[]>(initialAssessments);
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions);
  const [isCreating, setIsCreating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorLog, setErrorLog] = useState<string>('');
  const [assessmentSource, setAssessmentSource] = useState<'exam' | 'fact_file'>('exam');
  const [assessmentSearch, setAssessmentSearch] = useState('');
  // '' means "all assessments"
  const [exportAssessmentId, setExportAssessmentId] = useState('');

  // Edit & delete state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ titleEn: '', titleGa: '', descEn: '', descGa: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Amendment state
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
  const [amendScores, setAmendScores] = useState<Record<string, number>>({});
  const [amendNotes, setAmendNotes] = useState('');
  const [isSavingAmendment, setIsSavingAmendment] = useState(false);

  useEffect(() => {
    getSubmissions().then(setSubmissions).catch((error) => setErrorLog(error.message));
  }, []);

  // Form state for new assessment
  const [titleEn, setTitleEn] = useState('');
  const [titleGa, setTitleGa] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descGa, setDescGa] = useState('');
  const [enPdf, setEnPdf] = useState<File | null>(null);
  const [gaPdf, setGaPdf] = useState<File | null>(null);
  const [msPdf, setMsPdf] = useState<File | null>(null);

  // Multi-PDF Fact File pairs: each entry = { en: File | null, ga: File | null }
  interface FactFilePair { en: File | null; ga: File | null; }
  const [factFilePairs, setFactFilePairs] = useState<FactFilePair[]>([{ en: null, ga: null }]);
  const MAX_PAIRS = 5;

  const handleAddPair = () => {
    if (factFilePairs.length < MAX_PAIRS) {
      setFactFilePairs(prev => [...prev, { en: null, ga: null }]);
    }
  };

  const handleRemovePair = (index: number) => {
    setFactFilePairs(prev => prev.filter((_, i) => i !== index));
  };

  const handlePairFileChange = (index: number, lang: 'en' | 'ga', file: File | null) => {
    setFactFilePairs(prev => prev.map((pair, i) => i === index ? { ...pair, [lang]: file } : pair));
  };

  // Staged questions for reviewing and attaching diagrams before final save
  const [stagedQuestions, setStagedQuestions] = useState<Question[] | null>(null);
  const [stagedAssessmentId, setStagedAssessmentId] = useState<string>('');

  // Calculate max marks for each assessment for easy lookup
  const assessmentMaxMarks = useMemo(() => {
    const map: Record<string, number> = {};
    assessments.forEach(a => {
      map[a.id] = a.questions.reduce((sum, q) => sum + q.maxMarks, 0);
    });
    return map;
  }, [assessments]);

  // Filtered assessments for search
  const filteredAssessments = useMemo(() => {
    const q = assessmentSearch.toLowerCase();
    if (!q) return assessments;
    return assessments.filter(
      a =>
        a.title.en.toLowerCase().includes(q) ||
        a.title.ga.toLowerCase().includes(q)
    );
  }, [assessments, assessmentSearch]);

  // Calculate student averages
  const studentAverages = useMemo(() => {
    const studentUsers = students.filter(u => u.role === 'student');

    return studentUsers.map(student => {
      const subs = submissions.filter(s => s.studentId === student.id);
      let totalPercentageSum = 0;

      subs.forEach(sub => {
        const maxMarks = assessmentMaxMarks[sub.assessmentId] || 1;
        const score = sub.totalScore || 0;
        totalPercentageSum += (score / maxMarks) * 100;
      });

      const average = subs.length > 0 ? Math.round(totalPercentageSum / subs.length) : 0;

      return {
        student,
        assessmentsTaken: subs.length,
        averagePercentage: average
      };
    });
  }, [assessmentMaxMarks, students, submissions]);

  const handleStartEdit = (assessment: Assessment) => {
    setDeletingId(null);
    setEditingId(assessment.id);
    setEditForm({
      titleEn: assessment.title.en,
      titleGa: assessment.title.ga,
      descEn: assessment.description.en,
      descGa: assessment.description.ga,
    });
  };

  const handleSaveEdit = async (assessmentId: string) => {
    setIsSavingEdit(true);
    try {
      await updateAssessment(assessmentId, editForm);
      setAssessments(prev => prev.map(a =>
        a.id === assessmentId
          ? { ...a, title: { en: editForm.titleEn, ga: editForm.titleGa }, description: { en: editForm.descEn, ga: editForm.descGa } }
          : a
      ));
      setEditingId(null);
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (assessmentId: string) => {
    setIsDeletingId(assessmentId);
    try {
      await deleteAssessment(assessmentId);
      setAssessments(prev => prev.filter(a => a.id !== assessmentId));
      setDeletingId(null);
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleExpandSub = (sub: Submission, assessment: Assessment | undefined) => {
    if (expandedSubId === sub.id) {
      setExpandedSubId(null);
      return;
    }
    setExpandedSubId(sub.id);
    setAmendNotes(sub.teacherNotes || '');
    // Pre-populate scores from existing feedback
    const scores: Record<string, number> = {};
    if (assessment && sub.feedback) {
      assessment.questions.forEach(q => {
        scores[q.id] = sub.feedback?.[q.id]?.score ?? 0;
      });
    }
    setAmendScores(scores);
  };

  const handleSaveAmendment = async (sub: Submission, assessment: Assessment | undefined) => {
    if (!assessment) return;
    setIsSavingAmendment(true);
    try {
      const feedbackPayload: AmendmentPayload['feedback'] = {};
      assessment.questions.forEach(q => {
        const existing = sub.feedback?.[q.id];
        feedbackPayload![q.id] = {
          score: amendScores[q.id] ?? existing?.score ?? 0,
          commentEn: existing?.commentEn ?? '',
          commentGa: existing?.commentGa ?? '',
          isAmended: true,
        };
      });
      const newTotalScore = Object.values(feedbackPayload).reduce((sum, f) => sum + f.score, 0);
      const updated = await amendSubmission(sub.id, {
        totalScore: newTotalScore,
        teacherNotes: amendNotes || undefined,
        feedback: feedbackPayload,
      });
      setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s));
      setExpandedSubId(null);
    } catch (err: any) {
      alert(`Failed to save amendment: ${err.message}`);
    } finally {
      setIsSavingAmendment(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Student Name', 'Email', 'Exam Number', 'Assessment', 'Score (%)', 'Date Submitted', 'Detailed Q&A and Feedback'];

    // Filter to the selected assessment (or all if none selected)
    const subsToExport = exportAssessmentId
      ? submissions.filter(s => s.assessmentId === exportAssessmentId)
      : submissions;

    const rows = subsToExport.map(sub => {
      const student = students.find(u => u.id === sub.studentId);
      const assessment = assessments.find(a => a.id === sub.assessmentId);

      if (!student || !assessment) return null;

      const maxMarks = assessmentMaxMarks[assessment.id] || 1;
      const score = sub.totalScore || 0;
      const percentage = Math.round((score / maxMarks) * 100);
      const date = new Date(sub.submittedAt).toLocaleDateString();

      // Escape double-quotes for CSV
      const safeTitle = assessment.title.en.replace(/"/g, '""');

      // Build detailed question-by-question Q&A and AI feedback string
      const detailedFeedbackParts = assessment.questions.map((q, idx) => {
        const studentAnswer = sub.answers[q.id] || '';
        const qFeedback = sub.feedback?.[q.id];

        let answerStr = '';
        if (q.type === 'mcq') {
          const optIdx = parseInt(studentAnswer, 10);
          if (!isNaN(optIdx) && q.options && q.options[optIdx]) {
            answerStr = `Option ${optIdx + 1}: ${q.options[optIdx].en}`;
          } else {
            answerStr = studentAnswer;
          }
        } else {
          answerStr = studentAnswer;
        }

        const scorePart = qFeedback ? `${qFeedback.score}/${q.maxMarks}` : `N/A`;
        const commentEn = qFeedback ? qFeedback.commentEn : 'No feedback';
        const commentGa = qFeedback ? qFeedback.commentGa : 'Gan aiseolas';

        return `Q${idx + 1}: ${q.text.en}\n- Answer: ${answerStr}\n- Score: ${scorePart}\n- Feedback (EN): ${commentEn}\n- Feedback (GA): ${commentGa}`;
      });

      const safeDetailedFeedback = detailedFeedbackParts.join('\n\n').replace(/"/g, '""');

      return `"${student.name}","${student.email}","${student.examNumber}","${safeTitle}","${percentage}%","${date}","${safeDetailedFeedback}"`;
    }).filter(Boolean);

    const csvContent = [headers.join(','), ...rows].join('\n');

    // Prepend UTF-8 BOM so Excel on Windows reads the file correctly
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);

    const selectedAssessment = assessments.find(a => a.id === exportAssessmentId);
    const fileLabel = selectedAssessment
      ? selectedAssessment.title.en.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      : 'all_assessments';
    link.setAttribute('download', `results_${fileLabel}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:application/pdf;base64, prefix
        resolve(result.split(',')[1]);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleExtractQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLog('');

    if (assessmentSource === 'exam' && (!enPdf || !gaPdf || !msPdf)) {
      setErrorLog('Validation Error: Please upload all three required PDF documents.');
      return;
    }
    if (assessmentSource === 'fact_file') {
      const incompletePairs = factFilePairs.some(p => !p.en || !p.ga);
      if (factFilePairs.length === 0 || incompletePairs) {
        setErrorLog('Validation Error: Each Fact File pair must have both an English and an Irish PDF uploaded.');
        return;
      }
    }

    setIsProcessing(true);

    try {
      let rawQuestions: Question[];
      if (assessmentSource === 'exam') {
        const enBase64 = await fileToBase64(enPdf!);
        const gaBase64 = await fileToBase64(gaPdf!);
        const msBase64 = await fileToBase64(msPdf!);
        rawQuestions = await generateAssessmentFromPdfs(enBase64, gaBase64, msBase64);
      } else {
        const enBase64s = await Promise.all(factFilePairs.map(p => fileToBase64(p.en!)));
        const gaBase64s = await Promise.all(factFilePairs.map(p => fileToBase64(p.ga!)));
        rawQuestions = await generateAssessmentFromMultipleFactFiles(enBase64s, gaBase64s);
      }

      const newId = `a_${Date.now()}`;
      setStagedAssessmentId(newId);

      // Prefix question IDs with the assessment ID to avoid PK collisions
      const prefixedQuestions: Question[] = rawQuestions.map((q: any) => ({
        ...q,
        id: `${newId}_${q.id}`
      }));

      setStagedQuestions(prefixedQuestions);
    } catch (err: any) {
      console.error("Full error caught in component:", err);
      setErrorLog(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveAssessment = async () => {
    if (!stagedQuestions) return;

    try {
      const assessmentId = stagedAssessmentId || `a_${Date.now()}`;
      const newAssessment: Assessment = {
        id: assessmentId,
        title: { en: titleEn, ga: titleGa },
        description: { en: descEn, ga: descGa },
        questions: stagedQuestions
      };

      // Save to database
      const token = localStorage.getItem('edumark.auth.token');
      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(newAssessment)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(`Failed to save assessment (${res.status}): ${errData.error || res.statusText}`);
      }

      const savedAssessment = await res.json();
      setAssessments(prev => [...prev, savedAssessment]);

      // Reset form & staged state
      setIsCreating(false);
      setStagedQuestions(null);
      setStagedAssessmentId('');
      setTitleEn('');
      setTitleGa('');
      setDescEn('');
      setDescGa('');
      setEnPdf(null);
      setGaPdf(null);
      setMsPdf(null);
      setFactFilePairs([{ en: null, ga: null }]);
      setAssessmentSource('exam');

      alert('Assessment successfully generated and added to the database!');
    } catch (err: any) {
      console.error("Error saving assessment:", err);
      setErrorLog(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={edumarkLogo}
              alt="EduMark logo"
              className="w-9 h-9 rounded-full object-cover border border-primary/20"
            />
            <h1 className="text-xl font-bold text-slate-800">Teacher Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 font-medium">
              {teacher.name} ({teacher.teacherId})
            </span>
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              title="Log out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Assessment Overview</h2>
            <p className="text-slate-500 mt-1">Manage assessments, attach diagrams, and export student performance.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setIsCreating(!isCreating);
                setStagedQuestions(null);
              }}
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              {isCreating ? 'Cancel Creation' : 'New Assessment'}
            </button>

            {/* Assessment selector for export */}
            <select
              value={exportAssessmentId}
              onChange={e => setExportAssessmentId(e.target.value)}
              className="bg-white border border-slate-300 text-slate-700 text-sm font-medium px-3 py-2 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              title="Filter export by assessment"
            >
              <option value="">All Assessments</option>
              {assessments.map(a => (
                <option key={a.id} value={a.id}>
                  {a.title.en}
                </option>
              ))}
            </select>

            <button
              onClick={handleExportCSV}
              className="bg-primary hover:bg-green-800 text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Results
            </button>
          </div>
        </div>

        {/* Create Assessment Form */}
        {isCreating && (
          <section className="bg-white rounded-xl shadow-sm border border-primary/20 overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-green-50/50 flex items-center gap-2">
              <FileUp className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-slate-800">
                {stagedQuestions ? 'Attach Diagrams & Finalize Assessment' : 'Generate Assessment with AI'}
              </h3>
            </div>

            {!stagedQuestions ? (
              <form onSubmit={handleExtractQuestions} className="p-6 space-y-6">
                {/* Source type selector */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Assessment Source Material
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAssessmentSource('exam')}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        assessmentSource === 'exam'
                          ? 'border-primary bg-green-50/60 text-slate-900 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                      }`}
                    >
                      <div className="font-semibold text-sm">Exam Papers &amp; Mark Scheme</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Upload English Exam PDF, Irish Exam PDF, and Mark Scheme PDF.
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssessmentSource('fact_file')}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        assessmentSource === 'fact_file'
                          ? 'border-primary bg-green-50/60 text-slate-900 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                      }`}
                    >
                      <div className="font-semibold text-sm">Fact Files (Bilingual Pairs)</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Upload up to 5 pairs of English + Irish FactFile PDFs. AI formulates questions and mark schemes from content.
                      </div>
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* English Metadata */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Title (English)
                      </label>
                      <input
                        type="text"
                        required
                        value={titleEn}
                        onChange={(e) => setTitleEn(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                        placeholder="e.g., Biology: Cell Structure"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Description (English)
                      </label>
                      <textarea
                        required
                        value={descEn}
                        onChange={(e) => setDescEn(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                        rows={2}
                        placeholder="e.g., Unit 1 assessment covering organelles and cell transport."
                      />
                    </div>
                  </div>

                  {/* Irish Metadata */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Title (Irish)
                      </label>
                      <input
                        type="text"
                        required
                        value={titleGa}
                        onChange={(e) => setTitleGa(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                        placeholder="m.sh., Bitheolaíocht: Struchtúr na Cille"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Description (Irish)
                      </label>
                      <textarea
                        required
                        value={descGa}
                        onChange={(e) => setDescGa(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                        rows={2}
                        placeholder="m.sh., Measúnú Aonad 1 a chlúdaíonn orgánaigh agus iompar cille."
                      />
                    </div>
                  </div>
                </div>

                {/* PDF Upload Sections */}
                {assessmentSource === 'exam' ? (
                  <div className="grid md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        1. English Exam Paper (PDF)
                      </label>
                      <input
                        type="file"
                        accept="application/pdf"
                        required
                        onChange={(e) => setEnPdf(e.target.files?.[0] || null)}
                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-primary hover:file:bg-green-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        2. Irish Exam Paper (PDF)
                      </label>
                      <input
                        type="file"
                        accept="application/pdf"
                        required
                        onChange={(e) => setGaPdf(e.target.files?.[0] || null)}
                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-primary hover:file:bg-green-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        3. Mark Scheme (PDF)
                      </label>
                      <input
                        type="file"
                        accept="application/pdf"
                        required
                        onChange={(e) => setMsPdf(e.target.files?.[0] || null)}
                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-primary hover:file:bg-green-100"
                      />
                    </div>
                  </div>
                ) : (
                  /* Fact File Multi-PDF Upload Section */
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800">
                          Fact File Pairs ({factFilePairs.length} of {MAX_PAIRS})
                        </h4>
                        <p className="text-xs text-slate-500">
                          Each pair must contain an English Fact File and its corresponding Irish translation. The AI ensures all topics are tested.
                        </p>
                      </div>
                      {factFilePairs.length < MAX_PAIRS && (
                        <button
                          type="button"
                          onClick={handleAddPair}
                          className="text-xs bg-green-50 text-primary hover:bg-green-100 border border-primary/30 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          Add Topic Pair
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {factFilePairs.map((_pair, index) => (
                        <div
                          key={index}
                          className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                              Topic {index + 1}
                            </span>
                            {factFilePairs.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemovePair(index)}
                                className="text-slate-400 hover:text-danger text-xs flex items-center gap-1 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Remove
                              </button>
                            )}
                          </div>
                          <div className="grid md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                English Fact File (PDF) *
                              </label>
                              <input
                                type="file"
                                accept="application/pdf"
                                required
                                onChange={(e) =>
                                  handlePairFileChange(index, 'en', e.target.files?.[0] || null)
                                }
                                className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-primary hover:file:bg-green-100"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Irish Fact File (PDF) *
                              </label>
                              <input
                                type="file"
                                accept="application/pdf"
                                required
                                onChange={(e) =>
                                  handlePairFileChange(index, 'ga', e.target.files?.[0] || null)
                                }
                                className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-primary hover:file:bg-green-100"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {errorLog && (
                  <div className="p-4 bg-danger/5 border border-danger/20 rounded-lg">
                    <div className="flex items-center gap-2 text-danger font-semibold mb-2">
                      <AlertTriangle className="w-5 h-5" />
                      <span>Error Processing PDFs</span>
                    </div>
                    <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap">
                      {errorLog}
                    </pre>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="bg-primary hover:bg-green-800 text-white font-medium px-6 py-2.5 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing PDFs with Gemini...
                      </>
                    ) : (
                      <>
                        <FileUp className="w-4 h-4" />
                        Extract Questions &amp; Review
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Staged Questions Diagram Attachment Screen */
              <div className="p-6 space-y-6">
                <div className="bg-green-50 p-4 rounded-lg text-sm text-green-900 border border-green-200 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>
                    Questions successfully extracted! Review the questions below. You can optionally attach diagrams or visual figures in English, Irish, or Mark Scheme before saving.
                  </span>
                </div>

                <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
                  {stagedQuestions.map((q, idx) => (
                    <div key={q.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50/50 space-y-3">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <span className="text-xs font-bold uppercase text-slate-400">
                            Question {idx + 1} ({q.type})
                          </span>
                          <p className="font-medium text-slate-800 mt-0.5">{q.text.en}</p>
                          <p className="text-xs text-slate-500 italic mt-0.5">{q.text.ga}</p>
                        </div>
                        <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full font-medium shrink-0">
                          {q.maxMarks} marks
                        </span>
                      </div>

                      {/* Image Attachment Section */}
                      <div className="grid md:grid-cols-3 gap-3 pt-3 border-t border-slate-200 text-xs">
                        <div>
                          <label className="font-medium text-slate-700 block mb-1">
                            English Diagram / Figure
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const dataUrl = await fileToDataUrl(file);
                                q.image = { ...q.image, en: dataUrl };
                                setStagedQuestions([...stagedQuestions]);
                              }
                            }}
                            className="w-full text-xs text-slate-500 file:py-1 file:px-2 file:rounded file:border-0 file:bg-green-50 file:text-primary hover:file:bg-green-100"
                          />
                          {q.image?.en && (
                            <div className="mt-2 relative inline-block">
                              <img src={q.image.en} alt="EN preview" className="h-16 rounded border object-contain bg-white" />
                              <button
                                type="button"
                                onClick={() => {
                                  if (q.image) delete q.image.en;
                                  setStagedQuestions([...stagedQuestions]);
                                }}
                                className="absolute -top-1 -right-1 bg-danger text-white rounded-full p-0.5"
                                title="Remove image"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="font-medium text-slate-700 block mb-1">
                            Irish Diagram / Figure
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const dataUrl = await fileToDataUrl(file);
                                q.image = { ...q.image, ga: dataUrl };
                                setStagedQuestions([...stagedQuestions]);
                              }
                            }}
                            className="w-full text-xs text-slate-500 file:py-1 file:px-2 file:rounded file:border-0 file:bg-green-50 file:text-primary hover:file:bg-green-100"
                          />
                          {q.image?.ga && (
                            <div className="mt-2 relative inline-block">
                              <img src={q.image.ga} alt="GA preview" className="h-16 rounded border object-contain bg-white" />
                              <button
                                type="button"
                                onClick={() => {
                                  if (q.image) delete q.image.ga;
                                  setStagedQuestions([...stagedQuestions]);
                                }}
                                className="absolute -top-1 -right-1 bg-danger text-white rounded-full p-0.5"
                                title="Remove image"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="font-medium text-slate-700 block mb-1">
                            Mark Scheme Visual Guide
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const dataUrl = await fileToDataUrl(file);
                                q.markSchemeImage = dataUrl;
                                setStagedQuestions([...stagedQuestions]);
                              }
                            }}
                            className="w-full text-xs text-slate-500 file:py-1 file:px-2 file:rounded file:border-0 file:bg-green-50 file:text-primary hover:file:bg-green-100"
                          />
                          {q.markSchemeImage && (
                            <div className="mt-2 relative inline-block">
                              <img src={q.markSchemeImage} alt="MS preview" className="h-16 rounded border object-contain bg-white" />
                              <button
                                type="button"
                                onClick={() => {
                                  delete q.markSchemeImage;
                                  setStagedQuestions([...stagedQuestions]);
                                }}
                                className="absolute -top-1 -right-1 bg-danger text-white rounded-full p-0.5"
                                title="Remove image"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setStagedQuestions(null)}
                    className="text-sm text-slate-500 hover:text-slate-700 font-medium px-4 py-2"
                  >
                    &larr; Back to PDF Configuration
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAssessment}
                    className="bg-primary hover:bg-green-800 text-white font-medium px-6 py-2.5 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                    Save Assessment to Database
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Available Assessments Section */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-slate-500" />
              <h3 className="font-semibold text-slate-800">Available Assessments</h3>
              <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                {assessments.length}
              </span>
            </div>
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search assessments..."
                aria-label="Filter assessments"
                value={assessmentSearch}
                onChange={e => setAssessmentSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="p-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAssessments.length === 0 ? (
              <div className="col-span-full text-center py-8 text-slate-400 text-sm">
                No assessments match &ldquo;{assessmentSearch}&rdquo;.
              </div>
            ) : (
              filteredAssessments.map(assessment => (
                <div
                  key={assessment.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-primary/30 transition-colors flex flex-col justify-between gap-3 bg-white"
                >
                  {editingId === assessment.id ? (
                    /* In-place edit form */
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Edit Assessment</p>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-0.5">Title (EN)</label>
                        <input
                          className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-primary outline-none"
                          value={editForm.titleEn}
                          onChange={e => setEditForm(f => ({ ...f, titleEn: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-0.5">Title (GA)</label>
                        <input
                          className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-primary outline-none"
                          value={editForm.titleGa}
                          onChange={e => setEditForm(f => ({ ...f, titleGa: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-0.5">Description (EN)</label>
                        <textarea
                          rows={2}
                          className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-primary outline-none resize-none"
                          value={editForm.descEn}
                          onChange={e => setEditForm(f => ({ ...f, descEn: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-0.5">Description (GA)</label>
                        <textarea
                          rows={2}
                          className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-primary outline-none resize-none"
                          value={editForm.descGa}
                          onChange={e => setEditForm(f => ({ ...f, descGa: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleSaveEdit(assessment.id)}
                          disabled={isSavingEdit || !editForm.titleEn.trim() || !editForm.titleGa.trim()}
                          className="flex-1 flex items-center justify-center gap-1 bg-primary text-white text-sm font-medium py-1.5 rounded hover:bg-green-800 disabled:opacity-60 transition-colors"
                        >
                          {isSavingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex-1 flex items-center justify-center gap-1 bg-slate-100 text-slate-600 text-sm font-medium py-1.5 rounded hover:bg-slate-200 transition-colors"
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : deletingId === assessment.id ? (
                    /* Delete confirmation */
                    <div className="space-y-2">
                      <p className="text-sm text-slate-700 font-medium">Delete <span className="text-danger">&ldquo;{assessment.title.en}&rdquo;</span>?</p>
                      <p className="text-xs text-slate-500">This cannot be undone. Existing submissions will lose their assessment link.</p>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleDelete(assessment.id)}
                          disabled={isDeletingId === assessment.id}
                          className="flex-1 flex items-center justify-center gap-1 bg-danger text-white text-sm font-medium py-1.5 rounded hover:bg-red-700 disabled:opacity-60 transition-colors"
                        >
                          {isDeletingId === assessment.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Delete
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="flex-1 flex items-center justify-center gap-1 bg-slate-100 text-slate-600 text-sm font-medium py-1.5 rounded hover:bg-slate-200 transition-colors"
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal card view */
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-slate-800 truncate" title={assessment.title.en}>{assessment.title.en}</h4>
                          <p className="text-xs text-slate-500 italic truncate" title={assessment.title.ga}>{assessment.title.ga}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => handleStartEdit(assessment)}
                            title="Edit assessment"
                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-green-50 rounded transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setDeletingId(assessment.id); }}
                            title="Delete assessment"
                            className="p-1.5 text-slate-400 hover:text-danger hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-sm mt-auto">
                        <span className="text-slate-600">{assessment.questions.length} Questions</span>
                        <span className="font-medium text-primary">{assessmentMaxMarks[assessment.id]} Marks</span>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Student Averages Section */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-slate-500" />
            <h3 className="font-semibold text-slate-800">Student Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="p-4">Student</th>
                  <th className="p-4">Exam Number</th>
                  <th className="p-4 text-center">Assessments Completed</th>
                  <th className="p-4 text-right">Average Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {studentAverages.map(({ student, assessmentsTaken, averagePercentage }) => (
                  <tr key={student.id} className="hover:bg-slate-50/50">
                    <td className="p-4 font-medium text-slate-800">{student.name}</td>
                    <td className="p-4 text-slate-500">{student.examNumber}</td>
                    <td className="p-4 text-center text-slate-600">{assessmentsTaken}</td>
                    <td className="p-4 text-right">
                      <span className={`inline-block font-semibold px-2 py-0.5 rounded text-xs ${
                        averagePercentage >= 70 ? 'bg-success/10 text-success' :
                        averagePercentage >= 40 ? 'bg-warning/10 text-warning' :
                        'bg-danger/10 text-danger'
                      }`}>
                        {averagePercentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* All Submissions Section */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">All Submissions</h3>
            <span className="text-xs text-slate-400 font-medium">Click a row to amend marks</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="p-4">Student</th>
                  <th className="p-4">Assessment</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Score</th>
                  <th className="p-4 w-8"></th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {submissions.map(sub => {
                  const student = students.find(u => u.id === sub.studentId);
                  const assessment = assessments.find(a => a.id === sub.assessmentId);
                  const maxMarks = assessmentMaxMarks[sub.assessmentId] || 1;
                  const score = sub.totalScore || 0;
                  const percentage = Math.round((score / maxMarks) * 100);
                  const isExpanded = expandedSubId === sub.id;
                  const isAmended = sub.status === 'graded' && !!sub.amendedAt;

                  const statusBadge = (() => {
                    if (isAmended) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600"><ClipboardEdit className="w-3 h-3" />Amended</span>;
                    if (sub.status === 'graded') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success">Graded</span>;
                    if (sub.status === 'provisional') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/10 text-warning">Provisional</span>;
                    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">Pending</span>;
                  })();

                  return (
                    <React.Fragment key={sub.id}>
                      <tr
                        className={`border-b border-slate-100 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-blue-50/40' : 'hover:bg-slate-50/60'
                        }`}
                        onClick={() => handleExpandSub(sub, assessment)}
                      >
                        <td className="p-4">
                          <div className="font-medium text-slate-800">{student?.name || 'Unknown Student'}</div>
                          <div className="text-xs text-slate-400">{student?.examNumber}</div>
                        </td>
                        <td className="p-4 text-slate-600">{assessment?.title.en || 'Unknown Assessment'}</td>
                        <td className="p-4 text-slate-400 text-xs">
                          <div>{new Date(sub.submittedAt).toLocaleDateString()}</div>
                          {sub.amendedAt && (
                            <div className="text-blue-400 mt-0.5">Amended {new Date(sub.amendedAt).toLocaleDateString()}</div>
                          )}
                        </td>
                        <td className="p-4">{statusBadge}</td>
                        <td className="p-4 text-right">
                          <span className={`inline-block font-semibold px-2 py-0.5 rounded text-xs ${
                            percentage >= 70 ? 'bg-success/10 text-success' :
                            percentage >= 40 ? 'bg-warning/10 text-warning' :
                            'bg-danger/10 text-danger'
                          }`}>
                            {score} / {maxMarks} ({percentage}%)
                          </span>
                        </td>
                        <td className="p-4 text-slate-400">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </td>
                      </tr>

                      {/* Amendment panel */}
                      {isExpanded && assessment && (
                        <tr className="border-b border-slate-200 bg-blue-50/20">
                          <td colSpan={6} className="p-0">
                            <div className="p-5 space-y-4">
                              <div className="flex items-center gap-2 mb-1">
                                <ClipboardEdit className="w-4 h-4 text-blue-500" />
                                <span className="text-sm font-semibold text-slate-700">Amend Marks</span>
                                <span className="text-xs text-slate-400 ml-1">— adjust scores per question then save</span>
                              </div>

                              {/* Per-question score inputs */}
                              <div className="grid gap-2">
                                {assessment.questions.map((q, idx) => {
                                  const existing = sub.feedback?.[q.id];
                                  const currentScore = amendScores[q.id] ?? existing?.score ?? 0;
                                  return (
                                    <div key={q.id} className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 p-3">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Q{idx + 1} · {q.type} · max {q.maxMarks}</p>
                                        <p className="text-sm text-slate-800 truncate mt-0.5" title={q.text.en}>{q.text.en}</p>
                                        {existing?.commentEn && (
                                          <p className="text-xs text-slate-400 italic mt-0.5 truncate">
                                            <MessageSquare className="w-3 h-3 inline mr-1" />{existing.commentEn}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setAmendScores(prev => ({ ...prev, [q.id]: Math.max(0, (prev[q.id] ?? existing?.score ?? 0) - 1) })); }}
                                          className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-bold text-lg leading-none transition-colors"
                                        >−</button>
                                        <span className="w-10 text-center font-bold text-slate-800 text-sm">{currentScore}/{q.maxMarks}</span>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setAmendScores(prev => ({ ...prev, [q.id]: Math.min(q.maxMarks, (prev[q.id] ?? existing?.score ?? 0) + 1) })); }}
                                          className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-bold text-lg leading-none transition-colors"
                                        >+</button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* New total */}
                              <div className="flex items-center justify-between text-sm font-semibold text-slate-700 bg-white rounded-lg border border-slate-200 px-4 py-2">
                                <span>New Total</span>
                                <span className="text-primary">
                                  {Object.values(amendScores).reduce((s, v) => s + v, 0)} / {maxMarks}
                                </span>
                              </div>

                              {/* Teacher notes */}
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                  <MessageSquare className="w-3 h-3 inline mr-1" />Teacher Notes (optional)
                                </label>
                                <textarea
                                  rows={2}
                                  value={amendNotes}
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => setAmendNotes(e.target.value)}
                                  placeholder="Add internal notes about this amendment…"
                                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                                />
                              </div>

                              {/* Actions */}
                              <div className="flex justify-end gap-3">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setExpandedSubId(null); }}
                                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={isSavingAmendment}
                                  onClick={(e) => { e.stopPropagation(); handleSaveAmendment(sub, assessment); }}
                                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg flex items-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {isSavingAmendment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                  Save Amendment
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};