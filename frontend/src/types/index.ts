export interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  is_admin: boolean;
  created_at: string;
}

export interface Movie {
  id: number;
  title: string;
  description: string;
  poster_url: string;
  backdrop_url?: string;
  trailer_url?: string;
  genre: string;
  duration_minutes: number;
  release_date: string;
  language: string;
  rating: number; // e.g., 8.8
  certificate: string; // U, UA, A
  is_now_showing: boolean;
  is_upcoming: boolean;
  is_popular: boolean;
  cast?: string;
  director?: string;
}

export interface Theatre {
  id: number;
  name: string;
  city: string;
  address: string;
  formats: string[]; // e.g. ["2D", "3D", "IMAX"]
}

export interface Screen {
  id: number;
  theatre_id: number;
  screen_number: number;
  name: string;
  total_seats: number;
}

export interface Show {
  id: number;
  movie_id: number;
  theatre_id: number;
  screen_id: number;
  show_time: string; // ISO datetime
  screen_format: string; // "2D", "3D", "IMAX"
  silver_price: number;
  gold_price: number;
  platinum_price: number;
  movie?: Movie;
  theatre?: Theatre;
  available_seats?: number;
  total_seats?: number;
}

export type SeatTier = 'SILVER' | 'GOLD' | 'PLATINUM';
export type SeatStatus = 'AVAILABLE' | 'SELECTED' | 'BOOKED' | 'LOCKED';

export interface Seat {
  id: number;
  row_label: string; // "A", "B", ...
  seat_number: number; // 1, 2, ...
  tier: SeatTier;
  price: number;
  status: SeatStatus;
}

export interface SeatScoreBreakdown {
  central_position_score: number;
  viewing_distance_score: number;
  adjacent_seating_score: number;
  budget_score: number;
}

export interface RecommendationCardItem {
  rank: number;
  score: number;
  seat_ids: number[];
  seat_labels: string[];
  seats: Seat[];
  seat_category: string;
  row: string;
  individual_price: number;
  total_price: number;
  score_breakdown: SeatScoreBreakdown;
  explanation: string[];
  summary_reason: string;
}

export interface SeatRecommendationsResponse {
  show_id: number;
  number_of_seats: number;
  total_recommendations: number;
  recommendations: RecommendationCardItem[];
  message?: string;
}

export interface TierPreferenceInfo {
  name: string;
  label: string;
  price: number;
  available_count: number;
}

export interface ShowPreferencesResponse {
  show_id: number;
  movie_title: string;
  theatre_name: string;
  screen_name: string;
  screen_format: string;
  available_seats_count: number;
  total_seats_count: number;
  tiers: TierPreferenceInfo[];
  min_price: number;
  max_price: number;
  seating_preferences: { value: string; label: string; description?: string }[];
  max_tickets_allowed: number;
}

export interface SeatRecommendationRequestParams {
  show_id: number;
  number_of_seats: number;
  preferred_category?: string;
  maximum_budget?: number;
  seating_preference?: string;
  adjacent_required: boolean;
}

export interface BookingSeat {
  id?: number;
  seat_id: number;
  seat_label: string; // e.g. "C5"
  tier: SeatTier;
  price: number;
}

export interface Booking {
  id: number;
  booking_code: string;
  user_id: number;
  show_id: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  total_amount: number;
  convenience_fee: number;
  discount_amount: number;
  final_amount: number;
  coupon_code?: string;
  created_at: string;
  qr_code_path?: string;
  pdf_ticket_path?: string;
  show?: Show;
  seats: BookingSeat[];
  payment?: Payment;
}

export interface Payment {
  id: number;
  booking_id: number;
  payment_method: 'UPI' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'NET_BANKING' | 'WALLET';
  transaction_id: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  created_at: string;
}

export interface Coupon {
  code: string;
  discount_percent: number;
  description: string;
  min_amount: number;
}

export interface AdminStats {
  total_movies: number;
  total_bookings: number;
  total_revenue: number;
  total_users: number;
  occupancy_rate: number;
  recent_bookings: Booking[];
  revenue_by_movie: { movie_title: string; revenue: number; bookings_count: number }[];
  daily_analytics: { date: string; bookings: number; revenue: number }[];
}
