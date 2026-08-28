import React, { useState } from 'react';
import { Assessment, Question } from '../types';
import { AlertCircle, Send, Languages } from 'lucide-react';

interface AssessmentViewProps {
  assessment: Assessment;
  onSubmit: (answers: Record<string, string>) => void;
  onCancel: () => void;
}

export const AssessmentView: React.FC<AssessmentViewProps> = ({
  assessment,
  onSubmit,
  onCancel,
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Track language preference per question and for the header
  const [headerLang, setHeaderLang] = useState<'en' | 'ga'>('en');
  const [questionLangs, setQuestionLangs] = useState<Record<string, 'en' | 'ga'>>({});

  const getQuestionLang = (id: string) => questionLangs[id] || 'en';
  
  const toggleQuestionLang = (id: string) => {
    setQuestionLangs(prev => ({
      ...prev,
      [id]: prev[id] === 'ga' ? 'en' : 'ga'
    }));
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const unanswered = assessment.questions.filter((q) => !answers[q.id] || answers[q.id].trim() === '');
    if (unanswered.length > 0) {
      if (!window.confirm(`You have ${unanswered.length} unanswered questions. Are you sure you want to submit?`)) {
        return;
      }
    }

    setIsSubmitting(true);
    onSubmit(answers);
  };

  const renderQuestion = (question: Question, index: number) => {
    const lang = getQuestionLang(question.id);

    return (
      <div key={question.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-grow pr-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                {lang === 'en' ? 'Question' : 'Ceist'} {index + 1}
              </span>
              <button
                type="button"
                onClick={() => toggleQuestionLang(question.id)}
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <Languages className="w-3.5 h-3.5" />
                {lang === 'en' ? 'Gaeilge' : 'English'}
              </button>
            </div>
            <h3 className="text-lg font-medium text-slate-800">
              {question.text[lang]}
            </h3>
          </div>
          <span className="text-sm font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded whitespace-nowrap">
            {question.maxMarks} {lang === 'en' ? (question.maxMarks === 1 ? 'mark' : 'marks') : (question.maxMarks === 1 ? 'marc' : 'mharc')}
          </span>
        </div>

        {question.type === 'mcq' && question.options && (
          <div className="space-y-3 mt-4">
            {question.options.map((option, i) => (
              <label
                key={i}
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  answers[question.id] === i.toString()
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={i.toString()}
                  checked={answers[question.id] === i.toString()}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  className="w-4 h-4 text-primary border-slate-300 focus:ring-primary"
                />
                <span className="ml-3 text-slate-700">{option[lang]}</span>
              </label>
            ))}
          </div>
        )}

        {question.type === 'written' && (
          <div className="mt-4">
            <textarea
              rows={5}
              value={answers[question.id] || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              placeholder={lang === 'en' ? "Type your answer here..." : "Clóscríobh do fhreagra anseo..."}
              className="w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-y"
            />
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {lang === 'en' 
                ? "Your answer will be evaluated by AI based on the mark scheme. You can answer in English or Irish." 
                : "Déanfaidh AI do fhreagra a mheas bunaithe ar an scéim mharcála. Is féidir leat freagra a thabhairt i mBéarla nó i nGaeilge."}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 truncate pr-4">
            <h1 className="text-xl font-bold text-slate-800 truncate">
              {assessment.title[headerLang]}
            </h1>
            <button
              type="button"
              onClick={() => setHeaderLang(prev => prev === 'en' ? 'ga' : 'en')}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex-shrink-0"
            >
              <Languages className="w-3.5 h-3.5" />
              {headerLang === 'en' ? 'Gaeilge' : 'English'}
            </button>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-slate-500 hover:text-slate-700 font-medium"
            disabled={isSubmitting}
          >
            {headerLang === 'en' ? 'Cancel' : 'Cealaigh'}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <p className="text-slate-600">{assessment.description[headerLang]}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {assessment.questions.map((q, index) => renderQuestion(q, index))}

          <div className="flex justify-end mt-8">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-green-800 text-white font-medium px-6 py-3 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>{headerLang === 'en' ? 'Processing...' : 'Ag Próiseáil...'}</>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {headerLang === 'en' ? 'Submit Assessment' : 'Cuir Isteach Measúnú'}
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};
