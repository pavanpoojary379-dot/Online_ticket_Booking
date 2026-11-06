import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Users,
  CheckCircle2,
  ChevronRight,
  Sliders,
  DollarSign,
  Compass,
  Check,
  AlertCircle,
  Eye,
  Award,
  Maximize2,
  Minimize2,
  RefreshCw,
  Info
} from 'lucide-react';
import { Seat, RecommendationCardItem, ShowPreferencesResponse } from '../types';
import { recommendationsApi } from '../services/api';

interface SmartSeatRecommendationProps {
  showId: number;
  onApplyRecommendation: (seats: Seat[], rank?: number) => void;
  onHighlightSeats?: (seatIds: number[]) => void;
  selectedSeats: Seat[];
}

export const SmartSeatRecommendation: React.FC<SmartSeatRecommendationProps> = ({
  showId,
  onApplyRecommendation,
  onHighlightSeats,
  selectedSeats,
}) => {
  // User Preferences State
  const [numberOfSeats, setNumberOfSeats] = useState<number>(2);
  const [preferredCategory, setPreferredCategory] = useState<string>('ANY');
  const [maximumBudget, setMaximumBudget] = useState<number | ''>('');
  const [seatingPreference, setSeatingPreference] = useState<string>('best_view');
  const [adjacentRequired, setAdjacentRequired] = useState<boolean>(true);

  // UI & Data State
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingPrefs, setLoadingPrefs] = useState<boolean>(true);
  const [showPreferences, setShowPreferences] = useState<ShowPreferencesResponse | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationCardItem[]>([]);
  const [activeRank, setActiveRank] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Fetch show preferences (available categories, prices, bounds) on mount
  useEffect(() => {
    let isMounted = true;
    const fetchPrefs = async () => {
      setLoadingPrefs(true);
      try {
        const data = await recommendationsApi.getPreferences(showId);
        if (isMounted) {
          setShowPreferences(data);
          // Set default budget to max price of show if not configured
          if (data.max_price) {
            setMaximumBudget(data.max_price);
          }
        }
      } catch (err) {
        console.error('Failed to load show preferences:', err);
      } finally {
        if (isMounted) setLoadingPrefs(false);
      }
    };
    fetchPrefs();
    return () => {
      isMounted = false;
    };
  }, [showId]);

  // Main Recommendation Trigger
  const handleFindBestSeats = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const budgetNum = typeof maximumBudget === 'number' && maximumBudget > 0 ? maximumBudget : undefined;
      const res = await recommendationsApi.getRecommendations({
        show_id: showId,
        number_of_seats: numberOfSeats,
        preferred_category: preferredCategory === 'ANY' ? undefined : preferredCategory,
        maximum_budget: budgetNum,
        seating_preference: seatingPreference,
        adjacent_required: adjacentRequired,
      });

      setRecommendations(res.recommendations);

      if (res.recommendations.length > 0) {
        const topChoice = res.recommendations[0];
        setActiveRank(topChoice.rank);
        // Automatically highlight and apply the best match
        if (onHighlightSeats) {
          onHighlightSeats(topChoice.seat_ids);
        }
        onApplyRecommendation(topChoice.seats, topChoice.rank);
      } else {
        setErrorMessage('No seats found matching your criteria. Try adjusting your category or budget preferences.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to generate recommendations. Please try different options.';
      setErrorMessage(msg);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRecommendation = (rec: RecommendationCardItem) => {
    setActiveRank(rec.rank);
    if (onHighlightSeats) {
      onHighlightSeats(rec.seat_ids);
    }
    onApplyRecommendation(rec.seats, rec.rank);
  };

  const isCurrentSelection = (rec: RecommendationCardItem) => {
    if (selectedSeats.length !== rec.seats.length) return false;
    const currentIds = new Set(selectedSeats.map((s) => s.id));
    return rec.seat_ids.every((id) => currentIds.has(id));
  };

  return (
    <div className="w-full max-w-4xl bg-gradient-to-br from-[#121620] via-[#0d1017] to-[#15121e] rounded-3xl p-5 sm:p-7 border border-orange-500/30 mb-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Advisor Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-6">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-slate-950 shadow-lg shadow-orange-500/30">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h3 className="text-base sm:text-lg font-black text-white tracking-wide flex items-center gap-2">
                Smart Seat Advisor
              </h3>
              <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40">
                Rule-Based AI
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Intelligent multi-factor scoring: central viewing sightline, auditorium distance, adjacency & budget
            </p>
          </div>
        </div>

        {/* Toggle Collapse */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-white p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 transition-colors text-xs font-semibold flex items-center space-x-1"
        >
          {isExpanded ? (
            <>
              <span className="hidden sm:inline">Compact</span>
              <Minimize2 className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              <span className="hidden sm:inline">Preferences</span>
              <Maximize2 className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {/* Advisor Form Controls */}
      {isExpanded && (
        <div className="space-y-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. Ticket Count (1 to 10) */}
            <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800/80">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between mb-2.5">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-orange-400" />
                  Tickets Required
                </span>
                <span className="text-orange-400 font-mono font-bold text-xs bg-orange-500/10 px-2 py-0.5 rounded">
                  {numberOfSeats} {numberOfSeats === 1 ? 'Ticket' : 'Tickets'}
                </span>
              </label>

              {/* Ticket Count Grid: 1 to 10 */}
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setNumberOfSeats(count)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      numberOfSeats === count
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md shadow-orange-500/30 scale-105'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Seat Category */}
            <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800/80">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between mb-2.5">
                <span className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  Seat Category
                </span>
              </label>

              <select
                value={preferredCategory}
                onChange={(e) => setPreferredCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-medium"
              >
                <option value="ANY">Any Category (Best Overall)</option>
                {showPreferences?.tiers.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.label} (₹{t.price.toFixed(0)})
                  </option>
                )) || (
                  <>
                    <option value="GOLD">Gold Prime</option>
                    <option value="PLATINUM">Platinum Recliner</option>
                    <option value="SILVER">Silver Classic</option>
                  </>
                )}
              </select>

              <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                <span>Available tiers:</span>
                <span className="text-slate-300 font-medium">Silver, Gold, Platinum</span>
              </div>
            </div>

            {/* 3. Seating Preference */}
            <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800/80">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between mb-2.5">
                <span className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-sky-400" />
                  View Preference
                </span>
              </label>

              <select
                value={seatingPreference}
                onChange={(e) => setSeatingPreference(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-medium"
              >
                <option value="best_view">Best Overall View (Sweet-Spot)</option>
                <option value="centre">Centre Seats (Screen Alignment)</option>
                <option value="front">Front Seats (Immersive Close-up)</option>
                <option value="back">Back Seats (Panoramic Elevation)</option>
                <option value="adjacent">Adjacent Seats Priority</option>
              </select>

              <p className="mt-2 text-[11px] text-slate-400 leading-tight truncate">
                {seatingPreference === 'centre'
                  ? 'Focuses on horizontal center'
                  : seatingPreference === 'front'
                  ? 'Closer to cinema action'
                  : seatingPreference === 'back'
                  ? 'Elevated rear overview'
                  : 'Auditorium visual & sound sweet-spot'}
              </p>
            </div>

            {/* 4. Budget & Adjacency Toggle */}
            <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800/80 flex flex-col justify-between">
              <div>
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    Max Budget / Ticket
                  </span>
                  <span className="text-emerald-400 font-mono font-bold text-xs">
                    ₹{typeof maximumBudget === 'number' && maximumBudget > 0 ? maximumBudget : 'No Limit'}
                  </span>
                </label>

                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-xs font-bold">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={showPreferences?.min_price || 150}
                    max={1000}
                    step={10}
                    value={maximumBudget}
                    onChange={(e) => setMaximumBudget(e.target.value ? Number(e.target.value) : '')}
                    placeholder="e.g. 350"
                    className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Adjacency Toggle Switch */}
              <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                  Adjacent Required
                </span>
                <button
                  type="button"
                  onClick={() => setAdjacentRequired(!adjacentRequired)}
                  className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${
                    adjacentRequired ? 'bg-orange-500 justify-end' : 'bg-slate-700 justify-start'
                  }`}
                  title={adjacentRequired ? 'Strictly adjacent seats required' : 'Allow split/scattered seats'}
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md"></div>
                </button>
              </div>

            </div>

          </div>

          {/* Prominent "Find My Best Seats" Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <Info className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <span>
                Algorithm factors: <b className="text-slate-300">Central (35%)</b>, <b className="text-slate-300">Distance (25%)</b>, <b className="text-slate-300">Adjacency (25%)</b>, <b className="text-slate-300">Budget (15%)</b>
              </span>
            </div>

            <button
              disabled={loading || loadingPrefs}
              onClick={handleFindBestSeats}
              className={`w-full sm:w-auto px-7 py-3 rounded-xl font-black text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center space-x-2.5 ${
                loading
                  ? 'bg-orange-500/50 text-slate-950 cursor-wait'
                  : 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:brightness-110 text-slate-950 shadow-orange-500/25 transform hover:-translate-y-0.5'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing Cinema Hall...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Find My Best Seats</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-red-200">Recommendation Notice</div>
            <p className="mt-0.5 text-red-300/90 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Top Recommendations Cards Grid (Section 4) */}
      {recommendations.length > 0 && (
        <div className="mt-6 pt-5 border-t border-slate-800/90 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Recommended Options ({recommendations.length})</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              Ranked by weighted optimization score
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendations.map((rec) => {
              const isSelectedOption = isCurrentSelection(rec);
              const isActiveChoice = activeRank === rec.rank;

              // Color badge for rank
              const rankBadge =
                rec.rank === 1
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : rec.rank === 2
                  ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                  : 'bg-purple-500/20 text-purple-400 border-purple-500/40';

              return (
                <div
                  key={rec.rank}
                  onMouseEnter={() => {
                    if (onHighlightSeats) onHighlightSeats(rec.seat_ids);
                  }}
                  className={`rounded-2xl p-4.5 border transition-all duration-200 flex flex-col justify-between relative group ${
                    isSelectedOption
                      ? 'bg-gradient-to-b from-orange-950/40 to-slate-900 border-orange-500 shadow-xl shadow-orange-500/10 ring-1 ring-orange-500'
                      : isActiveChoice
                      ? 'bg-gradient-to-b from-emerald-950/40 to-slate-900 border-emerald-500 shadow-lg shadow-emerald-500/10'
                      : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  {/* Card Header: Rank & Score */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${rankBadge}`}>
                        Option #{rec.rank} {rec.rank === 1 && '• Top Pick'}
                      </span>

                      {/* Score Badge */}
                      <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-400 text-xs font-black font-mono">
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        <span>{rec.score.toFixed(0)}/100</span>
                      </div>
                    </div>

                    {/* Seats & Category */}
                    <div className="mb-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-base font-black text-white tracking-tight">
                          Seats: {rec.seat_labels.join(', ')}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">
                          Row {rec.row}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                          {rec.seat_category}
                        </span>
                        <span className="text-xs text-slate-400">
                          ₹{rec.individual_price.toFixed(0)} / ticket
                        </span>
                      </div>
                    </div>

                    {/* Score Breakdown Pills */}
                    <div className="grid grid-cols-2 gap-1.5 mb-3.5 text-[10px]">
                      <div className="bg-slate-950/70 rounded-lg px-2 py-1 border border-slate-800/80 flex justify-between">
                        <span className="text-slate-400">Center:</span>
                        <span className="font-bold text-orange-300 font-mono">
                          {rec.score_breakdown.central_position_score.toFixed(0)}%
                        </span>
                      </div>
                      <div className="bg-slate-950/70 rounded-lg px-2 py-1 border border-slate-800/80 flex justify-between">
                        <span className="text-slate-400">Distance:</span>
                        <span className="font-bold text-sky-300 font-mono">
                          {rec.score_breakdown.viewing_distance_score.toFixed(0)}%
                        </span>
                      </div>
                      <div className="bg-slate-950/70 rounded-lg px-2 py-1 border border-slate-800/80 flex justify-between">
                        <span className="text-slate-400">Adjacent:</span>
                        <span className="font-bold text-emerald-300 font-mono">
                          {rec.score_breakdown.adjacent_seating_score.toFixed(0)}%
                        </span>
                      </div>
                      <div className="bg-slate-950/70 rounded-lg px-2 py-1 border border-slate-800/80 flex justify-between">
                        <span className="text-slate-400">Budget:</span>
                        <span className="font-bold text-amber-300 font-mono">
                          {rec.score_breakdown.budget_score.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Explanations Bullets */}
                    <div className="space-y-1.5 mb-4 text-[11px] text-slate-300 bg-slate-950/40 rounded-xl p-2.5 border border-slate-800/60">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                        Why Recommended:
                      </div>
                      {rec.explanation.map((exp, idx) => (
                        <div key={idx} className="flex items-start space-x-1.5 leading-tight">
                          <Check className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span className="text-slate-300">{exp}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Bottom: Total Price & Select Button */}
                  <div className="pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Total Tickets</span>
                      <span className="text-sm font-black text-white font-mono">
                        ₹{rec.total_price.toFixed(0)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectRecommendation(rec)}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-1.5 ${
                        isSelectedOption
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black shadow-lg shadow-orange-500/25 ring-2 ring-orange-400'
                          : 'bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/40 hover:border-emerald-500'
                      }`}
                    >
                      {isSelectedOption ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Seats Selected ✓</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Select Option #{rec.rank}</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
