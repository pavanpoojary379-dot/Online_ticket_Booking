import React from 'react';
import { Seat, SeatTier } from '../types';
import { Check, Lock, X, Sparkles } from 'lucide-react';

interface SeatGridProps {
  seats: Seat[];
  selectedSeats: Seat[];
  onToggleSeat: (seat: Seat) => void;
  silverPrice: number;
  goldPrice: number;
  platinumPrice: number;
  recommendedSeatIds?: number[];
  activeRecommendationRank?: number | null;
}

export const SeatGrid: React.FC<SeatGridProps> = ({
  seats,
  selectedSeats,
  onToggleSeat,
  silverPrice,
  goldPrice,
  platinumPrice,
  recommendedSeatIds = [],
  activeRecommendationRank = null,
}) => {
  // Cinema sections ordered from screen (front) to rear:
  // Row A, B: Silver Classic (Front Rows)
  // Row C, D: Gold Prime (Center Sweet-Spot)
  // Row E, F: Platinum Recliner (VIP Rear Rows)
  const tiersOrder: { tier: SeatTier; label: string; price: number; description: string }[] = [
    { tier: 'SILVER', label: 'Silver Classic', price: silverPrice, description: 'Front rows standard cinema seating' },
    { tier: 'GOLD', label: 'Gold Prime', price: goldPrice, description: 'Center auditorium prime viewing angle' },
    { tier: 'PLATINUM', label: 'Platinum Recliner', price: platinumPrice, description: 'VIP rear row recliners with maximum legroom' },
  ];

  const getRowsForTier = (tier: SeatTier) => {
    const tierSeats = seats.filter((s) => s.tier === tier);
    const rowMap = new Map<string, Seat[]>();
    tierSeats.forEach((seat) => {
      if (!rowMap.has(seat.row_label)) {
        rowMap.set(seat.row_label, []);
      }
      rowMap.get(seat.row_label)!.push(seat);
    });

    // Rows ascending (A, B, C...) from screen downwards
    return Array.from(rowMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  };

  const isSelected = (seat: Seat) => selectedSeats.some((s) => s.id === seat.id);
  const isRecommended = (seat: Seat) => recommendedSeatIds.includes(seat.id);

  return (
    <div className="w-full flex flex-col items-center select-none py-4">
      
      {/* Cinema Screen Indicator */}
      <div className="w-full max-w-2xl mb-10 flex flex-col items-center">
        <div className="relative w-full h-8 flex items-center justify-center">
          {/* Curved glowing screen SVG */}
          <svg className="w-full h-8 overflow-visible" viewBox="0 0 500 30" fill="none">
            <path
              d="M 10 25 Q 250 2 490 25"
              stroke="url(#screenGradient)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="screenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#f97316" stopOpacity="1" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0.2" />
              </linearGradient>
            </defs>
          </svg>
          {/* Projection beam glow */}
          <div className="absolute top-4 w-3/4 h-12 bg-gradient-to-b from-orange-500/10 to-transparent blur-md pointer-events-none"></div>
        </div>
        <span className="text-[11px] tracking-[0.3em] uppercase font-bold text-slate-400 mt-1 flex items-center gap-1.5">
          <span>CINEMA SCREEN THIS WAY</span>
        </span>
      </div>

      {/* Active recommendation banner hint */}
      {recommendedSeatIds.length > 0 && (
        <div className="mb-6 px-4 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 text-xs font-semibold flex items-center space-x-2 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>
            {activeRecommendationRank ? `Recommendation #${activeRecommendationRank}` : 'Smart AI Suggestions'}:{' '}
            <b className="text-white">Highlighted in Glowing Green below</b>. Tap any seat to customize your selection.
          </span>
        </div>
      )}

      {/* Seating Layout by Tier */}
      <div className="w-full max-w-3xl space-y-6">
        {tiersOrder.map(({ tier, label, price, description }) => {
          const rows = getRowsForTier(tier);
          if (rows.length === 0) return null;

          return (
            <div key={tier} className="bg-slate-900/50 rounded-2xl p-5 border border-slate-800/80 shadow-md">
              
              {/* Tier Header */}
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800/60">
                <div className="flex items-center space-x-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    tier === 'PLATINUM' ? 'bg-sky-400' : tier === 'GOLD' ? 'bg-amber-400' : 'bg-slate-400'
                  }`}></div>
                  <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                    {label}
                  </span>
                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                    ({description})
                  </span>
                </div>
                <div className="text-xs font-extrabold text-orange-400 font-mono">
                  ₹{price.toFixed(0)} <span className="text-[10px] text-slate-500 font-normal">/ ticket</span>
                </div>
              </div>

              {/* Rows and Seats */}
              <div className="space-y-3">
                {rows.map(([rowLabel, rowSeats]) => (
                  <div key={rowLabel} className="flex items-center justify-center space-x-2 sm:space-x-3">
                    
                    {/* Left Row Label */}
                    <span className="w-6 text-center text-xs font-bold text-slate-400">
                      {rowLabel}
                    </span>

                    {/* Seats in row */}
                    <div className="flex items-center space-x-1.5 sm:space-x-2.5">
                      {rowSeats.sort((a, b) => a.seat_number - b.seat_number).map((seat, index) => {
                        const selected = isSelected(seat);
                        const recommended = isRecommended(seat);
                        const isBooked = seat.status === 'BOOKED';
                        const isLockedByOther = seat.status === 'LOCKED';
                        const isAisleGap = index === 4; // Add walkway aisle between seat 5 & 6

                        // Determine seat visual style based on requirements:
                        // Booked: Red
                        // Temporarily locked: Grey (dashed)
                        // Selected: Orange
                        // Recommended (not selected): Green
                        // Available: Neutral
                        let seatClasses = '';
                        if (isBooked) {
                          seatClasses = 'bg-red-950/40 text-red-500/70 border border-red-800/50 cursor-not-allowed';
                        } else if (isLockedByOther) {
                          seatClasses = 'bg-slate-800/90 text-slate-500 border border-slate-600/60 border-dashed cursor-not-allowed';
                        } else if (selected) {
                          seatClasses = 'bg-gradient-to-t from-orange-600 to-amber-500 text-slate-950 shadow-lg shadow-orange-500/40 scale-105 font-black ring-2 ring-orange-400';
                        } else if (recommended) {
                          seatClasses = 'bg-emerald-950/70 text-emerald-300 border-2 border-emerald-500 shadow-md shadow-emerald-500/30 ring-1 ring-emerald-400 font-bold hover:bg-emerald-800/80 animate-pulse';
                        } else {
                          seatClasses = 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 hover:border-orange-500/60';
                        }

                        return (
                          <React.Fragment key={seat.id}>
                            <button
                              disabled={isBooked || isLockedByOther}
                              onClick={() => onToggleSeat(seat)}
                              title={`${rowLabel}${seat.seat_number} - ₹${seat.price} (${recommended ? 'Recommended' : seat.status})`}
                              className={`
                                relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all duration-150
                                ${seatClasses}
                              `}
                            >
                              {selected ? (
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              ) : isBooked ? (
                                <X className="w-3 h-3 text-red-500/80" />
                              ) : isLockedByOther ? (
                                <Lock className="w-3 h-3 text-slate-500" />
                              ) : recommended ? (
                                <div className="flex items-center justify-center">
                                  <span>{seat.seat_number}</span>
                                </div>
                              ) : (
                                seat.seat_number
                              )}
                            </button>

                            {/* Aisle Walkway */}
                            {isAisleGap && <div className="w-4 sm:w-6"></div>}
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {/* Right Row Label */}
                    <span className="w-6 text-center text-xs font-bold text-slate-400">
                      {rowLabel}
                    </span>

                  </div>
                ))}
              </div>

            </div>
          );
        })}
      </div>

      {/* Seating Legend as required in Section 5 */}
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-8 pt-6 border-t border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-md bg-slate-800 border border-slate-700"></div>
          <span>Available (Neutral)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-md bg-gradient-to-t from-orange-600 to-amber-500 ring-2 ring-orange-400"></div>
          <span className="text-white font-semibold">Selected (Orange)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-md bg-emerald-950/70 border-2 border-emerald-500 ring-1 ring-emerald-400"></div>
          <span className="text-emerald-400 font-semibold">Recommended (Green)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-md bg-red-950/40 border border-red-800/60 flex items-center justify-center">
            <X className="w-2.5 h-2.5 text-red-500" />
          </div>
          <span>Booked (Red)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-md bg-slate-800/90 border border-slate-600/60 border-dashed flex items-center justify-center">
            <Lock className="w-2.5 h-2.5 text-slate-500" />
          </div>
          <span>Temporarily Locked (Grey)</span>
        </div>
      </div>

    </div>
  );
};
