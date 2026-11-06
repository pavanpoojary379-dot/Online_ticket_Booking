import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Film,
  Ticket,
  IndianRupee,
  Users,
  Percent,
  Plus,
  Trash2,
  Edit,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  BarChart3,
  Calendar,
  X,
  RefreshCw
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';
import { adminApi, moviesApi } from '../services/api';
import { AdminStats, Movie, Booking } from '../types';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export const AdminDashboardPage: React.FC = () => {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MOVIES' | 'BOOKINGS'>('OVERVIEW');

  // Add/Edit Movie Modal state
  const [showMovieModal, setShowMovieModal] = useState<boolean>(false);
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [movieForm, setMovieForm] = useState({
    title: '',
    description: '',
    poster_url: '',
    backdrop_url: '',
    trailer_url: '',
    genre: 'Action / Sci-Fi',
    duration_minutes: 150,
    release_date: '2025-01-01',
    language: 'Hindi / English',
    rating: 8.5,
    certificate: 'UA',
    is_now_showing: true,
    is_upcoming: false,
    is_popular: true,
    cast: '',
    director: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, moviesData, bookingsData] = await Promise.all([
        adminApi.getDashboard(),
        moviesApi.getAll(),
        adminApi.getAllBookings(),
      ]);
      setStats(statsData);
      setMovies(moviesData);
      setBookings(bookingsData);
    } catch (err) {
      console.error('Error loading admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate('/login?redirect=/admin');
      return;
    }
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, isLoading]);

  const handleOpenAddModal = () => {
    setEditingMovie(null);
    setMovieForm({
      title: '',
      description: '',
      poster_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80',
      backdrop_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
      trailer_url: 'https://www.youtube.com/watch?v=kQDd1AhGIHk',
      genre: 'Action / Adventure',
      duration_minutes: 155,
      release_date: new Date().toISOString().split('T')[0],
      language: 'Hindi / English',
      rating: 8.5,
      certificate: 'UA',
      is_now_showing: true,
      is_upcoming: false,
      is_popular: true,
      cast: 'Ensemble Cast',
      director: 'Acclaimed Director'
    });
    setShowMovieModal(true);
  };

  const handleOpenEditModal = (m: Movie) => {
    setEditingMovie(m);
    setMovieForm({
      title: m.title,
      description: m.description,
      poster_url: m.poster_url,
      backdrop_url: m.backdrop_url || '',
      trailer_url: m.trailer_url || '',
      genre: m.genre,
      duration_minutes: m.duration_minutes,
      release_date: m.release_date,
      language: m.language,
      rating: m.rating,
      certificate: m.certificate,
      is_now_showing: m.is_now_showing,
      is_upcoming: m.is_upcoming,
      is_popular: m.is_popular,
      cast: m.cast || '',
      director: m.director || ''
    });
    setShowMovieModal(true);
  };

  const handleSaveMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMovie) {
        await moviesApi.update(editingMovie.id, movieForm);
      } else {
        await moviesApi.create(movieForm);
      }
      setShowMovieModal(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save movie');
    }
  };

  const handleDeleteMovie = async (id: number, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await moviesApi.delete(id);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete movie');
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        
        {/* Admin Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center">
                <Shield className="w-3 h-3 mr-1" /> CineBook Administration
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] mt-1">
              Admin & Analytics Console
            </h1>
            <p className="text-xs text-slate-400">
              Real-time revenue monitoring, cinema occupancy, and movie catalogue management
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadData}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-orange-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Movie</span>
            </button>
          </div>
        </div>

        {/* Top Metric Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            
            <div className="bg-[#0e1117] rounded-2xl border border-slate-800 p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] uppercase font-bold tracking-wider">Total Revenue</span>
                <IndianRupee className="w-4 h-4 text-orange-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                ₹{stats.total_revenue.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-green-400 font-semibold">
                Live confirmed bookings
              </div>
            </div>

            <div className="bg-[#0e1117] rounded-2xl border border-slate-800 p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] uppercase font-bold tracking-wider">Bookings</span>
                <Ticket className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                {stats.total_bookings}
              </div>
              <div className="text-[10px] text-slate-400">
                Confirmed tickets
              </div>
            </div>

            <div className="bg-[#0e1117] rounded-2xl border border-slate-800 p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] uppercase font-bold tracking-wider">Movies Live</span>
                <Film className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                {stats.total_movies}
              </div>
              <div className="text-[10px] text-slate-400">
                In catalogue
              </div>
            </div>

            <div className="bg-[#0e1117] rounded-2xl border border-slate-800 p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] uppercase font-bold tracking-wider">Registered Users</span>
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                {stats.total_users}
              </div>
              <div className="text-[10px] text-slate-400">
                Customer accounts
              </div>
            </div>

            <div className="bg-[#0e1117] rounded-2xl border border-slate-800 p-4 space-y-2 col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] uppercase font-bold tracking-wider">Seat Occupancy</span>
                <Percent className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                {stats.occupancy_rate}%
              </div>
              <div className="text-[10px] text-slate-400">
                Auditorium fill rate
              </div>
            </div>

          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 bg-[#0e1117] p-1.5 rounded-xl border border-slate-800 w-fit">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'OVERVIEW'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Analytics & Overview
          </button>
          <button
            onClick={() => setActiveTab('MOVIES')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'MOVIES'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Manage Movies ({movies.length})
          </button>
          <button
            onClick={() => setActiveTab('BOOKINGS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'BOOKINGS'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Bookings ({bookings.length})
          </button>
        </div>

        {/* Tab 1: Overview & Recharts Analytics */}
        {activeTab === 'OVERVIEW' && stats && (
          <div className="space-y-6">
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Chart 1: Revenue by Movie */}
              <div className="bg-[#0e1117] rounded-2xl border border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center">
                    <BarChart3 className="w-4 h-4 mr-1.5 text-orange-400" />
                    Revenue by Blockbuster (₹)
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">Top Titles</span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.revenue_by_movie}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="movie_title"
                        stroke="#64748b"
                        fontSize={10}
                        tickFormatter={(v) => v.length > 10 ? `${v.substring(0, 10)}...` : v}
                      />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#090a0f', borderColor: '#334155', borderRadius: '12px' }}
                        itemStyle={{ color: '#f97316' }}
                      />
                      <Bar dataKey="revenue" fill="#f97316" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: 7-Day Trend */}
              <div className="bg-[#0e1117] rounded-2xl border border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center">
                    <Calendar className="w-4 h-4 mr-1.5 text-amber-400" />
                    Daily Booking Growth & Trajectory
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">Last 7 Days</span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.daily_analytics}>
                      <defs>
                        <linearGradient id="colorRev" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="5%" stopColor="#eab308" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#eab308" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#090a0f', borderColor: '#334155', borderRadius: '12px' }}
                        itemStyle={{ color: '#eab308' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#eab308" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Recent Bookings Feed */}
            <div className="bg-[#0e1117] rounded-2xl border border-slate-800 p-5 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Recent Customer Transactions
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Booking ID</th>
                      <th className="py-2.5 px-3">Movie</th>
                      <th className="py-2.5 px-3">Seats</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {stats.recent_bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-mono font-bold text-orange-400">{b.booking_code}</td>
                        <td className="py-3 px-3 text-white font-medium">{b.show?.movie?.title}</td>
                        <td className="py-3 px-3 text-slate-300">{b.seats.map((s) => s.seat_label).join(', ')}</td>
                        <td className="py-3 px-3 font-mono font-bold text-white">₹{b.final_amount.toFixed(2)}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            b.status === 'CONFIRMED' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Manage Movies Table */}
        {activeTab === 'MOVIES' && (
          <div className="bg-[#0e1117] rounded-2xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Catalogue Inventory ({movies.length} Movies)
              </h3>
              <button
                onClick={handleOpenAddModal}
                className="px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold text-xs flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Movie</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Poster</th>
                    <th className="py-2.5 px-3">Title & Genre</th>
                    <th className="py-2.5 px-3">Rating</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {movies.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-800/40">
                      <td className="py-2 px-3">
                        <img
                          src={m.poster_url}
                          alt={m.title}
                          className="w-9 h-13 object-cover rounded-md border border-slate-800"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-white">{m.title}</div>
                        <div className="text-[11px] text-slate-400">{m.genre} • {m.language}</div>
                      </td>
                      <td className="py-2 px-3 font-bold text-amber-400">★ {m.rating}</td>
                      <td className="py-2 px-3 text-slate-300">{m.duration_minutes}m</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.is_now_showing ? 'bg-green-500/10 text-green-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {m.is_now_showing ? 'Now Showing' : 'Upcoming'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(m)}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteMovie(m.id, m.title)}
                          className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: All Customer Bookings */}
        {activeTab === 'BOOKINGS' && (
          <div className="bg-[#0e1117] rounded-2xl border border-slate-800 p-5 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              System Bookings Audit Trail ({bookings.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Booking ID</th>
                    <th className="py-2.5 px-3">Customer User ID</th>
                    <th className="py-2.5 px-3">Movie & Theatre</th>
                    <th className="py-2.5 px-3">Seats</th>
                    <th className="py-2.5 px-3">Final Amount</th>
                    <th className="py-2.5 px-3">Payment Method</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono font-bold text-orange-400">{b.booking_code}</td>
                      <td className="py-3 px-3 text-slate-400">User #{b.user_id}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{b.show?.movie?.title}</div>
                        <div className="text-[10px] text-slate-500">{b.show?.theatre?.name}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-300">{b.seats.map((s) => s.seat_label).join(', ')}</td>
                      <td className="py-3 px-3 font-mono font-bold text-white">₹{b.final_amount.toFixed(2)}</td>
                      <td className="py-3 px-3 text-slate-400">{b.payment?.payment_method || 'SIMULATED'}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          b.status === 'CONFIRMED' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* Add / Edit Movie Modal */}
      {showMovieModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0e1117] rounded-3xl p-6 sm:p-8 max-w-xl w-full border border-slate-800 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {editingMovie ? `Edit Movie: ${editingMovie.title}` : 'Add New Movie to Catalogue'}
              </h3>
              <button
                onClick={() => setShowMovieModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMovie} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Movie Title</label>
                <input
                  type="text"
                  required
                  value={movieForm.title}
                  onChange={(e) => setMovieForm({ ...movieForm, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Synopsis</label>
                <textarea
                  rows={3}
                  required
                  value={movieForm.description}
                  onChange={(e) => setMovieForm({ ...movieForm, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Genre</label>
                  <input
                    type="text"
                    required
                    value={movieForm.genre}
                    onChange={(e) => setMovieForm({ ...movieForm, genre: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Language</label>
                  <input
                    type="text"
                    required
                    value={movieForm.language}
                    onChange={(e) => setMovieForm({ ...movieForm, language: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Runtime (mins)</label>
                  <input
                    type="number"
                    required
                    value={movieForm.duration_minutes}
                    onChange={(e) => setMovieForm({ ...movieForm, duration_minutes: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">IMDb Rating</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={movieForm.rating}
                    onChange={(e) => setMovieForm({ ...movieForm, rating: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Certificate</label>
                  <select
                    value={movieForm.certificate}
                    onChange={(e) => setMovieForm({ ...movieForm, certificate: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="U">U</option>
                    <option value="UA">UA</option>
                    <option value="A">A</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Poster Image URL</label>
                <input
                  type="url"
                  required
                  value={movieForm.poster_url}
                  onChange={(e) => setMovieForm({ ...movieForm, poster_url: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Trailer YouTube Link</label>
                <input
                  type="url"
                  value={movieForm.trailer_url}
                  onChange={(e) => setMovieForm({ ...movieForm, trailer_url: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex items-center space-x-6 pt-2">
                <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={movieForm.is_now_showing}
                    onChange={(e) => setMovieForm({ ...movieForm, is_now_showing: e.target.checked })}
                    className="w-4 h-4 rounded text-orange-500"
                  />
                  <span>Now Showing</span>
                </label>
                <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={movieForm.is_popular}
                    onChange={(e) => setMovieForm({ ...movieForm, is_popular: e.target.checked })}
                    className="w-4 h-4 rounded text-orange-500"
                  />
                  <span>Popular / Highlighted</span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowMovieModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-black"
                >
                  {editingMovie ? 'Save Changes' : 'Create Movie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

