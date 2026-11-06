import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star, Clock, Ticket, Info } from 'lucide-react';
import { Movie } from '../types';
import { useBooking } from '../context/BookingContext';

interface MovieCardProps {
  movie: Movie;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie }) => {
  const navigate = useNavigate();
  const { setSelectedMovie } = useBooking();

  const handleBookNow = (e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedMovie(movie);
    navigate(`/movie/${movie.id}/showtimes`);
  };

  return (
    <div className="group relative bg-[#0e1117] rounded-2xl overflow-hidden border border-slate-800/80 hover:border-orange-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-orange-500/10 flex flex-col h-full">
      
      {/* Poster Image Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-900">
        <img
          src={movie.poster_url}
          alt={movie.title}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Rating Badge */}
        <div className="absolute top-3 left-3 flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 text-xs font-bold text-amber-400">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          <span>{movie.rating.toFixed(1)}</span>
        </div>

        {/* Certificate & Language Badge */}
        <div className="absolute top-3 right-3 flex items-center space-x-1.5">
          <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[10px] font-bold text-slate-300 uppercase">
            {movie.certificate}
          </span>
        </div>

        {/* Overlay on hover with quick details */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e1117] via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
      </div>

      {/* Content Info */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center space-x-2 text-[11px] text-slate-400 mb-1">
            <span className="font-semibold text-orange-400">{movie.language}</span>
            <span>•</span>
            <span className="flex items-center">
              <Clock className="w-3 h-3 mr-1 text-slate-500" />
              {movie.duration_minutes}m
            </span>
          </div>

          <h3 className="font-bold text-white text-base line-clamp-1 group-hover:text-orange-400 transition-colors">
            {movie.title}
          </h3>

          <p className="text-xs text-slate-400 mt-1 line-clamp-1">
            {movie.genre}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center space-x-2">
          <Link
            to={`/movie/${movie.id}`}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold text-center transition-colors flex items-center justify-center space-x-1"
          >
            <Info className="w-3.5 h-3.5 mr-1" />
            <span>Details</span>
          </Link>

          <button
            onClick={handleBookNow}
            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-slate-950 text-xs font-bold transition-all shadow-md shadow-orange-500/20 flex items-center justify-center space-x-1"
          >
            <Ticket className="w-3.5 h-3.5 mr-1" />
            <span>Book</span>
          </button>
        </div>
      </div>

    </div>
  );
};

