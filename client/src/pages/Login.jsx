import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Wallet, Mail, Lock, AlertCircle } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Incorrect email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 py-16 sm:px-8 lg:px-12">
      <div className="w-full max-w-lg space-y-10">
        
        {/* Brand Identity */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Wallet className="h-8 w-8" />
          </div>
          <h2 className="mt-8 text-4xl font-extrabold tracking-tight text-slate-900">
            Welcome Back
          </h2>
          <p className="mt-3 text-base text-slate-500">
            Keep track of shared bills and settle up stress-free
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-[32px] border border-slate-200 bg-white p-10 shadow-sm">
          <form className="space-y-8" onSubmit={handleSubmit}>
            
            {/* Error Banner */}
            {error && (
              <div className="flex items-center gap-3.5 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-800">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2.5">
              <label htmlFor="email" className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Email Address
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 py-4 pl-12 pr-4 text-base placeholder-slate-400 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:ring-offset-0 text-slate-800"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2.5">
              <label htmlFor="password" className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Password
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 py-4 pl-12 pr-4 text-base placeholder-slate-400 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:ring-offset-0 text-slate-800"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full justify-center rounded-2xl bg-slate-900 px-6 py-4 text-base font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Toggle Navigation Link */}
          <div className="mt-8 text-center">
            <span className="text-base text-slate-500">Don't have an account? </span>
            <Link to="/signup" className="text-base font-bold text-slate-900 hover:underline transition-colors">
              Create one for free
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
