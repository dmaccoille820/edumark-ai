import React from 'react';
import { Bot, Loader2 } from 'lucide-react';

export const GradingOverlay: React.FC = () => {
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
        <p className="text-slate-500 text-sm mb-6">
          Please wait while our AI examiner evaluates your written answers against the mark scheme.
        </p>
        
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    </div>
  );
};
