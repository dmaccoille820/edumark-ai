import React, { useEffect, useMemo, useState } from 'react';
import { Users, Download, LogOut, BarChart3, PlusCircle, FileUp, Loader2, BookOpen, AlertTriangle } from 'lucide-react';
import { User, Assessment, Submission } from '../types';
import { MOCK_USERS, MOCK_ASSESSMENTS } from '../mockDb';
import { generateAssessmentFromPdfs } from '../services/aiService';
import { getSubmissions } from '../services/api';

interface TeacherDashboardProps {
  teacher: User;
  onLogout: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ teacher, onLogout }) => {
  const [assessments, setAssessments] = useState<Assessment[]>(MOCK_ASSESSMENTS);
  const [isCreating, setIsCreating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorLog, setErrorLog] = useState<string>('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);

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

  // Calculate max marks for each assessment for easy lookup
  const assessmentMaxMarks = useMemo(() => {
    const map: Record<string, number> = {};
    assessments.forEach(a => {
      map[a.id] = a.questions.reduce((sum, q) => sum + q.maxMarks, 0);
    });
    return map;
  }, [assessments]);

  // Calculate student averages
  const studentAverages = useMemo(() => {
    const students = MOCK_USERS.filter(u => u.role === 'student');
    
    return students.map(student => {
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
  }, [assessmentMaxMarks, submissions]);

  const handleExportCSV = () => {
    const headers = ['Student Name', 'Email', 'Exam Number', 'Assessment', 'Score (%)', 'Date Submitted'];
    
    const rows = submissions.map(sub => {
      const student = MOCK_USERS.find(u => u.id === sub.studentId);
      const assessment = assessments.find(a => a.id === sub.assessmentId);
      
      if (!student || !assessment) return null;

      const maxMarks = assessmentMaxMarks[assessment.id] || 1;
      const score = sub.totalScore || 0;
      const percentage = Math.round((score / maxMarks) * 100);
      const date = new Date(sub.submittedAt).toLocaleDateString();

      // Escape quotes in titles
      const safeTitle = assessment.title.en.replace(/"/g, '""');

      return `"${student.name}","${student.email}","${student.examNumber}","${safeTitle}","${percentage}%","${date}"`;
    }).filter(Boolean);

    const csvContent = [headers.join(','), ...rows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `assessment_results_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLog('');

    if (!enPdf || !gaPdf || !msPdf) {
      setErrorLog('Validation Error: Please upload all three required PDF documents.');
      return;
    }

    setIsProcessing(true);

    try {
      const enBase64 = await fileToBase64(enPdf);
      const gaBase64 = await fileToBase64(gaPdf);
      const msBase64 = await fileToBase64(msPdf);

      const questions = await generateAssessmentFromPdfs(enBase64, gaBase64, msBase64);

      const newAssessment: Assessment = {
        id: `a_${Date.now()}`,
        title: { en: titleEn, ga: titleGa },
        description: { en: descEn, ga: descGa },
        questions: questions
      };

      // Update local state and mock DB
      MOCK_ASSESSMENTS.push(newAssessment);
      setAssessments([...MOCK_ASSESSMENTS]);
      
      // Reset form
      setIsCreating(false);
      setTitleEn('');
      setTitleGa('');
      setDescEn('');
      setDescGa('');
      setEnPdf(null);
      setGaPdf(null);
      setMsPdf(null);
      
      alert('Assessment successfully generated and added to the database!');
    } catch (err: any) {
      console.error("Full error caught in component:", err);
      setErrorLog(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-slate-800">Teacher Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 font-medium">
              {teacher.name} ({teacher.accessId || teacher.teacherId})
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
        
        {/* Header Actions */}
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Assessment Overview</h2>
            <p className="text-slate-500 mt-1">Manage assessments, view student performance, and export results.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              {isCreating ? 'Cancel Creation' : 'New Assessment'}
            </button>
            <button
              onClick={handleExportCSV}
              className="bg-primary hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Results
            </button>
          </div>
        </div>

        {/* Create Assessment Form */}
        {isCreating && (
          <section className="bg-white rounded-xl shadow-sm border border-primary/20 overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-blue-50/50 flex items-center gap-2">
              <FileUp className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-slate-800">Generate Assessment from PDFs</h3>
            </div>
            <form onSubmit={handleCreateAssessment} className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Title (English)</label>
                    <input type="text" required value={titleEn} onChange={e => setTitleEn(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="e.g., Midterm Exam" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description (English)</label>
                    <textarea required value={descEn} onChange={e => setDescEn(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none" rows={2} />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Title (Irish)</label>
                    <input type="text" required value={titleGa} onChange={e => setTitleGa(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="e.g., Scrúdú Lárthéarma" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description (Irish)</label>
                    <textarea required value={descGa} onChange={e => setDescGa(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none" rows={2} />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">1. English Assessment (PDF)</label>
                  <input type="file" accept="application/pdf" required onChange={e => setEnPdf(e.target.files?.[0] || null)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-primary hover:file:bg-blue-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">2. Irish Assessment (PDF)</label>
                  <input type="file" accept="application/pdf" required onChange={e => setGaPdf(e.target.files?.[0] || null)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-primary hover:file:bg-blue-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">3. Mark Scheme (PDF)</label>
                  <input type="file" accept="application/pdf" required onChange={e => setMsPdf(e.target.files?.[0] || null)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-primary hover:file:bg-blue-100" />
                </div>
              </div>

              {errorLog && (
                <div className="p-4 bg-danger/5 border border-danger/20 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 text-danger font-semibold mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Error Processing PDFs</span>
                  </div>
                  <div className="bg-white p-3 rounded border border-danger/10 overflow-x-auto max-h-64 overflow-y-auto">
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono">
                      {errorLog}
                    </pre>
                  </div>
                  <p className="text-xs text-danger mt-2">
                    Check the console for more details. Ensure the PDFs are valid and not password protected.
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="bg-primary hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Processing PDFs with AI...</>
                  ) : (
                    <><BotIcon className="w-4 h-4" /> Generate Assessment</>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Available Assessments Section */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-slate-500" />
            <h3 className="font-semibold text-slate-800">Available Assessments</h3>
          </div>
          <div className="p-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {assessments.map(assessment => (
              <div key={assessment.id} className="border border-slate-200 rounded-lg p-4 hover:border-primary/30 transition-colors">
                <h4 className="font-semibold text-slate-800 truncate" title={assessment.title.en}>{assessment.title.en}</h4>
                <p className="text-xs text-slate-500 italic truncate mb-3" title={assessment.title.ga}>{assessment.title.ga}</p>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">{assessment.questions.length} Questions</span>
                  <span className="font-medium text-primary">{assessmentMaxMarks[assessment.id]} Marks</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Student Averages Section */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-slate-500" />
            <h3 className="font-semibold text-slate-800">Student Averages</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-medium">Student Name</th>
                  <th className="px-6 py-3 font-medium">Exam Number</th>
                  <th className="px-6 py-3 font-medium">Assessments Taken</th>
                  <th className="px-6 py-3 font-medium">Average Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentAverages.map((stat) => (
                  <tr key={stat.student.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-slate-800">{stat.student.name}</td>
                    <td className="px-6 py-4 text-slate-600">{stat.student.examNumber}</td>
                    <td className="px-6 py-4 text-slate-600">{stat.assessmentsTaken}</td>
                    <td className="px-6 py-4">
                      {stat.assessmentsTaken > 0 ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${
                          stat.averagePercentage >= 70 ? 'bg-success/10 text-success' : 
                          stat.averagePercentage >= 40 ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'
                        }`}>
                          {stat.averagePercentage}%
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No data</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Submissions Section */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-800">All Submissions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Student</th>
                  <th className="px-6 py-3 font-medium">Assessment</th>
                  <th className="px-6 py-3 font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500 italic">
                      No submissions recorded yet.
                    </td>
                  </tr>
                ) : (
                  [...submissions].reverse().map((sub) => {
                    const student = MOCK_USERS.find(u => u.id === sub.studentId);
                    const assessment = assessments.find(a => a.id === sub.assessmentId);
                    const maxMarks = assessment ? assessmentMaxMarks[assessment.id] : 1;
                    const percentage = Math.round(((sub.totalScore || 0) / maxMarks) * 100);

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(sub.submittedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800">{student?.name || 'Unknown'}</div>
                          <div className="text-xs text-slate-500">{student?.examNumber}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-800">
                          {assessment?.title.en || 'Unknown Assessment'}
                        </td>
                        <td className="px-6 py-4 font-medium">
                          {percentage}% <span className="text-slate-400 text-xs font-normal">({sub.totalScore}/{maxMarks})</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  );
};

// Helper icon component for the button
const BotIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
);
