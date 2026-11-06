import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Film, Lock, Mail, Shield, User, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectPath = new URLSearchParams(location.search).get('redirect') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.login({ email, password });
      login(res.access_token, res.user);
      navigate(redirectPath === 'booking-summary' ? '/booking/summary' : redirectPath);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (role: 'user' | 'admin') => {
    setLoading(true);
    setError(null);
    try {
      await demoLogin(role);
      navigate(role === 'admin' ? '/admin' : (redirectPath === 'booking-summary' ? '/booking/summary' : redirectPath));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col justify-center items-center p-4">
      
      {/* Background Glow */}
      <div className="absolute top-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full space-y-6 relative z-10">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center space-x-2.5 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Film className="w-6 h-6 text-slate-950 font-bold" />
            </div>
          </Link>
          <h2 className="text-2xl font-black text-white font-['Outfit']">
            Welcome Back to CineBook
          </h2>
          <p className="text-xs text-slate-400">
            Sign in to access your digital tickets and express cinema checkout
          </p>
        </div>

        {/* Quick Demo Login Bar for Judges */}
        <div className="bg-slate-900/80 rounded-2xl border border-orange-500/30 p-4 space-y-2.5 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-orange-400 flex items-center">
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Hackathon 1-Click Demo Logins:
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('user')}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center justify-center space-x-1.5 transition-colors"
            >
              <User className="w-3.5 h-3.5 text-orange-400" />
              <span>Demo Customer</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('admin')}
              className="py-2 px-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-xs font-semibold text-orange-300 border border-orange-500/40 flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Admin Console</span>
            </button>
          </div>
        </div>

        {/* Login Form */}
        <div className="bg-[#0e1117] rounded-3xl border border-slate-800 p-6 sm:p-8 space-y-4 shadow-2xl">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@cinebook.com"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-slate-950 font-bold text-xs shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-2 text-center text-xs text-slate-400">
            Don't have an account?{' '}
            <Link
              to={redirectPath ? `/register?redirect=${encodeURIComponent(redirectPath)}` : '/register'}
              className="text-orange-400 font-bold hover:underline"
            >
              Create an Account
            </Link>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center">
          <Link to="/" className="text-xs text-slate-500 hover:text-slate-300">
            ← Back to Home
          </Link>
        </div>

      </div>
    </div>
  );
};

