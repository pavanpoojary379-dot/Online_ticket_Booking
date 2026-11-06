import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play, Ticket, Star, Sparkles, Flame, Calendar, Tag, ChevronRight, Compass } from 'lucide-react';
import { Movie } from '../types';
import { moviesApi } from '../services/api';
import { MovieCard } from '../components/MovieCard';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useBooking } from '../context/BookingContext';

const GENRES = ['All', 'Action', 'Sci-Fi', 'Comedy', 'Thriller', 'Horror', 'Drama'];

export const HomePage: React.FC = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'NOW_SHOWING' | 'UPCOMING' | 'POPULAR'>('NOW_SHOWING');
  const { setSelectedMovie } = useBooking();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      try {
        const data = await moviesApi.getAll({
          search: searchQuery || undefined,
          genre: selectedGenre === 'All' ? undefined : selectedGenre,
        });
        setMovies(data);
      } catch (err) {
        console.error('Failed to load movies:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMovies();
  }, [selectedGenre, searchQuery]);

  // Featured hero movie: top rated movie or first blockbuster
  const featuredMovie = movies.find((m) => m.is_popular) || movies[0];

  const nowShowingMovies = movies.filter((m) => m.is_now_showing);
  const upcomingMovies = movies.filter((m) => m.is_upcoming);
  const popularMovies = movies.filter((m) => m.is_popular);

  const displayedMovies =
    activeTab === 'NOW_SHOWING'
      ? nowShowingMovies
      : activeTab === 'UPCOMING'
      ? upcomingMovies
      : popularMovies;

  const handleHeroBook = () => {
    if (featuredMovie) {
      setSelectedMovie(featuredMovie);
      navigate(`/movie/${featuredMovie.id}/showtimes`);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col">
      <Navbar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      {/* Hero Section */}
      {featuredMovie && !searchQuery && (
        <section className="relative w-full h-[520px] sm:h-[600px] overflow-hidden">
          {/* Backdrop Image */}
          <div className="absolute inset-0">
            <img
              src={featuredMovie.backdrop_url || featuredMovie.poster_url}
              alt={featuredMovie.title}
              className="w-full h-full object-cover object-center brightness-[0.45] scale-105 transform animate-pulse-slow"
            />
            {/* Dark Cinematic Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-[#090a0f]/60 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#090a0f] via-[#090a0f]/80 to-transparent"></div>
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
            <div className="max-w-2xl space-y-4">
              
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40 text-xs font-bold tracking-wide uppercase flex items-center">
                  <Flame className="w-3.5 h-3.5 mr-1 text-orange-400" />
                  Featured Blockbuster
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-900/80 border border-slate-700 text-xs font-bold text-slate-300">
                  {featuredMovie.certificate}
                </span>
                <div className="flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold">
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span>{featuredMovie.rating.toFixed(1)}</span>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {featuredMovie.language} • {featuredMovie.duration_minutes}m
                </span>
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white font-['Outfit'] tracking-tight leading-none drop-shadow-md">
                {featuredMovie.title}
              </h1>

              {/* Genre tags */}
              <p className="text-sm font-semibold text-orange-400/90 tracking-wide">
                {featuredMovie.genre}
              </p>

              {/* Description */}
              <p className="text-slate-300 text-xs sm:text-sm line-clamp-3 leading-relaxed max-w-xl">
                {featuredMovie.description}
              </p>

              {/* CTA Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  onClick={handleHeroBook}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-slate-950 font-bold text-sm shadow-xl shadow-orange-500/30 transition-all flex items-center space-x-2 transform hover:-translate-y-0.5"
                >
                  <Ticket className="w-4 h-4" />
                  <span>Book Tickets Now</span>
                </button>

                <Link
                  to={`/movie/${featuredMovie.id}`}
                  className="px-5 py-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white font-semibold text-sm border border-slate-700 backdrop-blur-md transition-all flex items-center space-x-2"
                >
                  <Play className="w-4 h-4 fill-white text-white" />
                  <span>Watch Trailer & Details</span>
                </Link>
              </div>

            </div>
          </div>
        </section>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-8">
        
        {/* Promotional Hackathon Offer Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-orange-600/20 via-slate-900 to-amber-600/20 border border-orange-500/30 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center">
                Get 20% Instant Discount on All Bookings!
                <span className="ml-2 px-2 py-0.5 text-[10px] uppercase font-extrabold bg-orange-500 text-slate-950 rounded">Limited</span>
              </h3>
              <p className="text-xs text-slate-400">
                Apply coupon code <code className="bg-slate-950 px-1.5 py-0.5 rounded text-orange-400 font-mono font-bold">CINE20</code> or <code className="bg-slate-950 px-1.5 py-0.5 rounded text-orange-400 font-mono font-bold">FIRST10</code> at checkout.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs text-orange-400 font-bold whitespace-nowrap">
            <span>Explore Shows</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Section Tabs & Genre Filter Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          
          {/* Main Section Navigation Tabs */}
          <div className="flex items-center bg-[#0e1117] p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('NOW_SHOWING')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'NOW_SHOWING'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Now Showing ({nowShowingMovies.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('UPCOMING')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'UPCOMING'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Upcoming ({upcomingMovies.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('POPULAR')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'POPULAR'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Trending</span>
            </button>
          </div>

          {/* Genre Pills */}
          <div className="flex items-center overflow-x-auto space-x-1.5 py-1 max-w-full">
            {GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedGenre === genre
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>

        </div>

        {/* Movies Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-slate-900 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : displayedMovies.length === 0 ? (
          <div className="text-center py-16 bg-[#0e1117] rounded-3xl border border-slate-800 p-8">
            <Compass className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">No movies found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              We couldn't find any movie matching "{searchQuery || selectedGenre}". Try selecting a different genre or clearing your search.
            </p>
            <button
              onClick={() => {
                setSelectedGenre('All');
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-orange-500 text-slate-950 font-bold text-xs"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 sm:gap-6">
            {displayedMovies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
};

