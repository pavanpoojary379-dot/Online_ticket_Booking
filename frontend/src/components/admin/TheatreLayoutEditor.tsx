import React, { useState, useEffect } from 'react';
import {
  Building2,
  Tv,
  Layers,
  Sparkles,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Compass,
  ArrowRight,
  Info,
  Check,
  Split,
  Eye,
  Sliders,
  Maximize2
} from 'lucide-react';
import { adminApi, navigationApi } from '../../services/api';
import {
  TheatreAdminItem,
  ScreenLayoutDetail,
  ScreenLayoutConfig,
  SeatTier,
  ScreenMapData
} from '../../types';
import { IndoorTheatreBlueprint } from '../IndoorTheatreBlueprint';

export const TheatreLayoutEditor: React.FC = () => {
  // Theatres and screens list
  const [theatres, setTheatres] = useState<TheatreAdminItem[]>([]);
  const [selectedTheatreId, setSelectedTheatreId] = useState<number | null>(null);
  const [selectedScreenId, setSelectedScreenId] = useState<number | null>(null);
  const [screenDetail, setScreenDetail] = useState<ScreenLayoutDetail | null>(null);

  // Layout Configuration Form State
  const [screenName, setScreenName] = useState<string>('Screen 1');
  const [rows, setRows] = useState<string[]>(['A', 'B', 'C', 'D', 'E']);
  const [seatsPerRow, setSeatsPerRow] = useState<number>(6);
  const [aisleAfterSeat, setAisleAfterSeat] = useState<number>(3);
  const [sideAisles, setSideAisles] = useState<boolean>(true);
  const [screenPosition, setScreenPosition] = useState<'FRONT' | 'BACK'>('FRONT');
  const [entrancePosition, setEntrancePosition] = useState<'BACK_CENTER' | 'BACK_LEFT' | 'BACK_RIGHT'>('BACK_CENTER');
  const [customSeatOverrides, setCustomSeatOverrides] = useState<Record<string, { tier: SeatTier; is_accessible: boolean }>>({});

  // Loading & Feedback
  const [loadingTheatres, setLoadingTheatres] = useState<boolean>(true);
  const [loadingScreen, setLoadingScreen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals & Panels
  const [showNewTheatreModal, setShowNewTheatreModal] = useState<boolean>(false);
  const [showNewScreenModal, setShowNewScreenModal] = useState<boolean>(false);
  const [showClassroomGuide, setShowClassroomGuide] = useState<boolean>(false);
  const [activePreviewSeat, setActivePreviewSeat] = useState<string | null>('C4');

  // New Theatre Form
  const [newTheatreForm, setNewTheatreForm] = useState({
    name: '',
    city: 'Campus Auditorium',
    address: 'Seminar Hall 101 - Temporary Cinema Setup',
    formats: '2D,Classroom HD',
    is_demo: true,
    description: 'Temporary cinema arrangement for indoor seat navigation demonstration.'
  });

  // New Screen Form
  const [newScreenName, setNewScreenName] = useState('Screen 1');

  // 1. Fetch all theatres
  const fetchTheatres = async () => {
    setLoadingTheatres(true);
    try {
      const data = await adminApi.getTheatres();
      setTheatres(data);
      if (data.length > 0 && !selectedTheatreId) {
        setSelectedTheatreId(data[0].id);
        if (data[0].screens.length > 0) {
          setSelectedScreenId(data[0].screens[0].id);
        }
      }
    } catch (err: any) {
      console.error('Failed to load theatres:', err);
      setFeedbackMessage({ type: 'error', text: 'Could not load theatres.' });
    } finally {
      setLoadingTheatres(false);
    }
  };

  useEffect(() => {
    fetchTheatres();
  }, []);

  // 2. Fetch screen layout details when selectedScreenId changes
  useEffect(() => {
    if (!selectedScreenId) {
      setScreenDetail(null);
      return;
    }

    const loadScreenLayout = async () => {
      setLoadingScreen(true);
      setFeedbackMessage(null);
      try {
        const detail = await adminApi.getScreenLayout(selectedScreenId);
        setScreenDetail(detail);
        setScreenName(detail.screen_name);

        if (detail.layout_config) {
          const cfg = detail.layout_config;
          setRows(cfg.rows || ['A', 'B', 'C', 'D', 'E']);
          setSeatsPerRow(cfg.seats_per_row || 6);
          setAisleAfterSeat(cfg.aisle_after_seat ?? 3);
          setSideAisles(cfg.side_aisles ?? true);
          setScreenPosition(cfg.screen_position || 'FRONT');
          setEntrancePosition((cfg.entrance_position as any) || 'BACK_CENTER');

          // Build overrides map
          const overrides: Record<string, { tier: SeatTier; is_accessible: boolean }> = {};
          if (cfg.custom_seats) {
            cfg.custom_seats.forEach((cs) => {
              overrides[`${cs.row_label}${cs.seat_number}`] = {
                tier: cs.tier as SeatTier,
                is_accessible: cs.is_accessible ?? false
              };
            });
          }
          setCustomSeatOverrides(overrides);
        } else {
          // Default College Demo values if no custom layout exists yet
          setRows(['A', 'B', 'C', 'D', 'E']);
          setSeatsPerRow(6);
          setAisleAfterSeat(3);
          setSideAisles(true);
          setCustomSeatOverrides({});
        }
      } catch (err: any) {
        console.error('Failed to load screen layout:', err);
        setFeedbackMessage({ type: 'error', text: 'Failed to load screen layout configuration.' });
      } finally {
        setLoadingScreen(false);
      }
    };

    loadScreenLayout();
  }, [selectedScreenId]);

  // Handle theatre change
  const handleSelectTheatre = (theatreId: number) => {
    setSelectedTheatreId(theatreId);
    const th = theatres.find((t) => t.id === theatreId);
    if (th && th.screens.length > 0) {
      setSelectedScreenId(th.screens[0].id);
    } else {
      setSelectedScreenId(null);
      setScreenDetail(null);
    }
  };

  // Add / Remove Row
  const handleAddRow = () => {
    const nextChar = String.fromCharCode(65 + rows.length);
    if (rows.length < 15) {
      setRows([...rows, nextChar]);
    }
  };

  const handleRemoveRow = () => {
    if (rows.length > 1) {
      setRows(rows.slice(0, -1));
    }
  };

  // 1-Click Preset: College Demo Classroom
  const handleLoadClassroomPreset = async () => {
    setSaving(true);
    setFeedbackMessage(null);
    try {
      const res = await adminApi.setupCollegeDemoClassroom({
        theatre_name: 'College Demo Theatre',
        city: 'Campus Auditorium',
        address: 'Seminar Hall 101 - Temporary Cinema Setup',
        description: 'Physical classroom arrangement for indoor seat navigation demonstration.',
        screen_name: 'Screen 1',
        num_rows: 5,
        seats_per_row: 6,
        aisle_after_seat: 3
      });

      setFeedbackMessage({
        type: 'success',
        text: 'College Demo Classroom successfully configured (5 Rows x 6 Seats, Central Aisle)!'
      });

      // Reload theatres and select the demo theatre
      const allTheatres = await adminApi.getTheatres();
      setTheatres(allTheatres);
      setSelectedTheatreId(res.theatre_id);
      setSelectedScreenId(res.screen_id);
    } catch (err: any) {
      console.error('Preset creation error:', err);
      setFeedbackMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to apply College Demo Classroom preset.'
      });
    } finally {
      setSaving(false);
    }
  };

  // Toggle seat tier on canvas click
  const handleToggleSeatTier = (rowLabel: string, seatNum: number) => {
    const key = `${rowLabel}${seatNum}`;
    const currentTier = customSeatOverrides[key]?.tier || (rowLabel <= 'B' ? 'SILVER' : rowLabel <= 'D' ? 'GOLD' : 'PLATINUM');
    const isAcc = customSeatOverrides[key]?.is_accessible || false;

    let nextTier: SeatTier = 'SILVER';
    if (currentTier === 'SILVER') nextTier = 'GOLD';
    else if (currentTier === 'GOLD') nextTier = 'PLATINUM';
    else nextTier = 'SILVER';

    setCustomSeatOverrides({
      ...customSeatOverrides,
      [key]: { tier: nextTier, is_accessible: isAcc }
    });
  };

  // Save current layout to backend
  const handleSaveLayout = async () => {
    if (!selectedScreenId) return;
    setSaving(true);
    setFeedbackMessage(null);

    // Build custom seats list
    const custom_seats = [];
    for (const r of rows) {
      for (let s = 1; s <= seatsPerRow; s++) {
        const key = `${r}${s}`;
        const override = customSeatOverrides[key];
        const defaultTier: SeatTier = r <= 'B' ? 'SILVER' : r <= 'D' ? 'GOLD' : 'PLATINUM';
        custom_seats.push({
          row_label: r,
          seat_number: s,
          tier: override?.tier || defaultTier,
          is_accessible: override?.is_accessible || false
        });
      }
    }

    const layoutPayload: ScreenLayoutConfig = {
      rows,
      seats_per_row: seatsPerRow,
      aisle_after_seat: aisleAfterSeat,
      side_aisles: sideAisles,
      screen_position: screenPosition,
      entrance_position: entrancePosition,
      exit_position: 'FRONT_LEFT',
      custom_seats
    };

    try {
      await adminApi.saveScreenLayout(selectedScreenId, {
        screen_name: screenName,
        layout: layoutPayload
      });
      setFeedbackMessage({
        type: 'success',
        text: `Layout for "${screenName}" saved and synchronized with database successfully!`
      });

      // Refresh detail
      const updated = await adminApi.getScreenLayout(selectedScreenId);
      setScreenDetail(updated);
    } catch (err: any) {
      console.error('Save layout failed:', err);
      setFeedbackMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to save layout.'
      });
    } finally {
      setSaving(false);
    }
  };

  // Create new theatre
  const handleCreateTheatre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTheatreForm.name.trim()) return;

    try {
      const created = await adminApi.createTheatre(newTheatreForm);
      setShowNewTheatreModal(false);
      setNewTheatreForm({
        name: '',
        city: 'Campus Auditorium',
        address: 'Seminar Hall 101 - Temporary Cinema Setup',
        formats: '2D,Classroom HD',
        is_demo: true,
        description: 'Temporary cinema arrangement for indoor seat navigation demonstration.'
      });
      await fetchTheatres();
      setSelectedTheatreId(created.id);
    } catch (err: any) {
      console.error('Failed to create theatre:', err);
      alert(err.response?.data?.detail || 'Could not create theatre.');
    }
  };

  // Create new screen
  const handleCreateScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTheatreId || !newScreenName.trim()) return;

    try {
      const currentTh = theatres.find((t) => t.id === selectedTheatreId);
      const nextNum = (currentTh?.screens.length || 0) + 1;
      const created = await adminApi.createScreen(selectedTheatreId, nextNum, newScreenName, rows.length * seatsPerRow);
      setShowNewScreenModal(false);
      setNewScreenName(`Screen ${nextNum + 1}`);
      await fetchTheatres();
      setSelectedScreenId(created.id);
    } catch (err: any) {
      console.error('Failed to create screen:', err);
      alert(err.response?.data?.detail || 'Could not create screen.');
    }
  };

  const selectedTheatre = theatres.find((t) => t.id === selectedTheatreId);

  // Compute live SVG representation
  const totalSeatsCount = rows.length * seatsPerRow;
  const numRows = rows.length;

  return (
    <div className="space-y-6">
      {/* Top Header & Fast Preset Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#0e1117] p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-orange-500/30 text-orange-400">
              <Building2 className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-white font-['Outfit']">Theatre Layout Manager</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Indoor Navigation Architect
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-xl">
            Configure custom classroom seating blueprints, rows, seat numbers, and walkable central aisles for temporary seminar room cinema demos.
          </p>
        </div>

        {/* 1-Click College Demo Classroom Preset Button */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowClassroomGuide(!showClassroomGuide)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold flex items-center space-x-1.5 transition-colors"
          >
            <QrCode className="w-4 h-4 text-sky-400" />
            <span>Classroom Demo Guide</span>
          </button>

          <button
            onClick={handleLoadClassroomPreset}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:brightness-110 text-slate-950 font-black text-xs flex items-center space-x-2 shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
            title="1-Click Classroom Setup: 5 Rows x 6 Seats with Central Aisle"
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span>Load College Demo Classroom</span>
          </button>
        </div>
      </div>

      {/* Classroom Physical Setup Guide Card (Collapsible) */}
      {showClassroomGuide && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 p-5 rounded-2xl border border-sky-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <QrCode className="w-4 h-4 text-sky-400" />
              <span>Physical Seminar Room Demonstration Guide</span>
            </h3>
            <button
              onClick={() => setShowClassroomGuide(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕ Close Guide
            </button>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            To demonstrate CineBook Indoor Navigation in a physical college classroom or seminar room:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
              <div className="font-bold text-sky-400">1. Arrange Room Chairs</div>
              <p className="text-slate-400 text-[11px]">
                Arrange 5 rows (A to E) with 6 chairs per row. Leave a 1-meter walking gap in the middle between chair 3 and chair 4.
              </p>
            </div>
            <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
              <div className="font-bold text-orange-400">2. Entrance & Screen</div>
              <p className="text-slate-400 text-[11px]">
                Auditorium entrance door corresponds to the rear center (y=95). Presentation projector/whiteboard corresponds to front (y=7).
              </p>
            </div>
            <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
              <div className="font-bold text-emerald-400">3. Target Seat: C4</div>
              <p className="text-slate-400 text-[11px]">
                Seat C4 is on Row 3, immediately to the right of the central aisle. The customer walks straight down the aisle and turns right.
              </p>
            </div>
            <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
              <div className="font-bold text-amber-400">4. QR Checkpoints</div>
              <p className="text-slate-400 text-[11px]">
                Optional paper QR checkpoints can be placed at door, aisle, and chair to simulate positioning updates during live presentation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Messages */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl flex items-center space-x-3 text-xs font-bold ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Main Layout Grid: Left Sidebar Controls + Right Visual Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Theatre & Screen Selector + Layout Config Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Box 1: Theatre & Screen Selection */}
          <div className="bg-[#0e1117] p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center">
                <Building2 className="w-3.5 h-3.5 mr-1 text-orange-400" />
                Select Theatre
              </span>
              <button
                onClick={() => setShowNewTheatreModal(true)}
                className="text-[11px] text-orange-400 hover:text-orange-300 font-bold flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>New Theatre</span>
              </button>
            </div>

            <div className="space-y-2">
              <select
                value={selectedTheatreId || ''}
                onChange={(e) => handleSelectTheatre(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
              >
                {theatres.map((th) => (
                  <option key={th.id} value={th.id}>
                    {th.name} ({th.city}) {th.is_demo ? '⚡ [Demo Theatre]' : ''}
                  </option>
                ))}
              </select>

              {selectedTheatre && (
                <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/80 text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-semibold">{selectedTheatre.address}</span>
                    {selectedTheatre.is_demo && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        Demo Mode
                      </span>
                    )}
                  </div>
                  {selectedTheatre.description && (
                    <p className="text-slate-400 text-[10px] italic">{selectedTheatre.description}</p>
                  )}
                </div>
              )}
            </div>

            {/* Screens dropdown */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center">
                  <Tv className="w-3.5 h-3.5 mr-1 text-sky-400" />
                  Select Screen / Classroom
                </span>
                <button
                  onClick={() => setShowNewScreenModal(true)}
                  className="text-[11px] text-sky-400 hover:text-sky-300 font-bold flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Screen</span>
                </button>
              </div>

              {selectedTheatre && selectedTheatre.screens.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedTheatre.screens.map((scr) => (
                    <button
                      key={scr.id}
                      onClick={() => setSelectedScreenId(scr.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                        selectedScreenId === scr.id
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md shadow-orange-500/20'
                          : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span>{scr.name}</span>
                      <span className="text-[10px] opacity-75 font-mono">({scr.total_seats} seats)</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No screens found. Click "+ New Screen" or use College Demo preset.</p>
              )}
            </div>
          </div>

          {/* Box 2: Visual Seating Configuration Controls */}
          <div className="bg-[#0e1117] p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center">
              <Sliders className="w-4 h-4 mr-1.5 text-orange-400" />
              Auditorium Blueprint Builder
            </h3>

            {/* Screen Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">Auditorium / Screen Name</label>
              <input
                type="text"
                value={screenName}
                onChange={(e) => setScreenName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 font-bold"
                placeholder="e.g. Screen 1 or Seminar Hall 101"
              />
            </div>

            {/* Rows Config */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Seating Rows ({rows.length})</span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={handleRemoveRow}
                    disabled={rows.length <= 1}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30"
                    title="Remove back row"
                  >
                    -
                  </button>
                  <button
                    onClick={handleAddRow}
                    disabled={rows.length >= 12}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30"
                    title="Add new row"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950 rounded-xl border border-slate-800">
                {rows.map((r, i) => (
                  <span
                    key={r}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono font-bold text-xs"
                  >
                    Row {r}
                  </span>
                ))}
              </div>
            </div>

            {/* Seats Per Row */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Chairs / Seats Per Row</span>
                <span className="font-bold text-orange-400 font-mono">{seatsPerRow} chairs</span>
              </div>
              <input
                type="range"
                min={2}
                max={14}
                value={seatsPerRow}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSeatsPerRow(val);
                  if (aisleAfterSeat >= val) {
                    setAisleAfterSeat(Math.floor(val / 2));
                  }
                }}
                className="w-full accent-orange-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>2 (Intimate)</span>
                <span>6 (Classroom Std)</span>
                <span>10 (Cinema Std)</span>
                <span>14 (Large Hall)</span>
              </div>
            </div>

            {/* Central Aisle Split Point */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center">
                  <Split className="w-3.5 h-3.5 mr-1 text-sky-400" />
                  Central Walking Aisle Split
                </span>
                <span className="font-bold text-sky-400 font-mono">
                  Between Seat {aisleAfterSeat} & {aisleAfterSeat + 1}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={Math.max(1, seatsPerRow - 1)}
                value={aisleAfterSeat}
                onChange={(e) => setAisleAfterSeat(Number(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-400">
                Left wing: Seats 1 to {aisleAfterSeat} | Walking Aisle | Right wing: Seats {aisleAfterSeat + 1} to {seatsPerRow}
              </p>
            </div>

            {/* Walkway Toggles & Screen Orientation */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">Side Aisles</label>
                <button
                  type="button"
                  onClick={() => setSideAisles(!sideAisles)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                    sideAisles
                      ? 'bg-sky-950/40 border-sky-500/40 text-sky-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <span>{sideAisles ? 'Included' : 'None'}</span>
                  {sideAisles && <Check className="w-3.5 h-3.5 text-sky-400" />}
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">Screen Position</label>
                <div className="py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300">
                  Front of Room (Top)
                </div>
              </div>
            </div>

            {/* Entrance Placement */}
            <div className="space-y-1 pt-1">
              <label className="text-[10px] text-slate-400 uppercase font-bold">Auditorium Entrance</label>
              <select
                value={entrancePosition}
                onChange={(e) => setEntrancePosition(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
              >
                <option value="BACK_CENTER">Rear Center Doors (x=50, y=95)</option>
                <option value="BACK_LEFT">Rear Left Doors (x=10, y=95)</option>
                <option value="BACK_RIGHT">Rear Right Doors (x=90, y=95)</option>
              </select>
            </div>

            {/* Total count summary */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Total Configured Capacity:</span>
              <span className="font-mono font-black text-amber-400 text-sm">
                {totalSeatsCount} Seats ({rows.length} rows × {seatsPerRow} chairs)
              </span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={handleSaveLayout}
                disabled={saving || !selectedScreenId}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-slate-950 font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-orange-500/20 disabled:opacity-50 cursor-pointer transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save & Sync Layout'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Real-Time Blueprint Preview (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#0e1117] p-5 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
            
            {/* Canvas Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-orange-400" />
                  <span>Interactive Classroom Blueprint</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Live Top-View
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Click any chair to cycle tier (<span className="text-slate-300">Silver</span> → <span className="text-amber-400">Gold</span> → <span className="text-sky-400">Platinum</span>).
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center space-x-3 text-[10px] font-bold">
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-700 inline-block"></span>
                  <span className="text-slate-400">Silver</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block"></span>
                  <span className="text-amber-400">Gold</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block"></span>
                  <span className="text-sky-400">Platinum</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-orange-500 inline-block"></span>
                  <span className="text-orange-400">Target (C4)</span>
                </div>
              </div>
            </div>

            {/* Visual SVG Editor Canvas */}
            <div className="relative w-full aspect-[4/3] bg-[#07090e] rounded-2xl border border-slate-800 overflow-hidden p-2 select-none">
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
                <defs>
                  <pattern id="editorAisleGrid" width="4" height="4" patternUnits="userSpaceOnUse">
                    <path d="M 0 4 L 4 0" stroke="#1e293b" strokeWidth="0.3" strokeOpacity="0.4" />
                  </pattern>
                  <linearGradient id="editorScreenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.1" />
                    <stop offset="50%" stopColor="#f97316" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0.1" />
                  </linearGradient>
                </defs>

                {/* Outer Room Walls */}
                <rect x="3" y="4" width="94" height="93" rx="4" fill="#080a0f" stroke="#1e293b" strokeWidth="0.8" />

                {/* 1. Walkable Aisles */}
                {/* Central Aisle */}
                <rect x="46" y="15" width="8" height="75" fill="url(#editorAisleGrid)" rx="1.5" />
                <line x1="50" y1="15" x2="50" y2="90" stroke="#334155" strokeWidth="0.4" strokeDasharray="1 1.5" />

                {/* Side Aisles */}
                {sideAisles && (
                  <>
                    <rect x="6" y="15" width="6" height="75" fill="url(#editorAisleGrid)" rx="1" />
                    <rect x="88" y="15" width="6" height="75" fill="url(#editorAisleGrid)" rx="1" />
                  </>
                )}

                {/* Front Cross Aisle */}
                <rect x="6" y="13" width="88" height="5" fill="url(#editorAisleGrid)" rx="1" />
                {/* Rear Concourse */}
                <rect x="6" y="87" width="88" height="6" fill="url(#editorAisleGrid)" rx="1.5" />

                {/* 2. Screen at Front */}
                <path d="M 16 10 Q 50 4 84 10" stroke="url(#editorScreenGrad)" strokeWidth="2.0" fill="none" strokeLinecap="round" />
                <text x="50" y="8" textAnchor="middle" fill="#94a3b8" fontSize="2.2" fontWeight="900" letterSpacing="0.4">
                  {screenPosition === 'FRONT' ? 'WHITEBOARD / SCREEN' : 'SCREEN'}
                </text>

                {/* 3. Entrance Marker */}
                <g className="entrance-marker">
                  <rect
                    x={entrancePosition === 'BACK_LEFT' ? 5 : entrancePosition === 'BACK_RIGHT' ? 81 : 42}
                    y="93"
                    width="16"
                    height="4"
                    rx="1.5"
                    fill="#0f172a"
                    stroke="#f97316"
                    strokeWidth="0.6"
                  />
                  <text
                    x={entrancePosition === 'BACK_LEFT' ? 13 : entrancePosition === 'BACK_RIGHT' ? 89 : 50}
                    y="95.8"
                    textAnchor="middle"
                    fill="#f97316"
                    fontSize="1.9"
                    fontWeight="900"
                  >
                    ▼ ENTRANCE
                  </text>
                </g>

                {/* 4. Emergency Exit */}
                <rect x="5" y="11" width="11" height="3.2" rx="1" fill="#064e3b" stroke="#10b981" strokeWidth="0.4" />
                <text x="10.5" y="13.2" textAnchor="middle" fill="#34d399" fontSize="1.5" fontWeight="bold">
                  EXIT ◄
                </text>

                {/* 5. Seating Grid */}
                {rows.map((rowChar, rIdx) => {
                  const yPos = numRows <= 1 ? 54 : 24 + rIdx * ((84 - 24) / (numRows - 1));
                  const isRowC = rowChar === 'C';

                  return (
                    <g key={rowChar}>
                      {/* Left Row Label */}
                      <text x="2.5" y={yPos + 1.0} textAnchor="middle" fill="#64748b" fontSize="2.6" fontWeight="bold">
                        {rowChar}
                      </text>
                      {/* Right Row Label */}
                      <text x="97.5" y={yPos + 1.0} textAnchor="middle" fill="#64748b" fontSize="2.6" fontWeight="bold">
                        {rowChar}
                      </text>

                      {/* Chairs in this row */}
                      {Array.from({ length: seatsPerRow }).map((_, sIdx) => {
                        const seatNum = sIdx + 1;
                        const label = `${rowChar}${seatNum}`;
                        const isLeftWing = seatNum <= aisleAfterSeat;
                        const leftCount = aisleAfterSeat;
                        const rightCount = seatsPerRow - aisleAfterSeat;

                        // Calculate X position
                        let xPos = 50;
                        if (isLeftWing) {
                          const lMin = sideAisles ? 16 : 10;
                          const lMax = 42;
                          xPos = leftCount <= 1 ? (lMin + lMax) / 2 : lMin + ((seatNum - 1) / (leftCount - 1)) * (lMax - lMin);
                        } else {
                          const rMin = 58;
                          const rMax = sideAisles ? 84 : 90;
                          const rightIdx = seatNum - leftCount;
                          xPos = rightCount <= 1 ? (rMin + rMax) / 2 : rMin + ((rightIdx - 1) / (rightCount - 1)) * (rMax - rMin);
                        }

                        // Tier
                        const override = customSeatOverrides[label];
                        const defaultTier: SeatTier = rowChar <= 'B' ? 'SILVER' : rowChar <= 'D' ? 'GOLD' : 'PLATINUM';
                        const tier = override?.tier || defaultTier;
                        const isTargetC4 = label === 'C4';

                        let fillColor = '#1e293b';
                        let strokeColor = '#334155';
                        let textColor = '#cbd5e1';

                        if (isTargetC4) {
                          fillColor = '#ea580c';
                          strokeColor = '#fb923c';
                          textColor = '#ffffff';
                        } else if (tier === 'PLATINUM') {
                          fillColor = '#0369a1';
                          strokeColor = '#38bdf8';
                        } else if (tier === 'GOLD') {
                          fillColor = '#b45309';
                          strokeColor = '#fbbf24';
                        }

                        return (
                          <g
                            key={label}
                            onClick={() => handleToggleSeatTier(rowChar, seatNum)}
                            className="cursor-pointer transition-transform hover:scale-125"
                          >
                            <rect
                              x={xPos - 1.8}
                              y={yPos - 1.7}
                              width="3.6"
                              height="3.4"
                              rx="0.8"
                              fill={fillColor}
                              stroke={strokeColor}
                              strokeWidth={isTargetC4 ? 0.8 : 0.3}
                            />
                            <text
                              x={xPos}
                              y={yPos + 0.8}
                              textAnchor="middle"
                              fill={textColor}
                              fontSize="1.6"
                              fontWeight="bold"
                            >
                              {seatNum}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })}

                {/* Simulated A* Route overlay to Seat C4 */}
                <g className="route-preview opacity-80 pointer-events-none">
                  <polyline
                    points="50,95 50,89 50,54 55,54 58,54"
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="0.8"
                    strokeDasharray="1.2 1"
                  />
                  <circle cx="50" cy="95" r="1.2" fill="#38bdf8" />
                  <circle cx="58" cy="54" r="1.5" fill="#f97316" />
                </g>
              </svg>
            </div>

            {/* Live Blueprint Validation Info Bar */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Valid Blueprint • Central Walkway Clear • Zero Obstacles</span>
              </div>
              <div className="text-slate-400 font-mono text-[11px]">
                Target Demo Seat: <span className="text-orange-400 font-bold">Row C, Chair 4 (x=58.0, y=54.0)</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Modal: New Theatre */}
      {showNewTheatreModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1117] rounded-3xl border border-slate-800 max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-orange-400" />
                <span>Create New Cinema / Seminar Hall</span>
              </h3>
              <button
                onClick={() => setShowNewTheatreModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTheatre} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Theatre / Hall Name *</label>
                <input
                  type="text"
                  required
                  value={newTheatreForm.name}
                  onChange={(e) => setNewTheatreForm({ ...newTheatreForm, name: e.target.value })}
                  placeholder="e.g. College Demo Theatre or Inox Forum"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">City / Campus *</label>
                  <input
                    type="text"
                    required
                    value={newTheatreForm.city}
                    onChange={(e) => setNewTheatreForm({ ...newTheatreForm, city: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Formats</label>
                  <input
                    type="text"
                    value={newTheatreForm.formats}
                    onChange={(e) => setNewTheatreForm({ ...newTheatreForm, formats: e.target.value })}
                    placeholder="2D,3D,Classroom"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Address / Location Description *</label>
                <input
                  type="text"
                  required
                  value={newTheatreForm.address}
                  onChange={(e) => setNewTheatreForm({ ...newTheatreForm, address: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="is_demo_toggle"
                  checked={newTheatreForm.is_demo}
                  onChange={(e) => setNewTheatreForm({ ...newTheatreForm, is_demo: e.target.checked })}
                  className="w-4 h-4 accent-orange-500 rounded"
                />
                <label htmlFor="is_demo_toggle" className="text-slate-300 font-semibold cursor-pointer">
                  Mark as Demo Theatre (Classroom Simulation Setup)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewTheatreModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-bold"
                >
                  Create Theatre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Screen */}
      {showNewScreenModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1117] rounded-3xl border border-slate-800 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Tv className="w-5 h-5 text-sky-400" />
                <span>Create Screen</span>
              </h3>
              <button
                onClick={() => setShowNewScreenModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateScreen} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Screen Name *</label>
                <input
                  type="text"
                  required
                  value={newScreenName}
                  onChange={(e) => setNewScreenName(e.target.value)}
                  placeholder="e.g. Screen 2 or Seminar Room A"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewScreenModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold"
                >
                  Create Screen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
