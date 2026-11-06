import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  CreditCard,
  Smartphone,
  Building2,
  Wallet,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Lock,
  ChevronLeft,
  Clock,
  ArrowRight,
  RotateCcw,
  Film
} from 'lucide-react';
import { bookingsApi, paymentsApi } from '../services/api';
import { Booking } from '../types';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useBooking } from '../context/BookingContext';

type PaymentMethodType = 'UPI' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'NET_BANKING' | 'WALLET';
type SimOutcome = 'SUCCESS' | 'FAILED' | 'CANCELLED';

export const PaymentPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('UPI');
  const [simOutcome, setSimOutcome] = useState<SimOutcome>('SUCCESS');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<string>('');

  // Payment result states
  const [paymentFailed, setPaymentFailed] = useState<{
    reason: string;
    transactionId?: string;
  } | null>(null);
  const [holdExpired, setHoldExpired] = useState<boolean>(false);

  // Form states (test dummy inputs)
  const [upiId, setUpiId] = useState<string>('hackathon@okhdfcbank');
  const [cardNumber, setCardNumber] = useState<string>('4111 •••• •••• 1111');
  const [cardExpiry, setCardExpiry] = useState<string>('12/28');
  const [cardCvv, setCardCvv] = useState<string>('777');
  const [selectedBank, setSelectedBank] = useState<string>('HDFC Bank');
  const [selectedWallet, setSelectedWallet] = useState<string>('Amazon Pay');

  const { resetBooking, remainingSeconds, isLockExpired } = useBooking();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBooking = async () => {
      if (!bookingId) return;
      try {
        const data = await bookingsApi.getById(Number(bookingId));
        setBooking(data);
        if (data.status === 'CONFIRMED') {
          navigate(`/booking/confirmation/${data.id}`, { replace: true });
        }
      } catch (err) {
        console.error('Failed to load booking:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBooking();
  }, [bookingId, navigate]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handlePayNow = async () => {
    if (!booking) return;

    if (isLockExpired || holdExpired || remainingSeconds <= 0) {
      setHoldExpired(true);
      return;
    }

    setIsProcessing(true);
    setProcessingStep('Connecting to simulated payment gateway...');

    // Multi-step realistic animation
    setTimeout(() => {
      setProcessingStep('Verifying test transaction and seat reservations...');
    }, 900);

    setTimeout(async () => {
      try {
        const res = await paymentsApi.process({
          booking_id: booking.id,
          payment_method: paymentMethod,
          simulate_status: simOutcome,
          failure_reason:
            simOutcome === 'FAILED'
              ? 'Card declined by issuing bank (Simulated Test Scenario)'
              : simOutcome === 'CANCELLED'
              ? 'Transaction cancelled by customer (Simulated Test Scenario)'
              : undefined,
        });

        setIsProcessing(false);

        if (res.success && (res.status === 'SUCCESS' || res.status === 'CONFIRMED')) {
          resetBooking();
          navigate(`/booking/confirmation/${booking.id}`);
        } else {
          setPaymentFailed({
            reason: res.message || 'Payment simulation failed. Your tickets have not been booked and seats have been released.',
            transactionId: res.transaction_id,
          });
        }
      } catch (err: any) {
        setIsProcessing(false);
        if (err.response?.status === 408) {
          setHoldExpired(true);
        } else {
          setPaymentFailed({
            reason: err.response?.data?.detail || 'Payment processing error. Your tickets have not been booked.',
          });
        }
      }
    }, 1800);
  };

  if (loading || !booking) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 1. Seat Hold Expired view
  if (holdExpired || isLockExpired || remainingSeconds <= 0) {
    return (
      <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col">
        <Navbar />
        <main className="max-w-lg mx-auto px-4 py-16 flex-1 flex flex-col justify-center items-center text-center">
          <div className="bg-[#0e1117] border border-orange-500/30 rounded-3xl p-8 space-y-5 shadow-2xl w-full">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mx-auto text-orange-400">
              <Clock className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-orange-400">Reservation Timed Out</span>
              <h2 className="text-2xl font-black text-white font-['Outfit']">Seat Hold Expired</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cinema seats are held temporarily for 5 minutes during checkout to guarantee fair access for all moviegoers. Your reservation window has ended, and the selected seats are no longer reserved.
              </p>
            </div>
            <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-400 text-left space-y-1">
              <div>Movie: <span className="text-white font-semibold">{booking.show?.movie?.title}</span></div>
              <div>Seats: <span className="text-white font-semibold">{booking.seats?.map((s) => s.seat_label).join(', ')}</span></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => navigate(`/booking/seats/${booking.show_id}`)}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-slate-950 font-bold text-xs shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center space-x-1.5"
              >
                <span>Re-select Seats</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <Link
                to="/"
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors"
              >
                Browse Movies
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 2. Booking Failed view
  if (paymentFailed) {
    return (
      <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col">
        <Navbar />
        <main className="max-w-lg mx-auto px-4 py-16 flex-1 flex flex-col justify-center items-center text-center">
          <div className="bg-[#0e1117] border border-red-500/30 rounded-3xl p-8 space-y-5 shadow-2xl w-full">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <XCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-red-400">Transaction Not Completed</span>
              <h2 className="text-2xl font-black text-white font-['Outfit']">Booking Failed</h2>
              <p className="text-xs text-red-300 font-semibold">
                Your tickets have not been booked.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {paymentFailed.reason}
              </p>
            </div>
            <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-400 text-left space-y-1 font-mono">
              <div>Booking Code: <span className="text-white font-semibold">{booking.booking_code}</span></div>
              {paymentFailed.transactionId && <div>Txn Ref: <span className="text-orange-400">{paymentFailed.transactionId}</span></div>}
              <div>Attempted Amount: <span className="text-white">₹{booking.final_amount.toFixed(2)}</span></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  setPaymentFailed(null);
                  setSimOutcome('SUCCESS');
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-slate-950 font-bold text-xs shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center space-x-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try Payment Again</span>
              </button>
              <button
                onClick={() => navigate(`/booking/seats/${booking.show_id}`)}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors"
              >
                Re-select Seats
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-800">
          <Link
            to="/booking/summary"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white font-['Outfit']">
              Simulated Payment Gateway
            </h1>
            <p className="text-xs text-slate-400">Complete your movie ticket purchase</p>
          </div>
        </div>

        {/* Seat Hold Active Countdown Banner */}
        <div className="rounded-2xl bg-orange-500/10 border border-orange-500/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2.5 text-orange-400 font-semibold">
            <Clock className="w-4 h-4 animate-pulse text-orange-400 flex-shrink-0" />
            <span>5-Minute Seat Reservation Hold Active — Complete payment before timer expires</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Time Remaining:</span>
            <span className="font-mono font-bold text-orange-300 text-sm bg-orange-500/20 px-2.5 py-1 rounded-lg border border-orange-500/40">
              {formatTimer(remainingSeconds)}
            </span>
          </div>
        </div>

        {/* Sandbox Notice Banner */}
        <div className="rounded-2xl bg-amber-950/20 border border-amber-500/40 p-4 flex items-start space-x-3 text-xs text-amber-300">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-200">Hackathon Test Mode Active</span>
            <p className="text-slate-400 leading-relaxed">
              This is a custom simulated checkout. No real financial cards, CVVs, or UPI PINs are processed.
              Choose below whether to simulate a <b>Successful Payment</b>, a <b>Declined Payment</b>, or <b>Cancelled Payment</b> to test system reliability.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Column: Payment Methods */}
          <div className="md:col-span-2 space-y-5">
            
            <div className="bg-[#0e1117] rounded-2xl border border-slate-800 p-5 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Select Payment Method
              </h3>

              {/* Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: 'UPI', label: 'UPI / QR', icon: Smartphone },
                  { id: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCard },
                  { id: 'DEBIT_CARD', label: 'Debit Card', icon: CreditCard },
                  { id: 'NET_BANKING', label: 'Net Banking', icon: Building2 },
                  { id: 'WALLET', label: 'Wallets', icon: Wallet },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setPaymentMethod(id as PaymentMethodType)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 transition-all ${
                      paymentMethod === id
                        ? 'bg-orange-500/10 border-orange-500 text-orange-400 shadow-md font-bold'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] text-center leading-tight">{label}</span>
                  </button>
                ))}
              </div>

              {/* Method-Specific Simulated Input Forms */}
              <div className="pt-4 border-t border-slate-800/80">
                {paymentMethod === 'UPI' && (
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Simulated Virtual Payment Address (VPA)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="yourname@okhdfcbank"
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-slate-400">
                      <span>Quick Test Apps:</span>
                      {['Google Pay', 'PhonePe', 'Paytm', 'BHIM UPI'].map((app) => (
                        <button
                          key={app}
                          onClick={() => setUpiId(`${app.toLowerCase().replace(' ', '')}@okaxis`)}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-orange-400"
                        >
                          {app}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT_CARD') && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Card Number (Test Simulation)
                      </label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">Valid Thru</label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">CVV</label>
                        <input
                          type="password"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === 'NET_BANKING' && (
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-300 block">Select Bank</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra', 'Punjab National'].map((bank) => (
                        <button
                          key={bank}
                          onClick={() => setSelectedBank(bank)}
                          className={`p-2.5 rounded-xl border text-xs font-medium transition-all text-left ${
                            selectedBank === bank
                              ? 'bg-orange-500/10 border-orange-500 text-orange-400 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {bank}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {paymentMethod === 'WALLET' && (
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-300 block">Select Digital Wallet</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Amazon Pay', 'Paytm Wallet', 'MobiKwik'].map((wallet) => (
                        <button
                          key={wallet}
                          onClick={() => setSelectedWallet(wallet)}
                          className={`p-2.5 rounded-xl border text-xs font-medium transition-all text-center ${
                            selectedWallet === wallet
                              ? 'bg-orange-500/10 border-orange-500 text-orange-400 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {wallet}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Simulated Outcome Controls for Testing */}
            <div className="bg-[#0e1117] rounded-2xl border border-slate-800 p-5 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                <span>Hackathon Evaluation Controls</span>
                <span className="text-[10px] text-orange-400 lowercase font-mono">simulate backend response</span>
              </h3>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSimOutcome('SUCCESS')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                    simOutcome === 'SUCCESS'
                      ? 'bg-green-500/20 border-green-500 text-green-400 ring-1 ring-green-500'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Success (200)</span>
                </button>

                <button
                  onClick={() => setSimOutcome('FAILED')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                    simOutcome === 'FAILED'
                      ? 'bg-red-500/20 border-red-500 text-red-400 ring-1 ring-red-500'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Simulate Failure</span>
                </button>

                <button
                  onClick={() => setSimOutcome('CANCELLED')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                    simOutcome === 'CANCELLED'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-400 ring-1 ring-amber-500'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Cancel Flow</span>
                </button>
              </div>
            </div>

          </div>

          {/* Right Column: Order Summary & Pay Action */}
          <div className="space-y-4">
            <div className="bg-[#0e1117] rounded-2xl border border-slate-800 p-5 space-y-4 shadow-xl">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider pb-2 border-b border-slate-800">
                Order Summary
              </h3>

              <div className="space-y-2 text-xs">
                <div className="text-white font-bold text-sm">
                  {booking.show?.movie?.title}
                </div>
                <div className="text-slate-400">
                  {booking.show?.theatre?.name}
                </div>
                <div className="text-slate-400">
                  Seats: <span className="text-white font-semibold">{booking.seats?.map((s) => s.seat_label).join(', ')}</span>
                </div>

                <div className="pt-3 border-t border-slate-800 space-y-1.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal</span>
                    <span className="font-mono">₹{booking.total_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Convenience Fee</span>
                    <span className="font-mono">₹{booking.convenience_fee.toFixed(2)}</span>
                  </div>
                  {booking.discount_amount > 0 && (
                    <div className="flex justify-between text-green-400 font-semibold">
                      <span>Discount ({booking.coupon_code})</span>
                      <span className="font-mono">-₹{booking.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm">
                    <span className="font-bold text-white">Payable</span>
                    <span className="text-xl font-black text-orange-400 font-mono">
                      ₹{booking.final_amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pay Button */}
              <button
                disabled={isProcessing}
                onClick={handlePayNow}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-slate-950 font-black text-sm shadow-xl shadow-orange-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>Simulate Pay ₹{booking.final_amount.toFixed(2)}</span>
              </button>

              <div className="flex items-center justify-center space-x-1.5 text-[10px] text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                <span>End-to-End Test Protected</span>
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* Payment Processing Modal */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0e1117] rounded-3xl p-8 max-w-sm w-full border border-slate-800 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mx-auto text-orange-400">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h3 className="text-base font-bold text-white">Processing Simulated Payment</h3>
            <p className="text-xs text-slate-400 font-mono animate-pulse">
              {processingStep}
            </p>
            <div className="text-[11px] text-slate-500 pt-2">
              Please do not refresh or close this browser window.
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

