import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft,
  Navigation,
  Compass,
  MapPin,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Volume2,
  VolumeX,
  Smartphone,
  Eye,
  Info,
  ChevronUp,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Accessibility,
  Check,
  PartyPopper,
  Radio,
  ExternalLink
} from 'lucide-react';
import { navigationApi } from '../services/api';
import {
  NavigationBookingInfo,
  ScreenMapData,
  NavigationSessionData,
  NavigationState,
  SeatCoordinateItem,
} from '../types';
import { SimulationLocationProvider } from '../services/location/SimulationLocationProvider';
import { IndoorTheatreBlueprint } from '../components/IndoorTheatreBlueprint';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export const IndoorNavigationPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();

  // Booking & Map State
  const [bookingInfo, setBookingInfo] = useState<NavigationBookingInfo | null>(null);
  const [screenMap, setScreenMap] = useState<ScreenMapData | null>(null);
  const [session, setSession] = useState<NavigationSessionData | null>(null);
  const [targetSeatId, setTargetSeatId] = useState<number | null>(null);

  // Positioning & Navigation State
  const [currentCoords, setCurrentCoords] = useState<{ x: number; y: number }>({ x: 50.0, y: 95.0 });
  const [navigationState, setNavigationState] = useState<NavigationState>('ENTERING_AUDITORIUM');
  const [statusMessage, setStatusMessage] = useState<string>('Entering auditorium. Head towards the central aisle.');
  const [currentInstruction, setCurrentInstruction] = useState<string>('Walk straight along the central aisle.');
  const [route, setRoute] = useState<{ x: number; y: number }[]>([]);
  const [remainingDistance, setRemainingDistance] = useState<number>(0);
  const [remainingSteps, setRemainingSteps] = useState<number>(0);
  const [isTargetRowActive, setIsTargetRowActive] = useState<boolean>(false);
  const [isSeatReached, setIsSeatReached] = useState<boolean>(false);

  // Settings & Toggles
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(true);
  const [accessibilityMode, setAccessibilityMode] = useState<boolean>(false);
  const [showBleInfoModal, setShowBleInfoModal] = useState<boolean>(false);

  // Notification deduplication tracker
  const notifiedStatesRef = useRef<Set<string>>(new Set());

  // Location provider instance
  const locationProvider = useMemo(() => new SimulationLocationProvider(50.0, 95.0), []);

  // 1. Initial Load: Fetch booking & screen map, start session
  useEffect(() => {
    let isMounted = true;
    const initNavigation = async () => {
      if (!bookingId) return;
      setLoading(true);
      setErrorMessage(null);

      try {
        // Fetch verified booking navigation info
        const info = await navigationApi.getBookingNavInfo(Number(bookingId));
        if (!isMounted) return;
        setBookingInfo(info);

        const initialTargetSeatId = info.default_seat_id;
        setTargetSeatId(initialTargetSeatId);

        // Fetch auditorium blueprint
        const mapData = await navigationApi.getScreenMap(info.screen_id);
        if (!isMounted) return;
        setScreenMap(mapData);

        // Configure row positions on location provider for collision detection
        const rowYs = Object.values(mapData.row_positions);
        locationProvider.setRowPositions(rowYs);
        locationProvider.setScreenMap(mapData);
        locationProvider.onBlocked((reason) => {
          setToastMessage(reason);
          setTimeout(() => setToastMessage(null), 3500);
        });

        // Start or resume backend session
        const navSession = await navigationApi.startSession(info.booking_id, initialTargetSeatId);
        if (!isMounted) return;
        setSession(navSession);
        setCurrentCoords({ x: navSession.current_x, y: navSession.current_y });
        setNavigationState(navSession.navigation_status);
        setStatusMessage(navSession.status_message);
        setCurrentInstruction(navSession.current_instruction);
        setRoute(navSession.route);
        setRemainingDistance(navSession.remaining_distance);
        setRemainingSteps(navSession.remaining_steps);
        setIsTargetRowActive(navSession.is_target_row_active);
        setIsSeatReached(navSession.is_seat_reached);

        locationProvider.setPosition(navSession.current_x, navSession.current_y);
      } catch (err: any) {
        console.error('Failed to initialize indoor navigation:', err);
        setErrorMessage(
          err.response?.data?.detail || 'Could not load navigation for this booking. Ensure it is a confirmed reservation.'
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initNavigation();

    return () => {
      isMounted = false;
    };
  }, [bookingId]);

  // 2. Subscribe to Simulation Location Provider stream
  useEffect(() => {
    locationProvider.start();
    const unsubscribe = locationProvider.subscribe((loc) => {
      setCurrentCoords({ x: loc.x, y: loc.y });
    });
    return () => {
      unsubscribe();
      locationProvider.stop();
    };
  }, [locationProvider]);

  // 3. Debounced Backend Location Synchronization & State Evaluation
  useEffect(() => {
    if (!session || loading) return;

    const timer = setTimeout(async () => {
      try {
        const updated = await navigationApi.updateLocation(
          session.session_id,
          currentCoords.x,
          currentCoords.y,
          'SIMULATION'
        );
        setNavigationState(updated.navigation_status);
        setStatusMessage(updated.status_message);
        setCurrentInstruction(updated.current_instruction);
        setRoute(updated.route);
        setRemainingDistance(updated.remaining_distance);
        setRemainingSteps(updated.remaining_steps);
        setIsTargetRowActive(updated.is_target_row_active);
        setIsSeatReached(updated.is_seat_reached);

        // Handle State Notifications (deduplicated)
        handleStateNotification(updated.navigation_status, updated.status_message);
      } catch (err) {
        console.error('Failed to update live navigation position:', err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [currentCoords.x, currentCoords.y, session]);

  // Directional Movement Handler (D-Pad & Keyboard Arrow Keys)
  const handleMove = (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    const step = 2.5;
    const result = locationProvider.moveDirection(direction, step);
    if (result.moved) {
      setCurrentCoords({ x: result.x, y: result.y });
    } else if (result.reason) {
      setToastMessage(result.reason);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Reset Location handler
  const handleResetLocation = () => {
    const entX = screenMap?.entrance?.x ?? 50.0;
    const entY = screenMap?.entrance?.y ?? 95.0;
    locationProvider.resetToEntrance(entX, entY);
    setCurrentCoords({ x: entX, y: entY });
    notifiedStatesRef.current.clear();
    setToastMessage('Location reset to Auditorium Entrance.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Checkpoint Jump handler
  const handleJumpTo = (x: number, y: number) => {
    locationProvider.setPosition(x, y);
    setCurrentCoords({ x, y });
  };

  // Dynamic Real-time Location Description
  const currentLocationDescription = useMemo(() => {
    if (!screenMap) return 'Auditorium Entrance';
    const x = currentCoords.x;
    const y = currentCoords.y;

    if (y >= 93.0) return 'Auditorium Main Entrance';
    if (y >= 85.0) return 'Rear Concourse Walkway';
    if (y <= 20.0) return 'Front Screen Concourse';

    if (Math.abs(x - 50.0) <= 6.0) return 'Central Main Aisle';
    if (x <= 12.0) return 'Left Side Aisle';
    if (x >= 88.0) return 'Right Side Aisle';

    if (screenMap.row_positions) {
      for (const [r, ry] of Object.entries(screenMap.row_positions)) {
        if (Math.abs(y - ry) <= 3.8) {
          return `Row ${r} Seating Lane`;
        }
      }
    }

    return 'Auditorium Walkway';
  }, [currentCoords, screenMap]);

  // 4. Keyboard Arrow Key Listener for D-Pad
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'ArrowUp') handleMove('UP');
        if (e.key === 'ArrowDown') handleMove('DOWN');
        if (e.key === 'ArrowLeft') handleMove('LEFT');
        if (e.key === 'ArrowRight') handleMove('RIGHT');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [locationProvider]);

  // Notification Handler (In-App Toast, Web Notifications & Vibration)
  const handleStateNotification = (state: NavigationState, message: string) => {
    if (notifiedStatesRef.current.has(state)) return;
    notifiedStatesRef.current.add(state);

    // Show In-app toast banner
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 5000);

    // Mobile Vibration API
    if (hapticsEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      if (state === 'SEAT_REACHED') {
        navigator.vibrate([200, 100, 200, 100, 300]);
      } else if (state === 'ENTERED_TARGET_ROW') {
        navigator.vibrate([150, 80, 150]);
      } else if (state === 'APPROACHING_ROW') {
        navigator.vibrate([100]);
      }
    }

    // Web Notification API (if permission granted)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('CineBook Seat Navigator', {
          body: message,
          icon: '/favicon.ico',
        });
      } catch (e) {
        console.log('Web notification trigger skipped');
      }
    }
  };

  // Request Web Notification permission
  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        alert('Notification permission granted! You will receive proximity alerts.');
      }
    }
  };

  // Switch target seat (for multi-seat bookings)
  const handleSwitchTargetSeat = async (seatId: number) => {
    if (!bookingInfo) return;
    setTargetSeatId(seatId);
    notifiedStatesRef.current.clear(); // Reset notification state for new target
    try {
      const newSession = await navigationApi.startSession(bookingInfo.booking_id, seatId);
      setSession(newSession);
      setRoute(newSession.route);
      setStatusMessage(newSession.status_message);
      setCurrentInstruction(newSession.current_instruction);
      setIsTargetRowActive(newSession.is_target_row_active);
      setIsSeatReached(newSession.is_seat_reached);
    } catch (err) {
      console.error('Failed to change target seat:', err);
    }
  };

  // Checkpoint Shortcuts dynamically based on target seat
  const checkpointShortcuts = useMemo(() => {
    if (!screenMap || !targetSeatId) return [];
    const seatObj = screenMap.seats.find((s) => s.id === targetSeatId);
    if (!seatObj) return [];

    const rowY = screenMap.row_positions[seatObj.row_label] || 57.0;
    const isRight = seatObj.seat_number > 5;

    return [
      { id: 'cp_entrance', label: '1. Entrance Gate', x: 50.0, y: 95.0, hint: 'Start' },
      { id: 'cp_aisle', label: '2. Central Aisle', x: 50.0, y: 89.0, hint: 'Concourse' },
      { id: 'cp_approach', label: `3. Near Row ${seatObj.row_label}`, x: 50.0, y: rowY + 4.0, hint: 'Row Proximity' },
      { id: 'cp_enter', label: `4. Inside Row ${seatObj.row_label}`, x: isRight ? 58.0 : 42.0, y: rowY, hint: 'Row Entered' },
      { id: 'cp_seat', label: `5. Seat ${seatObj.label}`, x: seatObj.x, y: rowY, hint: 'Arrival' },
    ];
  }, [screenMap, targetSeatId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-sm font-bold text-slate-300 tracking-wide font-['Outfit']">
          Calibrating Cinema Hall Blueprint...
        </div>
      </div>
    );
  }

  if (errorMessage || !bookingInfo || !screenMap) {
    return (
      <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-20 flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-950/40 border border-red-800 flex items-center justify-center text-red-400 mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Navigation Unavailable</h2>
          <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
            {errorMessage || 'Unable to load navigation data for this booking.'}
          </p>
          <Link
            to="/my-bookings"
            className="px-5 py-2.5 rounded-xl bg-orange-500 text-slate-950 font-bold text-xs"
          >
            Back to My Bookings
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const currentSeat = screenMap.seats.find((s) => s.id === targetSeatId);

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col pb-24">
      
      {/* 1. Header Bar */}
      <div className="bg-[#0e1117] border-b border-slate-800/90 py-3.5 sticky top-20 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          
          {/* Back & Hall Info */}
          <div className="flex items-center space-x-3">
            <Link
              to="/my-bookings"
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
              title="Return to My Bookings"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-extrabold text-white truncate max-w-[200px] sm:max-w-md">
                  {bookingInfo.movie_title}
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30">
                  {bookingInfo.screen_format}
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center space-x-2 mt-0.5">
                <span className="text-slate-300 font-semibold">{bookingInfo.theatre_name}</span>
                <span>•</span>
                <span className="text-orange-400 font-medium">{screenMap.screen_name}</span>
              </div>
            </div>
          </div>

          {/* Positioning Source Badge & BLE Info */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowBleInfoModal(true)}
              className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[11px] font-bold flex items-center space-x-1.5 transition-colors"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span className="hidden sm:inline">Demo Location Simulation</span>
              <span className="sm:hidden">Demo GPS</span>
              <Info className="w-3 h-3 text-sky-400/70" />
            </button>
          </div>

        </div>
      </div>

      {/* Floating In-App Toast Notification */}
      {toastMessage && (
        <div className="fixed top-36 inset-x-0 mx-auto w-11/12 max-w-md z-50 animate-bounce">
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-2xl flex items-center space-x-3 text-white">
            <Sparkles className="w-5 h-5 text-emerald-400 flex-shrink-0 animate-spin" />
            <div className="text-xs font-bold leading-snug">
              {toastMessage}
            </div>
          </div>
        </div>
      )}

      {/* Main Navigation Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col items-center space-y-6">
        
        {/* State Machine Status Panel */}
        <div className="w-full max-w-4xl bg-[#0e1117] rounded-2xl p-4 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          
          <div className="flex items-center space-x-3.5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-slate-950 font-black shadow-lg ${
              isSeatReached
                ? 'bg-gradient-to-tr from-amber-400 to-yellow-300 ring-2 ring-yellow-400'
                : isTargetRowActive
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 ring-2 ring-emerald-400'
                : 'bg-gradient-to-tr from-orange-500 to-amber-500 ring-2 ring-orange-400'
            }`}>
              {isSeatReached ? (
                <PartyPopper className="w-6 h-6 text-slate-950 animate-bounce" />
              ) : isTargetRowActive ? (
                <Check className="w-6 h-6 text-slate-950 stroke-[3]" />
              ) : (
                <Compass className="w-6 h-6 text-slate-950 animate-spin" />
              )}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full border ${
                  isSeatReached
                    ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                    : isTargetRowActive
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                }`}>
                  {navigationState.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  Target: <b className="text-white">Seat {currentSeat?.label}</b>
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-white mt-1">
                {statusMessage}
              </h2>
              <p className="text-xs text-orange-300/90 flex items-center gap-1 mt-0.5">
                <Navigation className="w-3 h-3 text-orange-400" />
                <span>{currentInstruction}</span>
              </p>
            </div>
          </div>

          {/* Metric Stats */}
          <div className="flex items-center space-x-4 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-6 w-full sm:w-auto justify-between sm:justify-start">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Distance</span>
              <span className="text-base font-black text-white font-mono">
                {remainingDistance} <span className="text-xs font-normal text-slate-500">meters</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Est. Walk</span>
              <span className="text-base font-black text-orange-400 font-mono">
                ~{remainingSteps} <span className="text-xs font-normal text-slate-500">steps</span>
              </span>
            </div>
          </div>

        </div>

        {/* Multi-seat switcher (if user booked multiple seats) */}
        {bookingInfo.booked_seats.length > 1 && (
          <div className="w-full max-w-4xl flex items-center space-x-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-xs">
            <span className="font-bold text-slate-400">Your Booked Seats:</span>
            <div className="flex flex-wrap gap-1.5">
              {bookingInfo.booked_seats.map((s) => (
                <button
                  key={s.seat_id}
                  onClick={() => handleSwitchTargetSeat(s.seat_id)}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                    targetSeatId === s.seat_id
                      ? 'bg-orange-500 text-slate-950 shadow-md font-black'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Seat {s.label} ({s.tier})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Real-Time Location Status Panel */}
        <div className="w-full max-w-4xl bg-[#0e1117] rounded-2xl p-4 border border-slate-800 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left: Position Coordinates & Location Description */}
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 flex-shrink-0">
                <MapPin className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Current Location:
                  </span>
                  <span className="text-xs font-black text-white bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                    {currentLocationDescription}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 font-mono text-xs">
                  <span className="text-sky-400 font-bold">
                    X: <span className="text-white">{currentCoords.x.toFixed(1)}</span>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-sky-400 font-bold">
                    Y: <span className="text-white">{currentCoords.y.toFixed(1)}</span>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">
                    Source: <span className="text-sky-300 font-semibold">Demo Simulation</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Navigation State Badge & Reset Location Button */}
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Nav State</span>
                <span className={`text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border inline-block ${
                  isSeatReached
                    ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                    : isTargetRowActive
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                }`}>
                  {navigationState.replace(/_/g, ' ')}
                </span>
              </div>

              <button
                onClick={handleResetLocation}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 hover:border-slate-600 text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md"
                title="Reset marker to auditorium entrance"
              >
                <RotateCcw className="w-3.5 h-3.5 text-orange-400" />
                <span>Reset Location</span>
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Cinema Blueprint Map */}
        <IndoorTheatreBlueprint
          screenMap={screenMap}
          targetSeatId={targetSeatId || bookingInfo.default_seat_id}
          currentX={currentCoords.x}
          currentY={currentCoords.y}
          navigationState={navigationState}
          route={route}
          isTargetRowActive={isTargetRowActive}
          onSelectCheckpoint={(cp) => handleJumpTo(cp.x, cp.y)}
          accessibilityMode={accessibilityMode}
        />

        {/* Simulation Controls Panel (D-Pad + Checkpoint Shortcuts) */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* Checkpoint Jump Simulation Shortcuts */}
          <div className="md:col-span-8 bg-[#0e1117] rounded-2xl p-5 border border-slate-800 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  <span>Checkpoint Simulation (Hackathon Quick Demo)</span>
                </h3>
                <span className="text-[10px] text-slate-400">Click to jump marker</span>
              </div>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Test the complete indoor state machine by clicking checkpoints from the auditorium entrance to your exact seat.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {checkpointShortcuts.map((cp) => (
                  <button
                    key={cp.id}
                    onClick={() => handleJumpTo(cp.x, cp.y)}
                    className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-orange-500/50 text-left transition-all flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-orange-300">
                        {cp.label}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Stage: {cp.hint}
                      </span>
                    </div>
                    <Compass className="w-4 h-4 text-slate-500 group-hover:text-orange-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                onClick={handleResetLocation}
                className="text-slate-400 hover:text-white flex items-center space-x-1 font-medium transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-orange-400" />
                <span>Reset to Entrance</span>
              </button>

              <button
                onClick={requestNotificationPermission}
                className="text-orange-400 hover:text-orange-300 font-semibold flex items-center space-x-1"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Enable Browser Alerts</span>
              </button>
            </div>
          </div>

          {/* Interactive D-Pad Directional Controls */}
          <div className="md:col-span-4 bg-[#0e1117] rounded-2xl p-5 border border-slate-800 shadow-xl flex flex-col items-center justify-center">
            <span className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-sky-400" />
              <span>Interactive Movement</span>
            </span>

            {/* 4-Way D-Pad Grid */}
            <div className="relative w-36 h-36 flex items-center justify-center bg-slate-950/80 rounded-full border border-slate-800 p-2 shadow-inner">
              
              {/* UP */}
              <button
                onClick={() => handleMove('UP')}
                className="absolute top-1 p-2 rounded-xl bg-slate-800 hover:bg-orange-500 active:bg-orange-600 text-slate-300 hover:text-slate-950 active:scale-95 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400"
                title="Walk Forward (ArrowUp)"
              >
                <ArrowUp className="w-5 h-5" />
              </button>

              {/* DOWN */}
              <button
                onClick={() => handleMove('DOWN')}
                className="absolute bottom-1 p-2 rounded-xl bg-slate-800 hover:bg-orange-500 active:bg-orange-600 text-slate-300 hover:text-slate-950 active:scale-95 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400"
                title="Walk Backward (ArrowDown)"
              >
                <ArrowDown className="w-5 h-5" />
              </button>

              {/* LEFT */}
              <button
                onClick={() => handleMove('LEFT')}
                className="absolute left-1 p-2 rounded-xl bg-slate-800 hover:bg-orange-500 active:bg-orange-600 text-slate-300 hover:text-slate-950 active:scale-95 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400"
                title="Turn Left (ArrowLeft)"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* RIGHT */}
              <button
                onClick={() => handleMove('RIGHT')}
                className="absolute right-1 p-2 rounded-xl bg-slate-800 hover:bg-orange-500 active:bg-orange-600 text-slate-300 hover:text-slate-950 active:scale-95 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400"
                title="Turn Right (ArrowRight)"
              >
                <ArrowRight className="w-5 h-5" />
              </button>

              {/* Center Dot */}
              <div className="w-4 h-4 rounded-full bg-sky-400 shadow-md shadow-sky-400/50"></div>
            </div>

            <span className="text-[10px] text-slate-500 mt-3 text-center">
              Use D-pad or keyboard arrow keys (↑ ↓ ← →)
            </span>
          </div>

        </div>

      </main>

      {/* BLE Architecture Modal */}
      {showBleInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1117] border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2 text-sky-400">
                <Radio className="w-5 h-5 animate-pulse" />
                <h3 className="text-base font-bold text-white">Indoor Positioning Architecture</h3>
              </div>
              <button
                onClick={() => setShowBleInfoModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                <b>Demo Mode:</b> This session is powered by the <code>SimulationLocationProvider</code>, allowing full interactive evaluation of the A* pathfinding, row detection state machine, and proximity notifications.
              </p>
              <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 space-y-1.5">
                <span className="font-bold text-white block">Future BLE Hardware Deployment:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400">
                  <li>iBeacons installed at entrance, central aisle crossways, and row entrances.</li>
                  <li>Native mobile app measures RSSI signals and computes trilateration coordinates.</li>
                  <li>Plugged directly into <code>BLELocationProvider</code> without rewriting any frontend navigation UI.</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowBleInfoModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

