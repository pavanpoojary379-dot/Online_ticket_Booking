import React, { useState } from 'react';
import { Sparkles, Users, CheckCircle2, ChevronRight } from 'lucide-react';
import { Seat } from '../types';
import { showsApi } from '../services/api';

interface SmartSeatRecommendationProps {
  showId: number;
  onApplyRecommendation: (seats: Seat[]) => void;
}

export const SmartSeatRecommendation: React.FC<SmartSeatRecommendationProps> = ({
  showId,
  onApplyRecommendation,
}) => {
  const [numSeats, setNumSeats] = useState<number>(2);
  const [preferredTier, setPreferredTier] = useState<string>('GOLD');
  const [loading, setLoading] = useState<boolean>(false);
  const [recommendation, setRecommendation] = useState<{
    seats: Seat[];
    total_price: number;
    reason: string;
  } | null>(null);

  const handleGetRecommendation = async (count: number, tier: string) => {
    setLoading(true);
    try {
      const res = await showsApi.recommendSeats(showId, count, tier === 'ANY' ? undefined : tier);
      setRecommendation(res);
      onApplyRecommendation(res.seats);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Could not find adjacent seats for the requested criteria');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl bg-gradient-to-r from-orange-950/20 via-slate-900/60 to-amber-950/20 rounded-2xl p-4 border border-orange-500/20 mb-8 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        {/* Title & Badge */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Smart Seat Recommendation
              </h4>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                Rule-Based AI
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Finds optimal central viewing angle & adjacent seats for groups
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Seat count buttons */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            {[1, 2, 3, 4].map((count) => (
              <button
                key={count}
                onClick={() => {
                  setNumSeats(count);
                  handleGetRecommendation(count, preferredTier);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  numSeats === count
                    ? 'bg-orange-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {count} {count === 1 ? 'Seat' : 'Seats'}
              </button>
            ))}
          </div>

          {/* Tier picker */}
          <select
            value={preferredTier}
            onChange={(e) => {
              setPreferredTier(e.target.value);
              handleGetRecommendation(numSeats, e.target.value);
            }}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
          >
            <option value="GOLD">Gold Prime</option>
            <option value="PLATINUM">Platinum VIP</option>
            <option value="SILVER">Silver</option>
            <option value="ANY">Any Tier</option>
          </select>

          {/* Quick Apply Button */}
          <button
            disabled={loading}
            onClick={() => handleGetRecommendation(numSeats, preferredTier)}
            className="px-3.5 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500 text-orange-400 hover:text-slate-950 border border-orange-500/40 text-xs font-bold transition-all flex items-center space-x-1"
          >
            <span>{loading ? 'Finding...' : 'Auto-Select'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* Result feedback */}
      {recommendation && (
        <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-orange-300">
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span>
              <b>Selected:</b> {recommendation.seats.map((s) => `${s.row_label}${s.seat_number}`).join(', ')} ({recommendation.reason})
            </span>
          </div>
          <span className="font-mono font-bold text-white">
            ₹{recommendation.total_price.toFixed(0)}
          </span>
        </div>
      )}
    </div>
  );
};

