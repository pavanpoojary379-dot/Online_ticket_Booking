import React, { createContext, useContext, useState, useEffect } from 'react';
import { Movie, Theatre, Show, Seat, Booking } from '../types';
import { bookingsApi, couponsApi } from '../services/api';

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
  lockSeats: (seatIds: number[]) => Promise<boolean>;
  unlockSeats: () => Promise<void>;
  resetBooking: () => void;
  totalSeatPrice: number;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export const BookingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [selectedTheatre, setSelectedTheatre] = useState<Theatre | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>('Mumbai');
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercent: number; discountAmount: number } | null>(null);
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
  const [lockExpiresAt, setLockExpiresAt] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

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
        // Lock expired!
        setLockExpiresAt(null);
        setSelectedSeats([]);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockExpiresAt]);

  const toggleSeatSelection = (seat: Seat) => {
    setSelectedSeats((prev) => {
      const exists = prev.find((s) => s.id === seat.id);
      if (exists) {
        return prev.filter((s) => s.id !== seat.id);
      } else {
        if (prev.length >= 8) {
          alert('You can select a maximum of 8 seats per booking.');
          return prev;
        }
        return [...prev, seat];
      }
    });
  };

  const totalSeatPrice = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  const lockSeats = async (seatIds: number[]): Promise<boolean> => {
    if (!selectedShow) return false;
    try {
      const res = await bookingsApi.holdSeats(selectedShow.id, seatIds);
      setLockExpiresAt(res.expires_at);
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
        console.error("Error releasing seats:", e);
      }
    }
    setLockExpiresAt(null);
  };

  const applyCoupon = async (code: string): Promise<boolean> => {
    try {
      const res = await couponsApi.validate(code, totalSeatPrice);
      if (res.valid) {
        setAppliedCoupon({
          code: res.code,
          discountPercent: res.discount_percent,
          discountAmount: res.discount_amount,
        });
        return true;
      }
      return false;
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Invalid coupon code');
      return false;
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  const resetBooking = () => {
    setSelectedSeats([]);
    setAppliedCoupon(null);
    setCurrentBooking(null);
    setLockExpiresAt(null);
    setRemainingSeconds(0);
  };

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

