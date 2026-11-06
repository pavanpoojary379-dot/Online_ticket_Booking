import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Clock, ShieldAlert, ArrowRight, ChevronLeft, Film, MapPin } from 'lucide-react';
import { Show, Seat } from '../types';
import { showsApi } from '../services/api';
import { SeatGrid } from '../components/SeatGrid';
import { SmartSeatRecommendation } from '../components/SmartSeatRecommendation';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useBooking } from '../context/BookingContext';
import { useAuth } from '../context/AuthContext';

export const SeatSelectionPage: React.FC = () => {
  const { showId } = useParams<{ showId: string }>();
  const [show, setShow] = useState<Show | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [locking, setLocking] = useState<boolean>(false);
  const [recommendedSeatIds, setRecommendedSeatIds] = useState<number[]>([]);
  const [activeRecommendationRank, setActiveRecommendationRank] = useState<number | null>(null);

  const {
    selectedSeats,
    toggleSeatSelection,
    setSelectedSeats,
    lockSeats,
    remainingSeconds,
    setSelectedShow,
    totalSeatPrice,
  } = useBooking();

  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const fetchSeats = async () => {
    if (!showId) return;
    try {
      const [showData, seatsData] = await Promise.all([
        showsApi.getById(Number(showId)),
        showsApi.getSeats(Number(showId)),
      ]);
      setShow(showData);
      setSelectedShow(showData);
      setSeats(seatsData);
    } catch (err) {
      console.error('Error fetching seats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeats();
    // Refresh seat availability every 15 seconds to sync other customers' actions
    const poll = setInterval(fetchSeats, 15000);
    return () => clearInterval(poll);
  }, [showId]);

  const handleSmartSelect = (recommendedSeats: Seat[], rank?: number) => {
    setSelectedSeats(recommendedSeats);
    setRecommendedSeatIds(recommendedSeats.map((s) => s.id));
    setActiveRecommendationRank(rank || 1);
  };

  const handleHighlightSeats = (seatIds: number[]) => {
    setRecommendedSeatIds(seatIds);
  };

  const handleProceedToSummary = async () => {
    if (selectedSeats.length === 0) {
      alert('Please select at least 1 seat to proceed.');
      return;
    }

    if (!isAuthenticated) {
      // Prompt user to sign in, preserving booking context
      navigate('/login?redirect=booking-summary');
      return;
    }

    setLocking(true);
    const success = await lockSeats(selectedSeats.map((s) => s.id));
    setLocking(false);

    if (success) {
      navigate('/booking/summary');
    } else {
      // Re-fetch seats if locking failed
      fetchSeats();
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading || !show) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const showTime = new Date(show.show_time);
  const timeFormatted = showTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const dateFormatted = showTime.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col pb-28">
      <Navbar />

      {/* Show Header */}
      <div className="bg-[#0e1117] border-b border-slate-800/80 py-4 sticky top-20 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          <div className="flex items-center space-x-3">
            <Link
              to={show.movie ? `/movie/${show.movie.id}/showtimes` : '/'}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center">
                {show.movie?.title}
                <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30">
                  {show.screen_format}
                </span>
              </h2>
              <div className="text-xs text-slate-400 flex items-center space-x-2 mt-0.5">
                <span className="text-slate-300 font-semibold">{show.theatre?.name}</span>
                <span>•</span>
                <span>{dateFormatted}, {timeFormatted}</span>
              </div>
            </div>
          </div>

          {/* Seat Locking Countdown Banner (if seats locked) */}
          {remainingSeconds > 0 && (
            <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-400 text-xs font-bold animate-pulse">
              <Clock className="w-4 h-4" />
              <span>Temporary Lock Active: {formatTimer(remainingSeconds)} remaining</span>
            </div>
          )}

        </div>
      </div>

      {/* Main Seat Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full flex flex-col items-center">
        
        {/* Smart Seat Advisor Widget */}
        <SmartSeatRecommendation
          showId={show.id}
          onApplyRecommendation={handleSmartSelect}
          onHighlightSeats={handleHighlightSeats}
          selectedSeats={selectedSeats}
        />

        {/* Interactive Cinema Seat Grid */}
        <SeatGrid
          seats={seats}
          selectedSeats={selectedSeats}
          onToggleSeat={(seat) => {
            toggleSeatSelection(seat);
            // If user manually toggles, reset active recommendation highlight rank
            setActiveRecommendationRank(null);
          }}
          silverPrice={show.silver_price}
          goldPrice={show.gold_price}
          platinumPrice={show.platinum_price}
          recommendedSeatIds={recommendedSeatIds}
          activeRecommendationRank={activeRecommendationRank}
        />

      </main>

      {/* Floating Bottom Checkout Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-[#0e1117]/95 backdrop-blur-md border-t border-slate-800 z-40 py-3.5 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          
          {/* Selected Seat Labels & Price summary */}
          <div className="flex items-center space-x-4">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                Selected Seats ({selectedSeats.length})
              </span>
              <div className="text-sm font-bold text-white max-w-[200px] sm:max-w-md truncate">
                {selectedSeats.length > 0 ? (
                  selectedSeats.map((s) => `${s.row_label}${s.seat_number}`).join(', ')
                ) : (
                  <span className="text-slate-500 font-normal italic">Tap seats on the map above</span>
                )}
              </div>
            </div>

            {selectedSeats.length > 0 && (
              <div className="hidden sm:block border-l border-slate-800 pl-4">
                <span className="text-[11px] uppercase font-bold text-slate-400">Total Price</span>
                <div className="text-lg font-black text-orange-400 font-mono">
                  ₹{totalSeatPrice.toFixed(0)}
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="flex items-center space-x-3">
            {selectedSeats.length > 0 && (
              <div className="sm:hidden text-right mr-2">
                <span className="text-[10px] text-slate-400">Total:</span>
                <div className="text-base font-black text-orange-400 font-mono">
                  ₹{totalSeatPrice.toFixed(0)}
                </div>
              </div>
            )}

            <button
              disabled={selectedSeats.length === 0 || locking}
              onClick={handleProceedToSummary}
              className={`px-6 py-3 rounded-xl font-black text-xs sm:text-sm shadow-xl transition-all flex items-center space-x-2 ${
                selectedSeats.length === 0 || locking
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-slate-950 shadow-orange-500/20 transform hover:-translate-y-0.5'
              }`}
            >
              <span>{locking ? 'Locking Seats...' : 'Proceed to Checkout'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};

