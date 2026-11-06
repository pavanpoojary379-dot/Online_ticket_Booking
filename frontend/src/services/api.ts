import axios from 'axios';
import {
  User,
  Movie,
  Theatre,
  Show,
  Seat,
  Booking,
  Payment,
  Coupon,
  AdminStats,
  SeatRecommendationsResponse,
  ShowPreferencesResponse,
  SeatRecommendationRequestParams
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cinebook_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authApi = {
  register: async (data: { email: string; password: string; full_name: string; phone?: string }) => {
    const res = await api.post<{ access_token: string; token_type: string; user: User }>('/auth/register', data);
    return res.data;
  },
  login: async (data: { email: string; password: string }) => {
    const res = await api.post<{ access_token: string; token_type: string; user: User }>('/auth/login', data);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get<User>('/auth/me');
    return res.data;
  },
};

// Movies API
export const moviesApi = {
  getAll: async (params?: {
    search?: string;
    genre?: string;
    language?: string;
    is_now_showing?: boolean;
    is_upcoming?: boolean;
    is_popular?: boolean;
  }) => {
    const res = await api.get<Movie[]>('/movies', { params });
    return res.data;
  },
  getById: async (id: number) => {
    const res = await api.get<Movie>(`/movies/${id}`);
    return res.data;
  },
  create: async (data: Partial<Movie>) => {
    const res = await api.post<Movie>('/movies', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Movie>) => {
    const res = await api.put<Movie>(`/movies/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    const res = await api.delete(`/movies/${id}`);
    return res.data;
  },
};

// Theatres API
export const theatresApi = {
  getAll: async (city?: string) => {
    const res = await api.get<Theatre[]>('/theatres', { params: { city } });
    return res.data;
  },
  getById: async (id: number) => {
    const res = await api.get<Theatre>(`/theatres/${id}`);
    return res.data;
  },
};

// Shows API
export const showsApi = {
  getAll: async (params?: {
    movie_id?: number;
    theatre_id?: number;
    city?: string;
    show_date?: string;
    format?: string;
  }) => {
    const res = await api.get<Show[]>('/shows', { params });
    return res.data;
  },
  getById: async (id: number) => {
    const res = await api.get<Show>(`/shows/${id}`);
    return res.data;
  },
  getSeats: async (showId: number) => {
    const res = await api.get<Seat[]>(`/shows/${showId}/seats`);
    return res.data;
  },
  recommendSeats: async (showId: number, numSeats: number = 2, preferredTier?: string) => {
    const res = await api.post<{ seats: Seat[]; total_price: number; reason: string }>(
      `/shows/${showId}/recommend-seats`,
      { num_seats: numSeats, preferred_tier: preferredTier }
    );
    return res.data;
  },
};

// Smart Seat Recommendations API
export const recommendationsApi = {
  getPreferences: async (showId: number) => {
    const res = await api.get<ShowPreferencesResponse>(`/seat-recommendations/${showId}/preferences`);
    return res.data;
  },
  getRecommendations: async (params: SeatRecommendationRequestParams) => {
    const res = await api.post<SeatRecommendationsResponse>('/seat-recommendations', params);
    return res.data;
  },
};

// Bookings API
export const bookingsApi = {
  holdSeats: async (showId: number, seatIds: number[]) => {
    const res = await api.post<{
      message: string;
      show_id: number;
      seat_ids: number[];
      expires_at: string;
      duration_seconds: number;
    }>('/bookings/hold-seats', { show_id: showId, seat_ids: seatIds });
    return res.data;
  },
  releaseSeats: async (showId: number, seatIds: number[]) => {
    const res = await api.post('/bookings/release-seats', { show_id: showId, seat_ids: seatIds });
    return res.data;
  },
  createPending: async (showId: number, seatIds: number[], couponCode?: string) => {
    const res = await api.post<Booking>('/bookings/create-pending', {
      show_id: showId,
      seat_ids: seatIds,
      coupon_code: couponCode,
    });
    return res.data;
  },
  getMyBookings: async () => {
    const res = await api.get<Booking[]>('/bookings/my-bookings');
    return res.data;
  },
  getById: async (id: number) => {
    const res = await api.get<Booking>(`/bookings/${id}`);
    return res.data;
  },
  cancel: async (id: number) => {
    const res = await api.post<{ message: string; booking_id: number; status: string }>(`/bookings/${id}/cancel`);
    return res.data;
  },
};

// Payments API
export const paymentsApi = {
  process: async (data: {
    booking_id: number;
    payment_method: string;
    payment_details?: any;
    simulate_status?: 'SUCCESS' | 'FAILED' | 'CANCELLED';
    failure_reason?: string;
  }) => {
    const res = await api.post<{
      success: boolean;
      status: string;
      booking_code?: string;
      transaction_id: string;
      amount_paid?: number;
      qr_code_url?: string;
      pdf_ticket_url?: string;
      message: string;
    }>('/payments/process', data);
    return res.data;
  },
};

// Coupons API
export const couponsApi = {
  getAll: async () => {
    const res = await api.get<Coupon[]>('/coupons');
    return res.data;
  },
  validate: async (code: string, amount: number) => {
    const res = await api.post<{
      valid: boolean;
      code: string;
      discount_percent: number;
      discount_amount: number;
      final_amount: number;
      message: string;
    }>('/coupons/validate', { code, amount });
    return res.data;
  },
};

// Admin API
export const adminApi = {
  getDashboard: async () => {
    const res = await api.get<AdminStats>('/admin/dashboard');
    return res.data;
  },
  getAllBookings: async () => {
    const res = await api.get<Booking[]>('/admin/bookings');
    return res.data;
  },
  getAllUsers: async () => {
    const res = await api.get<User[]>('/admin/users');
    return res.data;
  },
  getAllPayments: async () => {
    const res = await api.get<Payment[]>('/admin/payments');
    return res.data;
  },
};

export default api;

