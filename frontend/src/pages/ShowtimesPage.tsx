import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Calendar, MapPin, Film, Clock, ChevronLeft, Sparkles, Filter } from 'lucide-react';
import { Movie, Theatre, Show } from '../types';
import { moviesApi, theatresApi, showsApi } from '../services/api';
import { Navbar, CITIES } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useBooking } from '../context/BookingContext';

export const ShowtimesPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [theatres, setTheatres] = useState<Theatre[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedFormat, setSelectedFormat] = useState<string>('All');

  const {
    selectedCity,
    setSelectedCity,
    setSelectedMovie,
    setSelectedTheatre,
    setSelectedShow,
  } = useBooking();

  const navigate = useNavigate();

  // Generate next 4 dates starting from today
  const dates = Array.from({ length: 4 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      dateStr: d.toISOString().split('T')[0],
      dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: d.getDate(),
      month: d.toLocaleDateString('en-US', { month: 'short' }),
    };
  });

  const [activeDate, setActiveDate] = useState<string>(dates[0].dateStr);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [movieData, theatresData, showsData] = await Promise.all([
          moviesApi.getById(Number(id)),
          theatresApi.getAll(selectedCity),
          showsApi.getAll({
            movie_id: Number(id),
            city: selectedCity,
            show_date: activeDate,
          }),
        ]);
        setMovie(movieData);
        setSelectedMovie(movieData);
        setTheatres(theatresData);
        setShows(showsData);
      } catch (err) {
        console.error('Failed to load showtimes:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, selectedCity, activeDate]);

  const handleSelectShow = (show: Show, theatre: Theatre) => {
    setSelectedShow(show);
    setSelectedTheatre(theatre);
    navigate(`/booking/seats/${show.id}`);
  };

  // Group shows by theatre
  const showsByTheatre = theatres.map((theatre) => {
    const theatreShows = shows.filter((s) => s.theatre_id === theatre.id);
    const filtered =
      selectedFormat === 'All'
        ? theatreShows
        : theatreShows.filter((s) => s.screen_format.toLowerCase().includes(selectedFormat.toLowerCase()));
    return {
      theatre,
      shows: filtered,
    };
  }).filter((group) => group.shows.length > 0);

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col">
      <Navbar />

      {/* Movie Mini Header */}
      {movie && (
        <div className="bg-[#0e1117] border-b border-slate-800/80 py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to={`/movie/${movie.id}`}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center">
                  {movie.title}
                  <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {movie.certificate}
                  </span>
                </h2>
                <div className="text-xs text-slate-400 mt-0.5">
                  {movie.language} • {movie.genre} • {movie.duration_minutes}m
                </div>
              </div>
            </div>

            {/* City Selector */}
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-orange-400" />
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-orange-500"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Date & Filter Bar */}
      <div className="sticky top-20 z-40 bg-[#090a0f]/95 backdrop-blur-md border-b border-slate-800/80 py-3 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          
          {/* Date Selector Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto max-w-full py-1">
            {dates.map((d) => (
              <button
                key={d.dateStr}
                onClick={() => setActiveDate(d.dateStr)}
                className={`flex flex-col items-center justify-center min-w-[70px] py-2 px-3 rounded-xl transition-all ${
                  activeDate === d.dateStr
                    ? 'bg-gradient-to-t from-orange-600 to-amber-500 text-slate-950 font-black shadow-lg shadow-orange-500/20'
                    : 'bg-[#0e1117] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span className="text-[10px] uppercase tracking-wider">{d.dayName}</span>
                <span className="text-base font-bold font-mono">{d.dayNumber}</span>
                <span className="text-[10px] -mt-1 font-medium">{d.month}</span>
              </button>
            ))}
          </div>

          {/* Format Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 flex items-center font-semibold">
              <Filter className="w-3.5 h-3.5 mr-1 text-slate-500" />
              Format:
            </span>
            {['All', '2D', '3D', 'IMAX'].map((fmt) => (
              <button
                key={fmt}
                onClick={() => setSelectedFormat(fmt)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedFormat === fmt
                    ? 'bg-orange-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Main Content: Theatre Shows Listing */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-slate-900 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : showsByTheatre.length === 0 ? (
          <div className="bg-[#0e1117] rounded-3xl border border-slate-800 p-12 text-center">
            <Film className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">No showtimes found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              There are no {selectedFormat !== 'All' ? selectedFormat : ''} shows scheduled in {selectedCity} for this date.
              Try selecting another date or switching city.
            </p>
          </div>
        ) : (
          showsByTheatre.map(({ theatre, shows: tShows }) => (
            <div
              key={theatre.id}
              className="bg-[#0e1117] rounded-2xl border border-slate-800/80 p-5 sm:p-6 space-y-4 hover:border-slate-700 transition-colors"
            >
              {/* Theatre Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/60">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center">
                    {theatre.name}
                  </h3>
                  <p className="text-xs text-slate-400 flex items-center mt-0.5">
                    <MapPin className="w-3.5 h-3.5 mr-1 text-slate-500 flex-shrink-0" />
                    <span>{theatre.address}, {theatre.city}</span>
                  </p>
                </div>
                <div className="flex items-center space-x-1.5">
                  {theatre.formats.map((fmt) => (
                    <span
                      key={fmt}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-orange-400 border border-slate-700"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
              </div>

              {/* Showtimes Grid */}
              <div className="flex flex-wrap gap-3">
                {tShows.map((show) => {
                  const showTime = new Date(show.show_time);
                  const timeFormatted = showTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  });

                  return (
                    <button
                      key={show.id}
                      onClick={() => handleSelectShow(show, theatre)}
                      className="group flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-orange-500/80 transition-all text-left min-w-[120px]"
                    >
                      <div className="flex items-center space-x-1 font-bold text-white text-sm group-hover:text-orange-400 font-mono">
                        <Clock className="w-3.5 h-3.5 text-orange-400 mr-1" />
                        <span>{timeFormatted}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 mt-1 text-[11px] font-semibold text-slate-400">
                        <span className="text-amber-400">{show.screen_format}</span>
                        <span>•</span>
                        <span>₹{show.silver_price.toFixed(0)}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-green-400 font-medium flex items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1"></span>
                        {show.available_seats} Seats Left
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </main>

      <Footer />
    </div>
  );
};

