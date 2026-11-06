import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Ticket,
  Calendar,
  Clock,
  MapPin,
  Download,
  QrCode,
  XCircle,
  AlertTriangle,
  X,
  ChevronRight,
  Compass
} from 'lucide-react';
import { bookingsApi } from '../services/api';
import { Booking } from '../types';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export const MyBookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'PAST' | 'CANCELLED'>('UPCOMING');
  const [selectedTicketModal, setSelectedTicketModal] = useState<Booking | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const fetchBookings = async () => {
    try {
      const data = await bookingsApi.getMyBookings();
      setBookings(data);
    } catch (err) {
      console.error('Failed to load user bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancelBooking = async (b: Booking) => {
    if (!window.confirm(`Are you sure you want to cancel booking ${b.booking_code}? A full simulated refund of ₹${b.final_amount.toFixed(2)} will be credited.`)) {
      return;
    }

    setCancellingId(b.id);
    try {
      const res = await bookingsApi.cancel(b.id);
      alert(res.message);
      fetchBookings();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to cancel booking');
    } finally {
      setCancellingId(null);
    }
  };

  const now = new Date();

  const upcomingBookings = bookings.filter((b) => {
    if (b.status === 'CANCELLED') return false;
    const showDt = b.show?.show_time ? new Date(b.show.show_time) : new Date();
    return showDt >= now;
  });

  const pastBookings = bookings.filter((b) => {
    if (b.status === 'CANCELLED') return false;
    const showDt = b.show?.show_time ? new Date(b.show.show_time) : new Date();
    return showDt < now;
  });

  const cancelledBookings = bookings.filter((b) => b.status === 'CANCELLED');

  const displayedBookings =
    activeTab === 'UPCOMING'
      ? upcomingBookings
      : activeTab === 'PAST'
      ? pastBookings
      : cancelledBookings;

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">
              My Tickets & Bookings
            </h1>
            <p className="text-xs text-slate-400">Manage all your cinema reservations and digital QR passes</p>
          </div>

          <Link
            to="/"
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold text-xs flex items-center space-x-1.5 w-fit"
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>Book New Tickets</span>
          </Link>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 bg-[#0e1117] p-1.5 rounded-xl border border-slate-800 w-fit">
          <button
            onClick={() => setActiveTab('UPCOMING')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'UPCOMING'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Upcoming Shows ({upcomingBookings.length})
          </button>

          <button
            onClick={() => setActiveTab('PAST')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'PAST'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Past Shows ({pastBookings.length})
          </button>

          <button
            onClick={() => setActiveTab('CANCELLED')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'CANCELLED'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Cancelled ({cancelledBookings.length})
          </button>
        </div>

        {/* Bookings List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-44 bg-slate-900 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : displayedBookings.length === 0 ? (
          <div className="bg-[#0e1117] rounded-3xl border border-slate-800 p-12 text-center space-y-3">
            <Ticket className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">No bookings found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You do not have any {activeTab.toLowerCase()} movie bookings.
            </p>
            <Link
              to="/"
              className="inline-block mt-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-orange-400 font-bold text-xs"
            >
              Explore Now Showing Movies
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedBookings.map((b) => {
              const showTime = new Date(b.show?.show_time || '');
              const timeFormatted = showTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });
              const dateFormatted = showTime.toLocaleDateString('en-US', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });

              const isCancelled = b.status === 'CANCELLED';

              return (
                <div
                  key={b.id}
                  className="bg-[#0e1117] rounded-2xl border border-slate-800 p-5 sm:p-6 flex flex-col md:flex-row gap-5 justify-between items-start md:items-center hover:border-slate-700 transition-colors"
                >
                  {/* Left: Poster & Details */}
                  <div className="flex gap-4 items-start">
                    {b.show?.movie?.poster_url && (
                      <img
                        src={b.show.movie.poster_url}
                        alt={b.show.movie.title}
                        className="w-16 h-24 object-cover rounded-xl border border-slate-800 shadow-md flex-shrink-0"
                      />
                    )}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                          {b.booking_code}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          isCancelled
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-green-500/10 text-green-400 border border-green-500/20'
                        }`}>
                          {b.status}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {b.show?.screen_format}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white">
                        {b.show?.movie?.title}
                      </h3>

                      <p className="text-xs text-slate-300">
                        {b.show?.theatre?.name}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                        <span className="flex items-center text-slate-300 font-medium">
                          <Calendar className="w-3.5 h-3.5 mr-1 text-slate-500" />
                          {dateFormatted}
                        </span>
                        <span>•</span>
                        <span className="flex items-center text-orange-400 font-mono font-bold">
                          <Clock className="w-3.5 h-3.5 mr-1" />
                          {timeFormatted}
                        </span>
                        <span>•</span>
                        <span>Seats: <b className="text-white">{b.seats?.map((s) => s.seat_label).join(', ')}</b></span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Price & Action Buttons */}
                  <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between w-full md:w-auto gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Paid</span>
                      <span className="text-lg font-black text-white font-mono">
                        ₹{b.final_amount.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!isCancelled && (
                        <>
                          <Link
                            to={`/navigation/${b.id}`}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/40 text-xs font-bold transition-all flex items-center space-x-1"
                          >
                            <Compass className="w-3.5 h-3.5" />
                            <span>Navigate to Seat</span>
                          </Link>

                          <button
                            onClick={() => setSelectedTicketModal(b)}
                            className="px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-slate-950 border border-orange-500/30 text-xs font-bold transition-all flex items-center space-x-1"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>View QR Pass</span>
                          </button>

                          <a
                            href={`/api/tickets/${b.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center space-x-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </a>

                          {activeTab === 'UPCOMING' && (
                            <button
                              disabled={cancellingId === b.id}
                              onClick={() => handleCancelBooking(b)}
                              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {cancellingId === b.id ? 'Cancelling...' : 'Cancel'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* View Digital QR Pass Modal */}
      {selectedTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0e1117] rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-slate-800 shadow-2xl relative space-y-4 text-center">
            <button
              onClick={() => setSelectedTicketModal(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>

            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">
              CineBook Digital Entry Pass
            </span>

            <h3 className="text-lg font-bold text-white">
              {selectedTicketModal.show?.movie?.title}
            </h3>

            <p className="text-xs text-slate-400">
              {selectedTicketModal.show?.theatre?.name}
            </p>

            <div className="p-3 bg-white rounded-2xl shadow-xl w-44 h-44 mx-auto flex items-center justify-center">
              {selectedTicketModal.qr_code_path ? (
                <img
                  src={selectedTicketModal.qr_code_path}
                  alt="QR Pass"
                  className="w-full h-full object-contain"
                />
              ) : (
                <QrCode className="w-24 h-24 text-slate-900" />
              )}
            </div>

            <div className="font-mono text-xs text-slate-300">
              ID: <b>{selectedTicketModal.booking_code}</b>
            </div>

            <div className="text-xs text-slate-400">
              Seats: <b className="text-white">{selectedTicketModal.seats?.map((s) => s.seat_label).join(', ')}</b>
            </div>

            <div className="space-y-2 pt-2">
              <Link
                to={`/navigation/${selectedTicketModal.id}`}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 text-slate-950 font-black text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-500/20"
              >
                <Compass className="w-4 h-4" />
                <span>Navigate to My Seat</span>
              </Link>

              <a
                href={`/api/tickets/${selectedTicketModal.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Download Official PDF Ticket</span>
              </a>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

