import React from 'react';
import { FileText, Clock, CheckCircle, LogOut } from 'lucide-react';
import { User, Assessment, Submission } from '../types';

interface DashboardProps {
  student: User;
  assessments: Assessment[];
  submissions: Submission[];
  onStartAssessment: (assessment: Assessment) => void;
  onViewResults: (submission: Submission) => void;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  student,
  assessments,
  submissions,
  onStartAssessment,
  onViewResults,
  onLogout,
}) => {

  // Find which assessments the student has already taken
  const studentSubmissions = submissions.filter((s) => s.studentId === student.id);
  const completedAssessmentIds = new Set(studentSubmissions.map((s) => s.assessmentId));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-slate-800">My Assessments</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 font-medium">
              {student.name} ({student.examNumber})
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          {assessments.map((assessment) => {
            const isCompleted = completedAssessmentIds.has(assessment.id);
            const submission = studentSubmissions.find((s) => s.assessmentId === assessment.id);

            return (
              <div
                key={assessment.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">
                      {assessment.title.en}
                    </h2>
                    <h3 className="text-sm font-medium text-slate-500 italic">
                      {assessment.title.ga}
                    </h3>
                  </div>
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
                      <Clock className="w-3.5 h-3.5" />
                      Pending
                    </span>
                  )}
                </div>
                
                <div className="text-slate-600 text-sm mb-6 flex-grow space-y-1">
                  <p>{assessment.description.en}</p>
                  <p className="italic text-slate-500">{assessment.description.ga}</p>
                </div>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    {assessment.questions.length} Questions
                  </span>
                  
                  {isCompleted && submission ? (
                    <button
                      onClick={() => onViewResults(submission)}
                      className="text-sm font-medium text-primary hover:text-blue-700 transition-colors"
                    >
                      View Results
                    </button>
                  ) : (
                    <button
                      onClick={() => onStartAssessment(assessment)}
                      className="bg-primary hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      Start Assessment
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};
