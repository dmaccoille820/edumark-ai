import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Check,
  Loader2,
  Pencil,
  Volume2,
  VolumeX,
  Sparkles,
  AlertCircle,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { Assessment, Question, BilingualText } from '../types';
import { updateQuestion, regenerateQuestionAudio } from '../services/api';

interface QuestionEditorModalProps {
  assessment: Assessment;
  onClose: () => void;
  onAssessmentUpdated: (updatedAssessment: Assessment) => void;
}

interface SingleQuestionEditorProps {
  question: Question;
  index: number;
  onQuestionUpdated: (updated: Question) => void;
}

const SingleQuestionEditor: React.FC<SingleQuestionEditorProps> = ({
  question,
  index,
  onQuestionUpdated,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [textEn, setTextEn] = useState(question.text?.en || '');
  const [textGa, setTextGa] = useState(question.text?.ga || '');
  const [maxMarks, setMaxMarks] = useState(question.maxMarks || 1);
  const [markSchemeEn, setMarkSchemeEn] = useState(question.markScheme?.en || '');
  const [markSchemeGa, setMarkSchemeGa] = useState(question.markScheme?.ga || '');
  const [options, setOptions] = useState<BilingualText[]>(
    question.options ? [...question.options] : []
  );
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState<number>(
    question.correctAnswerIndex ?? 0
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isRegeneratingAudio, setIsRegeneratingAudio] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Audio preview state
  const [playingLang, setPlayingLang] = useState<'en' | 'ga' | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync state if question prop changes from outside
  useEffect(() => {
    setTextEn(question.text?.en || '');
    setTextGa(question.text?.ga || '');
    setMaxMarks(question.maxMarks || 1);
    setMarkSchemeEn(question.markScheme?.en || '');
    setMarkSchemeGa(question.markScheme?.ga || '');
    setOptions(question.options ? [...question.options] : []);
    setCorrectAnswerIndex(question.correctAnswerIndex ?? 0);
  }, [question]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playAudio = (url: string | undefined, lang: 'en' | 'ga') => {
    if (!url) return;

    if (playingLang === lang) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingLang(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingLang(lang);

    audio.onended = () => {
      setPlayingLang(null);
      audioRef.current = null;
    };
    audio.onerror = () => {
      setPlayingLang(null);
      audioRef.current = null;
    };

    audio.play().catch(() => setPlayingLang(null));
  };

  const handleCancel = () => {
    setTextEn(question.text?.en || '');
    setTextGa(question.text?.ga || '');
    setMaxMarks(question.maxMarks || 1);
    setMarkSchemeEn(question.markScheme?.en || '');
    setMarkSchemeGa(question.markScheme?.ga || '');
    setOptions(question.options ? [...question.options] : []);
    setCorrectAnswerIndex(question.correctAnswerIndex ?? 0);
    setSaveError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!textEn.trim() || !textGa.trim()) {
      setSaveError('English and Irish question text are both required.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const payload = {
        text: { en: textEn.trim(), ga: textGa.trim() },
        maxMarks: Number(maxMarks),
        markScheme:
          question.type === 'written'
            ? { en: markSchemeEn.trim(), ga: markSchemeGa.trim() }
            : undefined,
        options: question.type === 'mcq' ? options : undefined,
        correctAnswerIndex: question.type === 'mcq' ? correctAnswerIndex : undefined,
      };

      const updated = await updateQuestion(question.id, payload);
      onQuestionUpdated(updated);
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update question in Neon database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateAudio = async () => {
    setIsRegeneratingAudio(true);
    setSaveError(null);
    try {
      const result = await regenerateQuestionAudio(question.id, {
        en: textEn.trim() || question.text.en,
        ga: textGa.trim() || question.text.ga,
      });

      const updatedQuestion: Question = {
        ...question,
        audioUrl: {
          en: result.audioUrlEn || question.audioUrl?.en,
          ga: result.audioUrlGa || question.audioUrl?.ga,
        },
      };
      onQuestionUpdated(updatedQuestion);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to generate audio for this question.');
    } finally {
      setIsRegeneratingAudio(false);
    }
  };

  const updateOptionText = (optIdx: number, lang: 'en' | 'ga', value: string) => {
    setOptions((prev) => {
      const copy = [...prev];
      copy[optIdx] = {
        ...copy[optIdx],
        [lang]: value,
      };
      return copy;
    });
  };

  return (
    <div
      id={`question-card-${question.id}`}
      className={`border rounded-xl transition-all ${
        isEditing
          ? 'border-primary/50 shadow-md bg-white'
          : 'border-slate-200 hover:border-slate-300 bg-white'
      }`}
    >
      {/* Question Header Bar */}
      <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 rounded-t-xl">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
            {index + 1}
          </span>
          <span className="font-semibold text-slate-800 text-sm">
            Question {index + 1}
          </span>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
              question.type === 'mcq'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-purple-100 text-purple-700'
            }`}
          >
            {question.type === 'mcq' ? 'Multiple Choice' : 'Written Answer'}
          </span>
          <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
            {question.maxMarks} {question.maxMarks === 1 ? 'Mark' : 'Marks'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio Preview Buttons */}
          {question.audioUrl?.en && (
            <button
              type="button"
              onClick={() => playAudio(question.audioUrl?.en, 'en')}
              className={`px-2 py-1 text-xs font-medium rounded flex items-center gap-1 transition-colors ${
                playingLang === 'en'
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title="Listen to English Audio"
            >
              {playingLang === 'en' ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              EN Audio
            </button>
          )}

          {question.audioUrl?.ga && (
            <button
              type="button"
              onClick={() => playAudio(question.audioUrl?.ga, 'ga')}
              className={`px-2 py-1 text-xs font-medium rounded flex items-center gap-1 transition-colors ${
                playingLang === 'ga'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
              }`}
              title="Listen to Irish Audio (Abair)"
            >
              {playingLang === 'ga' ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              GA Audio
            </button>
          )}

          {saveSuccess && (
            <span className="text-xs text-primary font-semibold flex items-center gap-1 animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved!
            </span>
          )}

          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-3 py-1 text-xs font-medium bg-slate-100 hover:bg-primary hover:text-white text-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Edit Question
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 rounded transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Body: View Mode or Edit Mode */}
      <div className="p-4 space-y-4">
        {saveError && (
          <div className="p-3 bg-red-50 border border-red-200 text-danger text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {!isEditing ? (
          /* READ-ONLY VIEW */
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Question Text (English)
                </span>
                <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                  {question.text?.en || <span className="text-slate-400 italic">None</span>}
                </p>
              </div>

              <div className="bg-emerald-50/40 p-3 rounded-lg border border-emerald-100">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block mb-1">
                  Ceist (Gaeilge)
                </span>
                <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed italic">
                  {question.text?.ga || <span className="text-slate-400 italic">None</span>}
                </p>
              </div>
            </div>

            {/* Diagrams Preview if present */}
            {(question.image?.en || question.image?.ga || question.markSchemeImage) && (
              <div className="flex flex-wrap gap-3 pt-1">
                {question.image?.en && (
                  <div className="text-xs text-slate-500">
                    <span className="block font-medium mb-1">English Diagram:</span>
                    <img
                      src={question.image.en}
                      alt="EN diagram"
                      className="h-20 rounded border object-contain bg-white"
                    />
                  </div>
                )}
                {question.image?.ga && (
                  <div className="text-xs text-slate-500">
                    <span className="block font-medium mb-1">Irish Diagram:</span>
                    <img
                      src={question.image.ga}
                      alt="GA diagram"
                      className="h-20 rounded border object-contain bg-white"
                    />
                  </div>
                )}
                {question.markSchemeImage && (
                  <div className="text-xs text-slate-500">
                    <span className="block font-medium mb-1">Mark Scheme Visual:</span>
                    <img
                      src={question.markSchemeImage}
                      alt="Mark Scheme guide"
                      className="h-20 rounded border object-contain bg-white"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Mark Scheme or MCQ Options */}
            {question.type === 'written' ? (
              <div className="grid md:grid-cols-2 gap-4 pt-1">
                <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100">
                  <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block mb-1">
                    Mark Scheme (English)
                  </span>
                  <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                    {question.markScheme?.en || <span className="text-slate-400 italic">None</span>}
                  </p>
                </div>
                <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100">
                  <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block mb-1">
                    Scéim Mharcála (Gaeilge)
                  </span>
                  <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed italic">
                    {question.markScheme?.ga || <span className="text-slate-400 italic">None</span>}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Multiple Choice Options
                </span>
                <div className="grid sm:grid-cols-2 gap-2">
                  {question.options?.map((opt, optIdx) => {
                    const isCorrect = question.correctAnswerIndex === optIdx;
                    return (
                      <div
                        key={optIdx}
                        className={`p-2 rounded border text-xs flex items-start gap-2 ${
                          isCorrect
                            ? 'border-primary bg-green-50/60 font-medium text-slate-900'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <span className="font-bold text-slate-400 uppercase">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        <div className="min-w-0">
                          <div>{opt.en}</div>
                          <div className="italic text-slate-500">{opt.ga}</div>
                        </div>
                        {isCorrect && (
                          <span className="ml-auto text-[10px] bg-primary text-white px-1.5 py-0.5 rounded font-semibold uppercase">
                            Correct
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* EDIT MODE FORM */
          <div className="space-y-4">
            {/* Marks & Type */}
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Marks Allocated
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none font-medium"
                />
              </div>
              <div className="text-xs text-slate-500 pt-5">
                Type: <strong className="text-slate-700 uppercase">{question.type}</strong>
              </div>
            </div>

            {/* Question Text Inputs */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Question Text (English) <span className="text-danger">*</span>
                </label>
                <textarea
                  rows={4}
                  value={textEn}
                  onChange={(e) => setTextEn(e.target.value)}
                  placeholder="Enter the question in English..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-800 mb-1">
                  Ceist (Gaeilge) <span className="text-danger">*</span>
                </label>
                <textarea
                  rows={4}
                  value={textGa}
                  onChange={(e) => setTextGa(e.target.value)}
                  placeholder="Cuir isteach an cheist i nGaeilge..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none italic"
                />
              </div>
            </div>

            {/* If written, edit Mark Schemes */}
            {question.type === 'written' ? (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mark Scheme / Criteria (English)
                  </label>
                  <textarea
                    rows={3}
                    value={markSchemeEn}
                    onChange={(e) => setMarkSchemeEn(e.target.value)}
                    placeholder="Award 1 mark for..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-800 mb-1">
                    Scéim Mharcála (Gaeilge)
                  </label>
                  <textarea
                    rows={3}
                    value={markSchemeGa}
                    onChange={(e) => setMarkSchemeGa(e.target.value)}
                    placeholder="Bronn 1 mharc as..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none italic"
                  />
                </div>
              </div>
            ) : (
              /* If MCQ, edit Options */
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Multiple Choice Options &amp; Correct Answer
                </label>
                <div className="space-y-2">
                  {options.map((opt, optIdx) => (
                    <div
                      key={optIdx}
                      className="p-3 border border-slate-200 rounded-lg bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center gap-3"
                    >
                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-xs text-slate-700 shrink-0">
                        <input
                          type="radio"
                          name={`correct-answer-${question.id}`}
                          checked={correctAnswerIndex === optIdx}
                          onChange={() => setCorrectAnswerIndex(optIdx)}
                          className="text-primary focus:ring-primary"
                        />
                        Option {String.fromCharCode(65 + optIdx)}
                      </label>

                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                        <input
                          type="text"
                          value={opt.en}
                          onChange={(e) => updateOptionText(optIdx, 'en', e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + optIdx)} (English)`}
                          className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-primary outline-none bg-white"
                        />
                        <input
                          type="text"
                          value={opt.ga}
                          onChange={(e) => updateOptionText(optIdx, 'ga', e.target.value)}
                          placeholder={`Rogha ${String.fromCharCode(65 + optIdx)} (Gaeilge)`}
                          className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-primary outline-none italic bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar inside Edit Mode */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRegenerateAudio}
                disabled={isRegeneratingAudio || isSaving}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                title="Regenerate English and Irish voiceovers using updated text"
              >
                {isRegeneratingAudio ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                )}
                {isRegeneratingAudio ? 'Generating Voiceovers...' : 'Regenerate Audio'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !textEn.trim() || !textGa.trim()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-green-800 disabled:opacity-60 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  {isSaving ? 'Saving to Neon...' : 'Save Question'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({
  assessment,
  onClose,
  onAssessmentUpdated,
}) => {
  const [currentAssessment, setCurrentAssessment] = useState<Assessment>(assessment);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleQuestionUpdated = (updatedQuestion: Question) => {
    const updatedQuestions = currentAssessment.questions.map((q) =>
      q.id === updatedQuestion.id ? updatedQuestion : q
    );
    const updatedAssessment: Assessment = {
      ...currentAssessment,
      questions: updatedQuestions,
    };
    setCurrentAssessment(updatedAssessment);
    onAssessmentUpdated(updatedAssessment);
  };

  const totalMarks = currentAssessment.questions.reduce((sum, q) => sum + q.maxMarks, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-primary/10 text-primary rounded-lg">
                <FileText className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-slate-800 text-lg leading-tight truncate">
                  Edit Assessment Questions
                </h3>
                <p className="text-xs text-slate-500 truncate">
                  {currentAssessment.title.en}{' '}
                  <span className="italic text-slate-400">({currentAssessment.title.ga})</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full font-semibold">
              {currentAssessment.questions.length} Questions
            </span>
            <span className="text-xs bg-green-100 text-green-800 px-2.5 py-1 rounded-full font-semibold">
              {totalMarks} Total Marks
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              title="Close editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick jump navigation bar */}
        {currentAssessment.questions.length > 1 && (
          <div className="px-5 py-2.5 bg-white border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-slate-400 font-medium mr-1 shrink-0">Jump to:</span>
            {currentAssessment.questions.map((q, idx) => (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  const el = document.getElementById(`question-card-${q.id}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-primary hover:text-white text-slate-600 font-medium transition-colors shrink-0"
              >
                Q{idx + 1}
              </button>
            ))}
          </div>
        )}

        {/* Question List Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 bg-slate-50/40">
          {currentAssessment.questions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No questions found for this assessment.
            </div>
          ) : (
            currentAssessment.questions.map((q, idx) => (
              <SingleQuestionEditor
                key={q.id}
                question={q}
                index={idx}
                onQuestionUpdated={handleQuestionUpdated}
              />
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Changes saved here update the Neon database immediately.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold bg-primary hover:bg-green-800 text-white rounded-lg transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
