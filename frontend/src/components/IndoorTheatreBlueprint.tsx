import React from 'react';
import { ScreenMapData, SeatCoordinateItem, NavigationState } from '../types';
import { Compass, Sparkles, Navigation2, Star, Accessibility, LogIn, LogOut, Check } from 'lucide-react';

interface IndoorTheatreBlueprintProps {
  screenMap: ScreenMapData;
  targetSeatId: number;
  currentX: number;
  currentY: number;
  navigationState: NavigationState;
  route: { x: number; y: number }[];
  isTargetRowActive: boolean;
  onSelectCheckpoint?: (checkpoint: { x: number; y: number; label: string }) => void;
  onSeatClick?: (seat: SeatCoordinateItem) => void;
  accessibilityMode?: boolean;
}

export const IndoorTheatreBlueprint: React.FC<IndoorTheatreBlueprintProps> = ({
  screenMap,
  targetSeatId,
  currentX,
  currentY,
  navigationState,
  route,
  isTargetRowActive,
  onSelectCheckpoint,
  onSeatClick,
  accessibilityMode = false,
}) => {
  const targetSeat = screenMap.seats.find((s) => s.id === targetSeatId);
  const targetRow = targetSeat ? targetSeat.row_label : '';

  // Generate SVG polyline points string from route array
  const routePointsString = route.map((pt) => `${pt.x},${pt.y}`).join(' ');

  return (
    <div className="w-full max-w-4xl bg-gradient-to-b from-[#0b0e14] via-[#090b10] to-[#0d1017] rounded-3xl p-4 sm:p-8 border border-slate-800 shadow-2xl relative select-none overflow-hidden">
      
      {/* Background ambient lighting */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-orange-500/10 via-orange-500/5 to-transparent blur-2xl pointer-events-none"></div>

      {/* SVG Theatre Blueprint Map */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/11] max-h-[580px]">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full overflow-visible drop-shadow-md"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Screen Gradient */}
            <linearGradient id="screenArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#f97316" stopOpacity="1" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.2" />
            </linearGradient>

            {/* Aisle Path Pattern */}
            <pattern id="aisleGrid" width="4" height="4" patternUnits="userSpaceOnUse">
              <path d="M 0 4 L 4 0" stroke="#1e293b" strokeWidth="0.3" strokeOpacity="0.4" />
            </pattern>

            {/* User Location Pulse Filter */}
            <filter id="sonarGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#38bdf8" floodOpacity="0.9" />
            </filter>

            {/* Target Seat Glow */}
            <filter id="targetSeatGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#f97316" floodOpacity="0.9" />
            </filter>
          </defs>

          {/* 1. Auditorium Outer Walls */}
          <rect
            x="3"
            y="4"
            width="94"
            height="93"
            rx="5"
            fill="#080a0f"
            stroke="#1e293b"
            strokeWidth="0.8"
          />

          {/* 2. Walkable Aisle Surfaces */}
          {screenMap.aisles && screenMap.aisles.length > 0 ? (
            screenMap.aisles.map((aisle) => {
              if (aisle.type === 'VERTICAL') {
                const w = aisle.width || 8;
                const ax = aisle.x !== undefined ? aisle.x - w / 2 : 46;
                const y1 = aisle.y1 !== undefined ? aisle.y1 : 16;
                const y2 = aisle.y2 !== undefined ? aisle.y2 : 89;
                return (
                  <rect
                    key={aisle.id}
                    x={ax}
                    y={y1}
                    width={w}
                    height={Math.max(1, y2 - y1)}
                    fill="url(#aisleGrid)"
                    rx="1.5"
                  />
                );
              } else {
                const h = aisle.height || 6;
                const ay = aisle.y !== undefined ? aisle.y - h / 2 : 86;
                const x1 = aisle.x1 !== undefined ? aisle.x1 : 6;
                const x2 = aisle.x2 !== undefined ? aisle.x2 : 94;
                return (
                  <rect
                    key={aisle.id}
                    x={x1}
                    y={ay}
                    width={Math.max(1, x2 - x1)}
                    height={h}
                    fill="url(#aisleGrid)"
                    rx="1.5"
                  />
                );
              }
            })
          ) : (
            <>
              {/* Central Aisle */}
              <rect x="46" y="16" width="8" height="73" fill="url(#aisleGrid)" rx="1.5" />
              {/* Left Aisle */}
              <rect x="6" y="16" width="6" height="73" fill="url(#aisleGrid)" rx="1" />
              {/* Right Aisle */}
              <rect x="88" y="16" width="6" height="73" fill="url(#aisleGrid)" rx="1" />
              {/* Front Cross Aisle */}
              <rect x="6" y="13" width="88" height="6" fill="url(#aisleGrid)" rx="1" />
              {/* Rear Cross Concourse */}
              <rect x="6" y="86" width="88" height="7" fill="url(#aisleGrid)" rx="1.5" />
            </>
          )}

          {/* Aisle Guide Centerlines */}
          <line x1="50" y1="16" x2="50" y2="89" stroke="#334155" strokeWidth="0.3" strokeDasharray="1 1.5" />
          <line x1="9" y1="16" x2="9" y2="89" stroke="#334155" strokeWidth="0.3" strokeDasharray="1 1.5" />
          <line x1="91" y1="16" x2="91" y2="89" stroke="#334155" strokeWidth="0.3" strokeDasharray="1 1.5" />

          {/* 3. Screen Projection Arc (Top) */}
          <g className="screen-header">
            {/* Screen Glow Beam */}
            <path
              d="M 18 10 L 32 30 L 68 30 L 82 10 Z"
              fill="url(#screenArcGrad)"
              opacity="0.08"
            />
            {/* Curved Screen Line */}
            <path
              d="M 16 10 Q 50 4 84 10"
              stroke="url(#screenArcGrad)"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
            />
            <text
              x="50"
              y="8"
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="2.4"
              fontWeight="900"
              letterSpacing="0.4"
            >
              {screenMap.screen_element?.label ? screenMap.screen_element.label.toUpperCase() : 'CINEMA SCREEN'}
            </text>
          </g>

          {/* 4. Target Row Highlight (Turns GREEN when approached or entered) */}
          {targetRow && screenMap.row_positions[targetRow] && (
            <g className="target-row-highlight transition-all duration-300">
              <rect
                x="4.5"
                y={screenMap.row_positions[targetRow] - 3.2}
                width="91"
                height="6.4"
                rx="3.2"
                fill={isTargetRowActive ? '#064e3b' : '#1e293b'}
                fillOpacity={isTargetRowActive ? 0.45 : 0.15}
                stroke={isTargetRowActive ? '#10b981' : '#334155'}
                strokeWidth={isTargetRowActive ? 0.9 : 0.3}
                strokeDasharray={isTargetRowActive ? 'none' : '1.5 1'}
              />
              {isTargetRowActive && (
                <text
                  x="50"
                  y={screenMap.row_positions[targetRow] + 0.8}
                  textAnchor="middle"
                  fill="#34d399"
                  fontSize="2.2"
                  fontWeight="bold"
                  opacity="0.3"
                  letterSpacing="0.6"
                >
                  TARGET ROW {targetRow}
                </text>
              )}
            </g>
          )}

          {/* 5. Row Labels & Seats */}
          {screenMap.rows.map((rowChar) => {
            const yPos = screenMap.row_positions[rowChar];
            const isTargetRow = rowChar === targetRow;

            return (
              <g key={rowChar} className="row-group">
                {/* Left Row Label */}
                <text
                  x="2.5"
                  y={yPos + 0.9}
                  textAnchor="middle"
                  fill={isTargetRow && isTargetRowActive ? '#34d399' : isTargetRow ? '#f97316' : '#64748b'}
                  fontSize="2.8"
                  fontWeight="900"
                >
                  {rowChar}
                </text>

                {/* Right Row Label */}
                <text
                  x="97.5"
                  y={yPos + 0.9}
                  textAnchor="middle"
                  fill={isTargetRow && isTargetRowActive ? '#34d399' : isTargetRow ? '#f97316' : '#64748b'}
                  fontSize="2.8"
                  fontWeight="900"
                >
                  {rowChar}
                </text>
              </g>
            );
          })}

          {/* 6. Individual Seats */}
          {screenMap.seats.map((seat) => {
            const isTarget = seat.id === targetSeatId;
            const isUserBooked = seat.is_booked_by_user;
            const isRowHighlighted = seat.row_label === targetRow && isTargetRowActive;

            // Seat styling
            let fillColor = '#1e293b'; // Default Grey / Slate
            let strokeColor = '#334155';
            let strokeWidth = 0.3;
            let textColor = '#cbd5e1';

            if (isTarget) {
              // Orange target seat
              fillColor = '#ea580c';
              strokeColor = '#fb923c';
              strokeWidth = 0.8;
              textColor = '#090a0f';
            } else if (isUserBooked) {
              // Secondary booked seat by user
              fillColor = '#c2410c';
              strokeColor = '#f97316';
              textColor = '#ffffff';
            } else if (isRowHighlighted) {
              // Green target row seats
              fillColor = '#065f46';
              strokeColor = '#10b981';
              textColor = '#a7f3d0';
            } else if (seat.tier === 'PLATINUM') {
              fillColor = '#0f172a';
              strokeColor = '#38bdf8';
              textColor = '#94a3b8';
            } else if (seat.tier === 'GOLD') {
              fillColor = '#18181b';
              strokeColor = '#fbbf24';
              textColor = '#94a3b8';
            }

            return (
              <g
                key={seat.id}
                onClick={() => onSeatClick && onSeatClick(seat)}
                className="cursor-pointer transition-transform hover:scale-110"
              >
                {/* Target Seat Pulsating Ring */}
                {isTarget && (
                  <circle
                    cx={seat.x}
                    cy={seat.y}
                    r="4.0"
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="0.7"
                    strokeOpacity="0.8"
                    className="animate-pulse"
                  />
                )}

                {/* Seat Cushion Rect */}
                <rect
                  x={seat.x - 1.8}
                  y={seat.y - 1.7}
                  width="3.6"
                  height="3.4"
                  rx="0.9"
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  filter={isTarget ? 'url(#targetSeatGlow)' : undefined}
                />

                {/* Seat Number */}
                <text
                  x={seat.x}
                  y={seat.y + 0.8}
                  textAnchor="middle"
                  fill={textColor}
                  fontSize="1.7"
                  fontWeight={isTarget ? '900' : 'bold'}
                >
                  {seat.seat_number}
                </text>

                {/* Accessible Icon Badge */}
                {seat.is_accessible && (
                  <circle
                    cx={seat.x + 1.4}
                    cy={seat.y - 1.3}
                    r="0.7"
                    fill="#38bdf8"
                  />
                )}
              </g>
            );
          })}

          {/* 7. Navigation Pathway Polyline */}
          {route.length > 1 && (
            <g className="navigation-route">
              {/* Route Background Glow */}
              <polyline
                points={routePointsString}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.8"
                strokeOpacity="0.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Route Animated Dashed Line */}
              <polyline
                points={routePointsString}
                fill="none"
                stroke="#f97316"
                strokeWidth="0.9"
                strokeDasharray="1.5 1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-pulse"
              />
              {/* Route Step Waypoint Dots */}
              {route.map((pt, idx) => (
                <circle
                  key={idx}
                  cx={pt.x}
                  cy={pt.y}
                  r="0.7"
                  fill="#fbbf24"
                  opacity="0.9"
                />
              ))}
            </g>
          )}

          {/* 8. Entrance Marker */}
          {(() => {
            const entX = screenMap.entrance?.x ?? 50;
            const entY = screenMap.entrance?.y ?? 95;
            const entW = screenMap.entrance?.width ?? 16;
            const entH = screenMap.entrance?.height ?? 4;
            const entLabel = screenMap.entrance?.label || 'MAIN ENTRANCE';
            return (
              <g className="auditorium-entrance">
                <rect
                  x={entX - entW / 2}
                  y={entY - entH / 2}
                  width={entW}
                  height={entH}
                  rx="1.5"
                  fill="#0f172a"
                  stroke="#f97316"
                  strokeWidth="0.6"
                />
                <text
                  x={entX}
                  y={entY + 0.8}
                  textAnchor="middle"
                  fill="#f97316"
                  fontSize="2.0"
                  fontWeight="900"
                  letterSpacing="0.2"
                >
                  ▼ {entLabel.toUpperCase()}
                </text>
              </g>
            );
          })()}

          {/* 9. Emergency Exit Marker */}
          {(() => {
            const exX = screenMap.exit?.x ?? 8;
            const exY = screenMap.exit?.y ?? 16;
            const exW = screenMap.exit?.width ?? 11;
            const exH = screenMap.exit?.height ?? 3.5;
            const exLabel = screenMap.exit?.label || 'EXIT ◄';
            return (
              <g className="emergency-exit">
                <rect
                  x={exX - exW / 2}
                  y={exY - exH / 2}
                  width={exW}
                  height={exH}
                  rx="1"
                  fill="#064e3b"
                  stroke="#10b981"
                  strokeWidth="0.4"
                />
                <text
                  x={exX}
                  y={exY + 0.8}
                  textAnchor="middle"
                  fill="#34d399"
                  fontSize="1.6"
                  fontWeight="bold"
                >
                  {exLabel.toUpperCase()}
                </text>
              </g>
            );
          })()}

          {/* 10. Interactive Checkpoint Dots */}
          {screenMap.checkpoints.map((cp) => (
            <g
              key={cp.id}
              onClick={() => onSelectCheckpoint && onSelectCheckpoint(cp)}
              className="cursor-pointer group"
            >
              <circle
                cx={cp.x}
                cy={cp.y}
                r="1.2"
                fill="#38bdf8"
                fillOpacity="0.4"
                stroke="#38bdf8"
                strokeWidth="0.4"
              />
            </g>
          ))}

          {/* 11. Topmost Blue User Location Marker (Sonar Beacon) */}
          <g className="user-location-marker pointer-events-none transition-all duration-150 ease-out">
            {/* Outer Pulsing Sonar Ring */}
            <circle
              cx={currentX}
              cy={currentY}
              r="5.5"
              fill="#0284c7"
              fillOpacity="0.25"
              className="animate-pulse"
            />
            {/* Middle Glow Ring */}
            <circle
              cx={currentX}
              cy={currentY}
              r="3.4"
              fill="#0ea5e9"
              fillOpacity="0.45"
            />
            {/* High-Contrast Core Blue Dot */}
            <circle
              cx={currentX}
              cy={currentY}
              r="2.0"
              fill="#38bdf8"
              stroke="#ffffff"
              strokeWidth="0.8"
              filter="url(#sonarGlow)"
            />
            {/* Center Heading Pointer Arrow */}
            <polygon
              points={`${currentX},${currentY - 1.3} ${currentX - 0.9},${currentY + 0.8} ${currentX + 0.9},${currentY + 0.8}`}
              fill="#ffffff"
            />
          </g>
        </svg>
      </div>

      {/* Blueprint Legend */}
      <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-[11px] text-slate-400">
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 rounded-full bg-sky-400 ring-2 ring-sky-400/30 animate-pulse"></div>
          <span className="text-white font-semibold">You (Blue Location)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 rounded bg-orange-600 ring-2 ring-orange-500/40"></div>
          <span className="text-orange-400 font-bold">Booked Seat ({targetSeat?.label || 'Target'})</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 rounded bg-emerald-600/80 ring-1 ring-emerald-400"></div>
          <span className="text-emerald-400 font-semibold">Target Row (Turns Green)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 rounded bg-slate-800 border border-slate-700"></div>
          <span>Other Seats (Grey)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-4 h-0.5 bg-orange-500 border-b border-dashed border-yellow-300"></div>
          <span>Suggested Path</span>
        </div>
      </div>

    </div>
  );
};

