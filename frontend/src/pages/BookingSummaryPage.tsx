import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Tag, Check, X, Shield, ArrowRight, ChevronLeft, Clock, Info, Film } from 'lucide-react';
import { useBooking } from '../context/BookingContext';
import { bookingsApi, couponsApi } from '../services/api';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export const BookingSummaryPage: React.FC = () => {
  const {
    selectedShow,
    selectedSeats,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    setCurrentBooking,
    remainingSeconds,
    isLockExpired,
    isRestoringSession,
    restoreBookingSession,
    totalSeatPrice,
  } = useBooking();

  const [couponInput, setCouponInput] = useState<string>('');
  const [couponLoading, setCouponLoading] = useState<boolean>(false);
  const [bookingLoading, setBookingLoading] = useState<boolean>(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const navigate = useNavigate();

  // If page was loaded directly or refreshed, trigger restoration if not already populated
  useEffect(() => {
    if (!selectedShow || selectedSeats.length === 0) {
      restoreBookingSession();
    }
  }, [restoreBookingSession]);

  if (isRestoringSession) {
    return (
      <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-lg font-bold text-white font-['Outfit']">Restoring Your Booking Session</h2>
        <p className="text-xs text-slate-400 mt-1">Verifying seat reservations with cinema server...</p>
      </div>
    );
  }

  if (isLockExpired) {
    return (
      <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0e1117] border border-orange-500/30 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mx-auto text-orange-400">
            <Clock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-white font-['Outfit']">Seat Hold Expired</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Cinema seats are held temporarily for 5 minutes during checkout to ensure fair availability. Your hold has expired. Please re-select your seats to continue your reservation.
          </p>
          <button
            onClick={() => navigate(selectedShow ? `/booking/seats/${selectedShow.id}` : '/')}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-slate-950 font-bold text-xs shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center space-x-2"
          >
            <span>Re-select Seats</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!selectedShow || selectedSeats.length === 0) {
    return (
      <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0e1117] border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-400">
            <Film className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-white font-['Outfit']">No Active Booking Session</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Please select a movie and seats to continue with your cinema ticket reservation.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center py-3 px-6 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-slate-950 font-bold text-xs shadow-lg shadow-orange-500/20 transition-all"
          >
            Browse Movies
          </Link>
        </div>
      </div>
    );
  }

  const convenienceFee = 30.0 * selectedSeats.length;
  const discountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const finalPayable = Math.max(0, totalSeatPrice + convenienceFee - discountAmount);

  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply || couponInput).trim();
    if (!code) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const success = await applyCoupon(code);
      if (success) {
        setCouponInput('');
      }
    } catch (e: any) {
      setCouponError(e.message || 'Failed to apply coupon');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (isLockExpired || remainingSeconds <= 0) {
      alert('Your seat hold has expired. Please re-select your seats.');
      if (selectedShow) navigate(`/booking/seats/${selectedShow.id}`);
      return;
    }
    setBookingLoading(true);
    try {
      const pendingBooking = await bookingsApi.createPending(
        selectedShow.id,
        selectedSeats.map((s) => s.id),
        appliedCoupon?.code
      );
      setCurrentBooking(pendingBooking);
      navigate(`/booking/payment/${pendingBooking.id}`);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Could not initiate booking. Seat lock may have expired.');
      navigate(`/booking/seats/${selectedShow.id}`);
    } finally {
      setBookingLoading(false);
    }
  };

  const showTime = new Date(selectedShow.show_time);
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

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <Link
              to={`/booking/seats/${selectedShow.id}`}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white font-['Outfit']">
                Booking Summary & Review
              </h1>
              <p className="text-xs text-slate-400">Review your ticket details before payment</p>
            </div>
          </div>

          {remainingSeconds > 0 && (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-400 text-xs font-bold">
              <Clock className="w-4 h-4" />
              <span>Seat Lock: {formatTimer(remainingSeconds)}</span>
            </div>
          )}
        </div>

        {/* Order Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Column: Movie & Theatre Details */}
          <div className="md:col-span-2 space-y-5">
            
            {/* Show Card */}
            <div className="bg-[#0e1117] rounded-2xl border border-slate-800 p-5 space-y-4">
              <div className="flex gap-4">
                {selectedShow.movie?.poster_url && (
                  <img
                    src={selectedShow.movie.poster_url}
                    alt={selectedShow.movie.title}
                    className="w-20 h-28 object-cover rounded-xl border border-slate-700/80 shadow-md"
                  />
                )}
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30">
                      {selectedShow.screen_format}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">
                      {selectedShow.movie?.language} • {selectedShow.movie?.certificate}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    {selectedShow.movie?.title}
                  </h3>
                  <p className="text-xs text-orange-400 font-medium">
                    {selectedShow.theatre?.name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {selectedShow.theatre?.address}, {selectedShow.theatre?.city}
                  </p>
                </div>
              </div>

              {/* Show Timing & Seats */}
              <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 uppercase text-[10px] font-bold block">Date & Time</span>
                  <span className="font-semibold text-slate-200">{dateFormatted}</span>
                  <div className="text-orange-400 font-bold font-mono">{timeFormatted}</div>
                </div>
                <div>
                  <span className="text-slate-500 uppercase text-[10px] font-bold block">Seats ({selectedSeats.length})</span>
                  <span className="font-bold text-white text-sm">
                    {selectedSeats.map((s) => `${s.row_label}${s.seat_number}`).join(', ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Coupons & Promo Codes */}
            <div className="bg-[#0e1117] rounded-2xl border border-slate-800 p-5 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center">
                <Tag className="w-3.5 h-3.5 mr-1.5 text-orange-400" />
                Apply Coupon Code
              </h3>

              {appliedCoupon ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs">
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-green-400" />
                    <span>
                      <b>{appliedCoupon.code}</b> applied! ({appliedCoupon.discountPercent}% off)
                    </span>
                  </div>
                  <button
                    onClick={removeCoupon}
                    className="p-1 hover:bg-green-500/20 rounded-md text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter coupon code (e.g. CINE20)"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 uppercase font-mono"
                  />
                  <button
                    disabled={couponLoading || !couponInput.trim()}
                    onClick={() => handleApplyCoupon()}
                    className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50"
                  >
                    {couponLoading ? 'Checking...' : 'Apply'}
                  </button>
                </div>
              )}

              {couponError && (
                <p className="text-[11px] text-red-400">{couponError}</p>
              )}

              {/* Sample Coupons Chips */}
              <div className="pt-2">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1.5">
                  Available Offers for You:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { code: 'CINE20', desc: '20% Off' },
                    { code: 'FIRST10', desc: '10% Off' },
                    { code: 'STUDENT15', desc: '15% Off' },
                  ].map((c) => (
                    <button
                      key={c.code}
                      onClick={() => handleApplyCoupon(c.code)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-orange-400 flex items-center space-x-1"
                    >
                      <span>{c.code}</span>
                      <span className="text-slate-500 font-sans">({c.desc})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Price Breakdown & Proceed */}
          <div className="space-y-4">
            
            <div className="bg-[#0e1117] rounded-2xl border border-slate-800 p-5 space-y-4 shadow-xl">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider pb-2 border-b border-slate-800">
                Payment Breakdown
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Tickets Subtotal ({selectedSeats.length} seats)</span>
                  <span className="font-mono">₹{totalSeatPrice.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-slate-400">
                  <span className="flex items-center">
                    Convenience Fee (₹30/seat)
                    <Info className="w-3 h-3 ml-1 text-slate-600" />
                  </span>
                  <span className="font-mono">₹{convenienceFee.toFixed(2)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-400 font-semibold">
                    <span>Coupon Discount</span>
                    <span className="font-mono">-₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-sm">
                  <span className="font-bold text-white">Total Amount</span>
                  <span className="text-xl font-black text-orange-400 font-mono">
                    ₹{finalPayable.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Proceed Button */}
              <button
                disabled={bookingLoading}
                onClick={handleProceedToPayment}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-orange-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <span>{bookingLoading ? 'Securing Seats...' : `Pay ₹${finalPayable.toFixed(2)}`}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center space-x-1.5 text-[10px] text-slate-500 text-center">
                <Shield className="w-3 h-3 text-green-400" />
                <span>Simulated Sandbox • 100% Secure Checkout</span>
              </div>
            </div>

            {/* Cancellation Terms */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 text-[11px] text-slate-500 space-y-1">
              <span className="font-semibold text-slate-400 block">Cancellation Policy</span>
              <p>Tickets can be cancelled up to 2 hours before showtime for an instant simulated refund.</p>
            </div>

          </div>

        </div>

      </main>

      <Footer />
    </div>
  );
};

