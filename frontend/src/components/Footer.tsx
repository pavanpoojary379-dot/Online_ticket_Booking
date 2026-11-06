import React from 'react';
import { Film, Heart, ShieldCheck, Zap, Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#07080c] border-t border-slate-900 text-slate-400 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          
          <div className="col-span-1 md:col-span-1 space-y-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-slate-950 font-bold">
                <Film className="w-4 h-4" />
              </div>
              <span className="text-xl font-black tracking-tight text-white font-['Outfit']">
                CINE<span className="text-orange-500">BOOK</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Smart Movie Ticket Booking Platform featuring AI smart seat recommendations, 5-minute dynamic seat locking, simulated secure checkout, and QR pass tickets.
            </p>
            <div className="flex items-center space-x-2 text-[11px] text-amber-500 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>12-Hour College Hackathon Edition</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Popular Cities</h4>
            <ul className="space-y-2 text-xs">
              <li><span className="hover:text-orange-400 cursor-pointer transition-colors">Mumbai (PVR & INOX)</span></li>
              <li><span className="hover:text-orange-400 cursor-pointer transition-colors">Delhi-NCR (Superplex)</span></li>
              <li><span className="hover:text-orange-400 cursor-pointer transition-colors">Bengaluru (Forum Mall)</span></li>
              <li><span className="hover:text-orange-400 cursor-pointer transition-colors">Hyderabad (Prasads IMAX)</span></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Cinema Formats</h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center space-x-2"><span className="text-orange-400 font-bold">IMAX with Laser</span></li>
              <li><span>Dolby Atmos 3D</span></li>
              <li><span>4DX Dynamic Motion</span></li>
              <li><span>Director's Cut Luxury Recliners</span></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Hackathon Testing</h4>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5 text-[11px]">
              <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                <span>Simulated Sandbox Mode</span>
              </div>
              <p className="text-slate-500">No real payment cards needed. Quick demo logins available on the login page.</p>
              <div className="text-orange-400 font-mono text-[10px] pt-1">Admin: admin@cinebook.com</div>
            </div>
          </div>

        </div>

        <div className="pt-8 border-t border-slate-900/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <p>© {new Date().getFullYear()} CineBook Inc. Crafted with passion for the College Hackathon.</p>
          <div className="flex items-center space-x-4 mt-3 sm:mt-0">
            <span className="flex items-center text-slate-400">
              Made with <Heart className="w-3.5 h-3.5 mx-1 text-red-500 fill-red-500" /> & FastAPI + React
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

