import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Movie, Theatre, Show, Seat, Booking } from '../types';
import { bookingsApi, couponsApi, showsApi } from '../services/api';

const SESSION_STORAGE_KEY = 'cinebook_active_booking_session';

export interface StoredBookingSession {
  movieId: number | null;
  theatreId: number | null;
  city: string;
  showId: number | null;
  seatIds: number[];
  appliedCoupon: { code: string; discountPercent: number; discountAmount: number } | null;
  currentBookingId: number | null;
  lockExpiresAt: string | null;
  updatedAt: string;
}

export const loadStoredSession = (): StoredBookingSession | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse stored booking session:', err);
    return null;
  }
};

export const persistSession = (data: Partial<StoredBookingSession>) => {
  try {
    const existing = loadStoredSession() || {
      movieId: null,
      theatreId: null,
      city: 'Mumbai',
      showId: null,
      seatIds: [],
      appliedCoupon: null,
      currentBookingId: null,
      lockExpiresAt: null,
      updatedAt: new Date().toISOString(),
    };
    const merged: StoredBookingSession = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.error('Failed to persist booking session:', err);
  }
};

export const removeStoredSession = () => {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear stored booking session:', err);
  }
};

interface BookingContextType {
  selectedMovie: Movie | null;
  setSelectedMovie: (movie: Movie | null) => void;
  selectedTheatre: Theatre | null;
  setSelectedTheatre: (theatre: Theatre | null) => void;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  selectedShow: Show | null;
  setSelectedShow: (show: Show | null) => void;
  selectedSeats: Seat[];
  toggleSeatSelection: (seat: Seat) => void;
  setSelectedSeats: (seats: Seat[]) => void;
  appliedCoupon: { code: string; discountPercent: number; discountAmount: number } | null;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => void;
  currentBooking: Booking | null;
  setCurrentBooking: (booking: Booking | null) => void;
  lockExpiresAt: string | null;
  remainingSeconds: number;
  isLockExpired: boolean;
  isRestoringSession: boolean;
  restoreBookingSession: () => Promise<{ success: boolean; reason?: string }>;
  lockSeats: (seatIds: number[]) => Promise<boolean>;
  unlockSeats: () => Promise<void>;
  resetBooking: () => void;
  totalSeatPrice: number;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export const BookingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read initial stored values synchronously to prevent initial render flicker
  const initialStored = loadStoredSession();

  const [selectedMovie, setSelectedMovieState] = useState<Movie | null>(null);
  const [selectedTheatre, setSelectedTheatreState] = useState<Theatre | null>(null);
  const [selectedCity, setSelectedCityState] = useState<string>(initialStored?.city || 'Mumbai');
  const [selectedShow, setSelectedShowState] = useState<Show | null>(null);
  const [selectedSeats, setSelectedSeatsState] = useState<Seat[]>([]);
  const [appliedCoupon, setAppliedCouponState] = useState<{
    code: string;
    discountPercent: number;
    discountAmount: number;
  } | null>(initialStored?.appliedCoupon || null);
  const [currentBooking, setCurrentBookingState] = useState<Booking | null>(null);
  const [lockExpiresAt, setLockExpiresAtState] = useState<string | null>(initialStored?.lockExpiresAt || null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isLockExpired, setIsLockExpired] = useState<boolean>(false);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(true);

  // Synchronized state setters that also update sessionStorage
  const setSelectedMovie = (movie: Movie | null) => {
    setSelectedMovieState(movie);
    persistSession({ movieId: movie?.id || null });
  };

  const setSelectedTheatre = (theatre: Theatre | null) => {
    setSelectedTheatreState(theatre);
    persistSession({ theatreId: theatre?.id || null });
  };

  const setSelectedCity = (city: string) => {
    setSelectedCityState(city);
    persistSession({ city });
  };

  const setSelectedShow = (show: Show | null) => {
    setSelectedShowState(show);
    persistSession({
      showId: show?.id || null,
      movieId: show?.movie_id || show?.movie?.id || null,
      theatreId: show?.theatre_id || show?.theatre?.id || null,
    });
    if (show?.movie) setSelectedMovieState(show.movie);
    if (show?.theatre) setSelectedTheatreState(show.theatre);
  };

