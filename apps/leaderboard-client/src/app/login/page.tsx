'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type AuthMode = 'login' | 'register';

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/';
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [githubUsername, setGithubUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setGithubUsername('');
    setFullName('');
    setPassword('');
    setConfirmPassword('');
    setError('');
  };

  const switchMode = (newMode: AuthMode) => {
    resetForm();
    setMode(newMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login'
        ? { github_username: githubUsername, password }
        : { github_username: githubUsername, full_name: fullName, password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || (mode === 'login' ? 'Login failed' : 'Registration failed'));
        setIsLoading(false);
        return;
      }

      router.push(from);
      router.refresh();
    } catch (err) {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-5 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-md bg-white/5 backdrop-blur-sm border border-white/10 p-4">
        
        {/* Toggle Login / Register */}
        <div className="flex rounded-lg bg-white/5 p-1">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              mode === 'login'
                ? 'bg-brandCP/20 text-brandCP'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              mode === 'register'
                ? 'bg-brandCP/20 text-brandCP'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            Create account
          </button>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white">
            {mode === 'login' ? 'Login to Leaderboard' : 'Create your account'}
          </h2>
        </div>
        
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="github-username" className="block text-sm font-medium text-white/80 mb-1.5">
                GitHub Username
              </label>
              <input
                id="github-username"
                name="github_username"
                type="text"
                required
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent transition-all"
                placeholder="your-github-username"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label htmlFor="full-name" className="block text-sm font-medium text-white/80 mb-1.5">
                  Full Name
                </label>
                <input
                  id="full-name"
                  name="full_name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent transition-all"
                  placeholder="John Doe"
                />
              </div>
            )}
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/80 mb-1.5">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-white/80 mb-1.5">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  name="confirm_password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mx-auto block mt-10 py-2.5 px-8 rounded-lg bg-brandCP/30 hover:bg-brandCP/40 text-brandCP font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
              : (mode === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mt-20 flex items-center justify-center text-white/60">Loading...</div>}>
      <AuthForm />
    </Suspense>
  );
}
