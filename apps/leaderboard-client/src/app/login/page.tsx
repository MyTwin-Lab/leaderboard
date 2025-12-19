'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/admin';
  
  const [githubUsername, setGithubUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          github_username: githubUsername,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setIsLoading(false);
        return;
      }

      // Rediriger vers la page d'origine ou /admin
      router.push(from);
      router.refresh();
    } catch (err) {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-20 flex flex-col items-center justify-center px-4">

      {/* Card de login */}
      <div className="w-full max-w-md space-y-6 rounded-md bg-white/5 backdrop-blur-sm border border-white/10 p-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white">
            Login to Leaderboard
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Sign in with your GitHub username
          </p>
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
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-3 py-2.5 px-4 rounded-lg bg-brandCP/30 hover:bg-brandCP/40 text-brandCP font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mt-20 flex items-center justify-center text-white/60">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