  const setSelectedSeats = (seats: Seat[]) => {
    setSelectedSeatsState(seats);
    persistSession({ seatIds: seats.map((s) => s.id) });
  };

  const setCurrentBooking = (booking: Booking | null) => {
    setCurrentBookingState(booking);
    persistSession({ currentBookingId: booking?.id || null });
  };

  const setLockExpiresAt = (expiresAt: string | null) => {
    setLockExpiresAtState(expiresAt);
    setIsLockExpired(false);
    persistSession({ lockExpiresAt: expiresAt });
  };

  // Timer countdown for temporary seat lock (5 minutes)
  useEffect(() => {
    if (!lockExpiresAt) {
      setRemainingSeconds(0);
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const expires = new Date(lockExpiresAt).getTime();
      const diff = Math.max(0, Math.floor((expires - now) / 1000));
      setRemainingSeconds(diff);

      if (diff <= 0) {
        setIsLockExpired(true);
        setLockExpiresAtState(null);
        persistSession({ lockExpiresAt: null });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockExpiresAt]);

  const toggleSeatSelection = (seat: Seat) => {
    setSelectedSeatsState((prev) => {
      const exists = prev.find((s) => s.id === seat.id);
      let next: Seat[];
      if (exists) {
        next = prev.filter((s) => s.id !== seat.id);
      } else {
        if (prev.length >= 10) {
          alert('You can select a maximum of 10 seats per booking.');
          return prev;
        }
        next = [...prev, seat];
      }
      persistSession({ seatIds: next.map((s) => s.id) });
      return next;
    });
  };

  const totalSeatPrice = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  const lockSeats = async (seatIds: number[]): Promise<boolean> => {
    if (!selectedShow) return false;
    try {
      const res = await bookingsApi.holdSeats(selectedShow.id, seatIds);
      setLockExpiresAt(res.expires_at);
      persistSession({
        showId: selectedShow.id,
        seatIds,
        lockExpiresAt: res.expires_at,
      });
      return true;
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to lock selected seats. They may have been booked or held by another user.');
      return false;
    }
  };

  const unlockSeats = async () => {
    if (selectedShow && selectedSeats.length > 0) {
      try {
        await bookingsApi.releaseSeats(selectedShow.id, selectedSeats.map((s) => s.id));
      } catch (e) {
        console.error('Error releasing seats:', e);
      }
    }
    setLockExpiresAtState(null);
    persistSession({ lockExpiresAt: null });
  };

  const applyCoupon = async (code: string): Promise<boolean> => {
    try {
      const res = await couponsApi.validate(code, totalSeatPrice);
      if (res.valid) {
        const couponObj = {
          code: res.code,
          discountPercent: res.discount_percent,
          discountAmount: res.discount_amount,
        };
        setAppliedCouponState(couponObj);
        persistSession({ appliedCoupon: couponObj });
        return true;
      }
      return false;
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Invalid coupon code');
      return false;
    }
  };

  const removeCoupon = () => {
    setAppliedCouponState(null);
    persistSession({ appliedCoupon: null });
  };

  const resetBooking = () => {
    setSelectedSeatsState([]);
    setAppliedCouponState(null);
    setCurrentBookingState(null);
    setLockExpiresAtState(null);
    setRemainingSeconds(0);
    setIsLockExpired(false);
    removeStoredSession();
  };

  /**
   * Session Restoration Engine:
   * Restores booking session from sessionStorage, fetches fresh backend data,
   * validates seat locks, and handles authentication state changes seamlessly.
   */
  const restoreBookingSession = useCallback(async (): Promise<{ success: boolean; reason?: string }> => {
    const stored = loadStoredSession();
    if (!stored || !stored.showId || !stored.seatIds || stored.seatIds.length === 0) {
      setIsRestoringSession(false);
      return { success: false, reason: 'NO_SESSION' };
    }

    try {
      // 1. Fetch fresh show and seat data from backend
      const [showData, seatsData] = await Promise.all([
        showsApi.getById(stored.showId),
        showsApi.getSeats(stored.showId),
      ]);

      if (!showData) {
        setIsRestoringSession(false);
        return { success: false, reason: 'SHOW_NOT_FOUND' };
      }

      // 2. Identify and validate selected seats
      const matchingSeats = seatsData.filter((s) => stored.seatIds.includes(s.id));
      if (matchingSeats.length === 0) {
        setIsRestoringSession(false);
        return { success: false, reason: 'SEATS_NOT_FOUND' };
      }

      setSelectedShowState(showData);
      if (showData.movie) setSelectedMovieState(showData.movie);
      if (showData.theatre) setSelectedTheatreState(showData.theatre);
      setSelectedSeatsState(matchingSeats);

      if (stored.appliedCoupon) {
        setAppliedCouponState(stored.appliedCoupon);
      }

      // 3. Check authentication status
      const hasToken = !!localStorage.getItem('cinebook_token');

      if (hasToken) {
        // Authenticated user: Verify seat locks with backend
        try {
          const verify = await bookingsApi.verifyLock(stored.showId, stored.seatIds);

          if (verify.is_locked_by_user && verify.expires_at) {
            // Lock is active and valid!
            setLockExpiresAtState(verify.expires_at);
            setIsLockExpired(false);
            persistSession({ lockExpiresAt: verify.expires_at });
            setIsRestoringSession(false);
            return { success: true };
          } else {
            // User just logged in or lock was released. Check if seats are still available to re-lock!
            const allAvailable = matchingSeats.every(
              (s) => s.status === 'AVAILABLE' || s.status === 'SELECTED'
            );

            if (allAvailable) {
              try {
                const lockRes = await bookingsApi.holdSeats(stored.showId, stored.seatIds);
                setLockExpiresAtState(lockRes.expires_at);
                setIsLockExpired(false);
                persistSession({ lockExpiresAt: lockRes.expires_at });
                setIsRestoringSession(false);
                return { success: true };
              } catch (lockErr) {
                console.warn('Could not re-lock seats after login:', lockErr);
                setIsLockExpired(true);
                setIsRestoringSession(false);
                return { success: false, reason: 'LOCK_EXPIRED' };
              }
            } else {
              setIsLockExpired(true);
              setIsRestoringSession(false);
              return { success: false, reason: 'SEATS_TAKEN' };
            }
          }
        } catch (verifyErr) {
          console.error('Error verifying locks with backend:', verifyErr);
        }
      } else {
        // Unauthenticated customer: Preserve selected seats & show in state
        if (stored.lockExpiresAt) {
          const expiresTime = new Date(stored.lockExpiresAt).getTime();
          if (expiresTime > Date.now()) {
            setLockExpiresAtState(stored.lockExpiresAt);
            setIsLockExpired(false);
          } else {
            setIsLockExpired(true);
          }
        }
      }

      setIsRestoringSession(false);
      return { success: true };
    } catch (err: any) {
      console.error('Failed to restore booking session:', err);
      setIsRestoringSession(false);
      return { success: false, reason: err.message || 'RESTORE_ERROR' };
    }
  }, []);

  // Run restoration once on provider mount
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (!hasRestoredRef.current) {
      hasRestoredRef.current = true;
      restoreBookingSession();
    }
  }, [restoreBookingSession]);

  return (
    <BookingContext.Provider
      value={{
        selectedMovie,
        setSelectedMovie,
        selectedTheatre,
        setSelectedTheatre,
        selectedCity,
        setSelectedCity,
        selectedShow,
        setSelectedShow,
        selectedSeats,
        toggleSeatSelection,
        setSelectedSeats,
        appliedCoupon,
        applyCoupon,
        removeCoupon,
        currentBooking,
        setCurrentBooking,
        lockExpiresAt,
        remainingSeconds,
        isLockExpired,
        isRestoringSession,
        restoreBookingSession,
        lockSeats,
        unlockSeats,
        resetBooking,
        totalSeatPrice,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
};

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};
