import React, { useState } from 'react';
import { Assessment, Submission } from '../types';
import { ArrowLeft, CheckCircle2, XCircle, Award, Bot, Languages } from 'lucide-react';

interface ResultsViewProps {
  assessment: Assessment;
  submission: Submission;
  onBack: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  assessment,
  submission,
  onBack,
}) => {
  // Track language preference per question for results (defaults to 'ga' as requested)
  const [resultLangs, setResultLangs] = useState<Record<string, 'en' | 'ga'>>({});
  
  const getLang = (id: string) => resultLangs[id] || 'ga';
  
  const toggleLang = (id: string) => {
    setResultLangs(prev => ({
      ...prev,
      [id]: prev[id] === 'en' ? 'ga' : 'en'
    }));
  };

  const totalPossibleMarks = assessment.questions.reduce((sum, q) => sum + q.maxMarks, 0);
  const percentage = submission.totalScore !== undefined 
    ? Math.round((submission.totalScore / totalPossibleMarks) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <button
            onClick={onBack}
            className="mr-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-slate-800">Assessment Results / Torthaí Measúnaithe</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-1">{assessment.title.en}</h2>
            <h3 className="text-lg font-medium text-slate-500 italic mb-2">{assessment.title.ga}</h3>
            <p className="text-slate-500 text-sm">
              Submitted on {new Date(submission.submittedAt).toLocaleString()}
            </p>
          </div>
          
          <div className="flex items-center gap-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div className="text-center">
              <p className="text-sm text-slate-500 font-medium mb-1">Total Score</p>
              <p className="text-3xl font-bold text-slate-800">
                {submission.totalScore} <span className="text-lg text-slate-400 font-normal">/ {totalPossibleMarks}</span>
              </p>
            </div>
            <div className="w-px h-12 bg-slate-200"></div>
            <div className="text-center">
              <p className="text-sm text-slate-500 font-medium mb-1">Percentage</p>
              <p className={`text-3xl font-bold ${percentage >= 70 ? 'text-success' : percentage >= 40 ? 'text-warning' : 'text-danger'}`}>
                {percentage}%
              </p>
            </div>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" />
          Detailed Feedback / Aiseolas Mionsonraithe
        </h3>

        <div className="space-y-6">
          {assessment.questions.map((question, index) => {
            const lang = getLang(question.id);
            const studentAnswerRaw = submission.answers[question.id];
            const feedback = submission.feedback?.[question.id];
            const score = feedback?.score || 0;
            const isFullMarks = score === question.maxMarks;

            // Format student answer for display
            let displayAnswer = studentAnswerRaw || (lang === 'en' ? 'No answer provided' : 'Níor cuireadh aon fhreagra ar fáil');
            let isCorrectMcq = false;
            
            if (question.type === 'mcq' && studentAnswerRaw !== undefined) {
              const answerIndex = parseInt(studentAnswerRaw);
              if (!isNaN(answerIndex) && question.options) {
                displayAnswer = question.options[answerIndex][lang];
                isCorrectMcq = answerIndex === question.correctAnswerIndex;
              }
            }

            return (
              <div key={question.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Question Header */}
                <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-start gap-4">
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                        {lang === 'en' ? 'Question' : 'Ceist'} {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleLang(question.id)}
                        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        <Languages className="w-3.5 h-3.5" />
                        {lang === 'en' ? 'Gaeilge' : 'English'}
                      </button>
                    </div>
                    <p className="text-slate-800 font-medium">{question.text[lang]}</p>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${
                    isFullMarks ? 'bg-success/10 text-success' : score > 0 ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'
                  }`}>
                    {score} / {question.maxMarks}
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Student Answer */}
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                      {lang === 'en' ? 'Your Answer' : 'Do Fhreagra'}
                    </span>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-slate-700">
                      {question.type === 'mcq' ? (
                        <div className="flex items-center gap-2">
                          {isCorrectMcq ? (
                            <CheckCircle2 className="w-4 h-4 text-success" />
                          ) : (
                            <XCircle className="w-4 h-4 text-danger" />
                          )}
                          <span>{displayAnswer}</span>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{displayAnswer}</p>
                      )}
                    </div>
                  </div>

                  {/* Correct Answer / Mark Scheme (if applicable) */}
                  {question.type === 'mcq' && !isCorrectMcq && question.options && question.correctAnswerIndex !== undefined && (
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                        {lang === 'en' ? 'Correct Answer' : 'Freagra Ceart'}
                      </span>
                      <div className="p-3 bg-success/5 rounded-lg border border-success/20 text-success flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{question.options[question.correctAnswerIndex][lang]}</span>
                      </div>
                    </div>
                  )}

                  {/* AI Feedback for Written Questions */}
                  {question.type === 'written' && feedback && (
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Bot className="w-3.5 h-3.5" />
                        {lang === 'en' ? 'AI Examiner Feedback' : 'Aiseolas ón Scrúdaitheoir AI'}
                      </span>
                      <div className="p-4 bg-green-50 rounded-lg border border-green-100 text-slate-700 text-sm leading-relaxed">
                        {lang === 'en' ? feedback.commentEn : feedback.commentGa}
                      </div>
                      
                      {question.markScheme && (
                        <div className="mt-3">
                           <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                             {lang === 'en' ? 'Mark Scheme Reference' : 'Tagairt don Scéim Mharcála'}
                           </span>
                           <p className="text-xs text-slate-500 italic">{question.markScheme[lang]}</p>
                        </div>
                      )}
                    </div>
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
