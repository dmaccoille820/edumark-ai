import React, { useState } from 'react';
import { BookOpen, LogIn } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<void>;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^\d{4}$/.test(password)) {
      setError('Password must be exactly four digits.');
      return;
    }
    try {
      await onLogin(email, password);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to log in.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary/10 p-3 rounded-full mb-4">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">EduMark AI</h1>
          <p className="text-slate-500 text-sm mt-1">Assessment Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Password (4 digits)
            </label>
            <input
              id="password"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
              placeholder="1234"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
              placeholder="user@school.edu"
            />
          </div>

          {error && (
            <div className="p-3 bg-danger/10 text-danger text-sm rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-primary hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Access Portal
          </button>
        </form>
        
        <div className="mt-6 text-xs text-slate-400 text-center space-y-1">
          <p className="font-semibold">Demo Credentials:</p>
          <p>Student: student@school.edu / 0123</p>
          <p>Teacher: teacher@school.edu / 9999</p>
        </div>
      </div>
    </div>
  );
};
