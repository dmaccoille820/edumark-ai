import React from 'react';
import { Bot, Loader2 } from 'lucide-react';

interface GradingOverlayProps {
  current?: number;
  total?: number;
}

export const GradingOverlay: React.FC<GradingOverlayProps> = ({ current, total }) => {
  const hasProgress = typeof total === 'number' && total > 0;
  const currentSafe = current || 1;
  const progressPercent = hasProgress ? Math.min(100, Math.round((currentSafe / total) * 100)) : 0;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
          <div className="relative bg-primary text-white p-4 rounded-full">
            <Bot className="w-8 h-8" />
          </div>
        </div>
        
        <h2 className="text-xl font-bold text-slate-800 mb-2">AI is Grading...</h2>
        <p className="text-slate-500 text-sm mb-4">
          Please wait while our AI evaluates your written answers against the mark scheme.
        </p>

        {hasProgress && (
          <div className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4">
            <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
              <span>Evaluating answers</span>
              <span>{currentSafe} of {total}</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
        
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    </div>
  );
};

