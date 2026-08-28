import { Submission, User } from '../types';

const tokenKey = 'edumark.auth.token';

export async function login(email: string, password: string): Promise<User> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to log in.');
  localStorage.setItem(tokenKey, data.token);
  return data.user;
}

function authHeaders() {
  const token = localStorage.getItem(tokenKey);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function saveSubmission(submission: Submission): Promise<Submission> {
  const response = await fetch('/api/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(submission),
  });
  if (!response.ok) throw new Error('Unable to save assessment results.');
  return response.json();
}

export async function getSubmissions(): Promise<Submission[]> {
  const response = await fetch('/api/submissions', { headers: authHeaders() });
  if (!response.ok) throw new Error('Unable to load assessment results.');
  return response.json();
}

export function clearSession() {
  localStorage.removeItem(tokenKey);
}