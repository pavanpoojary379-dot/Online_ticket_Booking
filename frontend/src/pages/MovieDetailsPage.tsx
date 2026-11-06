import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Star, Clock, Calendar, Globe, Ticket, Play, X, User as UserIcon, Film, ChevronLeft } from 'lucide-react';
import { Movie } from '../types';
import { moviesApi } from '../services/api';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useBooking } from '../context/BookingContext';

export const MovieDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showTrailerModal, setShowTrailerModal] = useState<boolean>(false);
  const { setSelectedMovie } = useBooking();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMovie = async () => {
      if (!id) return;
      try {
        const data = await moviesApi.getById(Number(id));
        setMovie(data);
      } catch (err) {
        console.error('Failed to load movie details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMovie();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col items-center justify-center p-4">
        <h2 className="text-xl font-bold mb-2">Movie Not Found</h2>
        <Link to="/" className="text-orange-400 font-semibold text-sm hover:underline">
          Return to Movies Home
        </Link>
      </div>
    );
  }

  const handleBookNow = () => {
    setSelectedMovie(movie);
    navigate(`/movie/${movie.id}/showtimes`);
  };

  // Convert YouTube link to embed format if available
  const getEmbedUrl = (url?: string) => {
    if (!url) return 'https://www.youtube.com/embed/dQw4w9WgXcQ';
    if (url.includes('watch?v=')) {
      return url.replace('watch?v=', 'embed/');
    }
    return url;
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col">
      <Navbar />

      {/* Hero Backdrop Banner */}
      <div className="relative w-full h-[380px] sm:h-[460px] overflow-hidden">
        <img
          src={movie.backdrop_url || movie.poster_url}
          alt={movie.title}
          className="w-full h-full object-cover object-center brightness-[0.35] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-[#090a0f]/70 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#090a0f] via-transparent to-[#090a0f]"></div>

        {/* Back Link */}
        <div className="absolute top-6 left-6 z-10">
          <Link
            to="/"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-700 backdrop-blur-md transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Movies</span>
          </Link>
        </div>
      </div>

      {/* Main Movie Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-52 sm:-mt-64 relative z-20 flex-1 w-full pb-16">
        <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
          
          {/* Left Column: Movie Poster & Action Buttons */}
          <div className="w-full md:w-80 flex-shrink-0 flex flex-col items-center md:items-start">
            <div className="relative aspect-[2/3] w-64 md:w-80 rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700/80 bg-slate-900">
              <img
                src={movie.poster_url}
                alt={movie.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-700 text-xs font-bold text-orange-400">
                {movie.certificate}
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="w-64 md:w-80 mt-5 space-y-3">
              <button
                onClick={handleBookNow}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-slate-950 font-black text-sm shadow-xl shadow-orange-500/20 transition-all flex items-center justify-center space-x-2"
              >
                <Ticket className="w-4 h-4" />
                <span>Book Tickets</span>
              </button>

              <button
                onClick={() => setShowTrailerModal(true)}
                className="w-full py-3 px-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors flex items-center justify-center space-x-2"
              >
                <Play className="w-4 h-4 text-orange-400 fill-orange-400" />
                <span>Watch Official Trailer</span>
              </button>
            </div>
          </div>

          {/* Right Column: Detailed Info */}
          <div className="flex-1 space-y-6 pt-2">
            
            {/* Title & Metadata */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/30 text-xs font-bold tracking-wide uppercase">
                  {movie.genre}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold">
                  {movie.language}
                </span>
                <div className="flex items-center space-x-1 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <span>{movie.rating.toFixed(1)} / 10 IMDb</span>
                </div>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-white font-['Outfit'] tracking-tight">
                {movie.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-medium mt-3">
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>{movie.duration_minutes} minutes ({Math.floor(movie.duration_minutes / 60)}h {movie.duration_minutes % 60}m)</span>
                </div>
                <span>•</span>
                <div className="flex items-center space-x-1.5">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span>Released {movie.release_date}</span>
                </div>
                <span>•</span>
                <div className="flex items-center space-x-1.5">
                  <Globe className="w-4 h-4 text-slate-500" />
                  <span>{movie.language} Audio</span>
                </div>
              </div>
            </div>

            {/* Synopsis */}
            <div className="bg-[#0e1117] rounded-2xl p-6 border border-slate-800/80 space-y-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Synopsis
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                {movie.description}
              </p>
            </div>

            {/* Cast & Crew Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#0e1117] rounded-2xl p-5 border border-slate-800/80 space-y-1.5">
                <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider flex items-center">
                  <Film className="w-3.5 h-3.5 mr-1.5" /> Director
                </span>
                <p className="text-sm font-semibold text-white">
                  {movie.director || 'Visionary Filmmaker'}
                </p>
              </div>

              <div className="bg-[#0e1117] rounded-2xl p-5 border border-slate-800/80 space-y-1.5">
                <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider flex items-center">
                  <UserIcon className="w-3.5 h-3.5 mr-1.5" /> Starring Cast
                </span>
                <p className="text-sm font-semibold text-white">
                  {movie.cast || 'Lead Ensemble Cast'}
                </p>
              </div>
            </div>

            {/* Available Cinema Formats */}
            <div className="bg-[#0e1117] rounded-2xl p-6 border border-slate-800/80">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
                Experience in Premium Cinema Formats
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="font-bold text-orange-400">IMAX 3D with Laser</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Expanded 1.90:1 aspect ratio</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="font-bold text-sky-400">Dolby Atmos Surround</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">360-degree spatial sound</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="font-bold text-amber-400">4DX Sensational</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Motion seats & environmental effects</div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Trailer Modal */}
      {showTrailerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative w-full max-w-4xl bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">
                {movie.title} – Official Trailer
              </h3>
              <button
                onClick={() => setShowTrailerModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-video w-full bg-black">
              <iframe
                src={getEmbedUrl(movie.trailer_url)}
                title={movie.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

