import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle2,
  Download,
  Ticket,
  Calendar,
  Clock,
  MapPin,
  QrCode,
  Share2,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { bookingsApi } from '../services/api';
import { Booking } from '../types';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export const ConfirmationPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchBooking = async () => {
      if (!bookingId) return;
      try {
        const data = await bookingsApi.getById(Number(bookingId));
        setBooking(data);
      } catch (err) {
        console.error('Error fetching booking confirmation:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBooking();
  }, [bookingId]);

  if (loading || !booking) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const showTime = new Date(booking.show?.show_time || '');
  const timeFormatted = showTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const dateFormatted = showTime.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const downloadPdfUrl = `/api/tickets/${booking.id}/download`;

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full space-y-8">
        
        {/* Success Header Animation */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/40 flex items-center justify-center mx-auto text-green-400 shadow-xl shadow-green-500/10">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-green-400">
            Booking Confirmed!
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-white font-['Outfit']">
            Enjoy Your Movie, Cinema Lover!
          </h1>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Your e-ticket and entrance pass have been issued. Present this digital pass or downloaded PDF at the theatre gate.
          </p>
        </div>

        {/* Digital Ticket Card */}
        <div className="bg-[#0e1117] rounded-3xl border border-slate-800 overflow-hidden shadow-2xl relative">
          
          {/* Top Ticket Header Banner */}
          <div className="bg-gradient-to-r from-orange-600 to-amber-600 p-4 sm:p-5 flex items-center justify-between text-slate-950 font-bold">
            <div className="flex items-center space-x-2">
              <Ticket className="w-5 h-5" />
              <span className="font-['Outfit'] text-lg font-black tracking-tight">CINEBOOK PASS</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider block opacity-80">Booking Reference</span>
              <span className="font-mono text-base font-black">{booking.booking_code}</span>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            
            {/* Movie & Theatre Overview */}
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {booking.show?.movie?.poster_url && (
                <img
                  src={booking.show.movie.poster_url}
                  alt={booking.show.movie.title}
                  className="w-24 h-36 object-cover rounded-2xl border border-slate-700 shadow-lg flex-shrink-0"
                />
              )}
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/30">
                    {booking.show?.screen_format}
                  </span>
                  <span className="text-xs text-slate-400">
                    {booking.show?.movie?.language} • {booking.show?.movie?.certificate}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  {booking.show?.movie?.title}
                </h3>
                <div className="text-xs text-orange-400 font-semibold flex items-center">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  <span>{booking.show?.theatre?.name}</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {booking.show?.theatre?.address}, {booking.show?.theatre?.city}
                </p>
              </div>
            </div>

            {/* Ticket Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Date</span>
                <span className="font-semibold text-white">{dateFormatted}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Time</span>
                <span className="font-bold text-orange-400 font-mono">{timeFormatted}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Seats ({booking.seats?.length})</span>
                <span className="font-bold text-white">
                  {booking.seats?.map((s) => s.seat_label).join(', ')}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Paid</span>
                <span className="font-bold text-green-400 font-mono">₹{booking.final_amount.toFixed(2)}</span>
              </div>
            </div>

            {/* QR Code Entry Pass Block */}
            <div className="pt-4 border-t border-dashed border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-1.5 text-center sm:text-left">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-center sm:justify-start">
                  <QrCode className="w-4 h-4 mr-1.5 text-orange-400" />
                  Official Gate Entry QR Code
                </span>
                <p className="text-[11px] text-slate-400 max-w-sm">
                  Show this QR code to the usher at the auditorium door. Generated dynamically with unique hash.
                </p>
                <div className="text-[10px] text-slate-500 font-mono">
                  Txn ID: {booking.payment?.transaction_id || 'TXN-CONFIRMED'}
                </div>
              </div>

              {booking.qr_code_path ? (
                <div className="p-3 bg-white rounded-2xl shadow-xl flex-shrink-0">
                  <img
                    src={booking.qr_code_path}
                    alt="Ticket QR Code"
                    className="w-32 h-32 object-contain"
                  />
                </div>
              ) : (
                <div className="w-32 h-32 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-center text-slate-500 text-xs">
                  QR Generated
                </div>
              )}
            </div>

          </div>

          {/* Ticket Perforated Cut-Out Circles */}
          <div className="absolute left-0 bottom-36 -translate-x-1/2 w-6 h-6 rounded-full bg-[#090a0f] border-r border-slate-800 hidden sm:block"></div>
          <div className="absolute right-0 bottom-36 translate-x-1/2 w-6 h-6 rounded-full bg-[#090a0f] border-l border-slate-800 hidden sm:block"></div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
          <a
            href={downloadPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-orange-500/20 transition-all flex items-center justify-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Download Ticket PDF</span>
          </a>

          <Link
            to="/my-bookings"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-xs sm:text-sm border border-slate-800 transition-colors flex items-center justify-center space-x-2"
          >
            <Ticket className="w-4 h-4 text-orange-400" />
            <span>View All My Bookings</span>
          </Link>

          <Link
            to="/"
            className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-transparent hover:bg-slate-900 text-slate-400 hover:text-white font-semibold text-xs transition-colors flex items-center justify-center space-x-1"
          >
            <span>Book Another Movie</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

      </main>

      <Footer />
    </div>
  );
};

