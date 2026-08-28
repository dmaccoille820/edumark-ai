import React, { useState } from 'react';
import { BookOpen, LogIn } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [accessId, setAccessId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api-proxy/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, accessId })
      });

      if (res.ok) {
        const user = await res.json();
        onLogin(user);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      console.error('Login request error:', err);
      setError('Failed to connect to the login service.');
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

          <div>
            <label htmlFor="accessId" className="block text-sm font-medium text-slate-700 mb-1">
              Exam Number / Teacher ID
            </label>
            <input
              id="accessId"
              type="text"
              required
              value={accessId}
              onChange={(e) => setAccessId(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
              placeholder="EXAM123 or TEACH999"
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
          <p>Student: student@school.edu / EXAM123</p>
          <p>Teacher: teacher@school.edu / TEACH999</p>
        </div>
      </div>
    </div>
  );
};
