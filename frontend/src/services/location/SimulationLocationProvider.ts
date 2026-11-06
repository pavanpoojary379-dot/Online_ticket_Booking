import { ILocationProvider, LocationCoordinates, LocationCallback } from './LocationProvider';
import { ScreenMapData } from '../../types';

export class SimulationLocationProvider implements ILocationProvider {
  private currentX: number = 50.0;
  private currentY: number = 95.0;
  private listeners: Set<LocationCallback> = new Set();
  private isRunning: boolean = false;
  private rowPositions: number[] = [24.0, 35.6, 47.2, 58.8, 70.4, 82.0]; // default row Y lines
  private aisles: Array<{ x?: number; y?: number; width?: number; height?: number; type: 'VERTICAL' | 'HORIZONTAL'; x1?: number; x2?: number; y1?: number; y2?: number }> = [];
  private onBlockedCallback?: (reason: string) => void;

  constructor(initialX: number = 50.0, initialY: number = 95.0, rowPositions?: number[]) {
    this.currentX = initialX;
    this.currentY = initialY;
    if (rowPositions && rowPositions.length > 0) {
      this.rowPositions = rowPositions;
    }
  }

  public setRowPositions(positions: number[]) {
    if (positions && positions.length > 0) {
      this.rowPositions = positions;
    }
  }

  public setScreenMap(mapData: ScreenMapData) {
    if (mapData.row_positions) {
      this.rowPositions = Object.values(mapData.row_positions);
    }
    if (mapData.aisles && mapData.aisles.length > 0) {
      this.aisles = mapData.aisles as any;
    }
  }

  public onBlocked(callback: (reason: string) => void) {
    this.onBlockedCallback = callback;
  }

  public getName(): string {
    return 'Demo Location Simulation';
  }

  public getSource(): 'SIMULATION' | 'BLE' {
    return 'SIMULATION';
  }

  public isRealHardware(): boolean {
    return false;
  }

  public getCurrentLocation(): LocationCoordinates {
    return {
      x: this.currentX,
      y: this.currentY,
      source: 'SIMULATION',
      accuracyMeters: 0.5,
      timestamp: Date.now(),
    };
  }

  public subscribe(callback: LocationCallback): () => void {
    this.listeners.add(callback);
    // Immediately emit current location
    callback(this.getCurrentLocation());
    return () => {
      this.listeners.delete(callback);
    };
  }

  public start(): void {
    this.isRunning = true;
    this.notify();
  }

  public stop(): void {
    this.isRunning = false;
  }

  public setPosition(x: number, y: number): void {
    // Clamp to cinema boundaries
    const clampedX = Math.max(4.0, Math.min(96.0, x));
    const clampedY = Math.max(10.0, Math.min(97.0, y));

    this.currentX = Math.round(clampedX * 10) / 10;
    this.currentY = Math.round(clampedY * 10) / 10;
    this.notify();
  }

  /**
   * Resets position back to entrance
   */
  public resetToEntrance(entranceX: number = 50.0, entranceY: number = 95.0): void {
    this.setPosition(entranceX, entranceY);
  }

  /**
   * Directional pad movement with collision awareness:
   * Vertical movement between rows requires being inside an aisle corridor.
   * Customers cannot step over the back of cinema seats!
   */
  public moveDirection(
    direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT',
    step: number = 2.5
  ): { moved: boolean; x: number; y: number; reason?: string } {
    let nextX = this.currentX;
    let nextY = this.currentY;

    switch (direction) {
      case 'UP':
        nextY -= step;
        break;
      case 'DOWN':
        nextY += step;
        break;
      case 'LEFT':
        nextX -= step;
        break;
      case 'RIGHT':
        nextX += step;
        break;
    }

    // When turning from central or side aisles into a row walkway, snap Y to row centerline for smooth navigation
    if (Math.abs(this.currentX - 50.0) <= 8.0 && Math.abs(nextX - 50.0) > 8.0) {
      const closestRow = this.rowPositions.find((ry) => Math.abs(this.currentY - ry) <= 3.8);
      if (closestRow !== undefined) {
        nextY = closestRow;
      }
    }

    const check = this.isValidMovement(this.currentX, this.currentY, nextX, nextY);

    if (check.valid) {
      this.setPosition(nextX, nextY);
      return { moved: true, x: this.currentX, y: this.currentY };
    } else {
      const reason = check.reason || 'Movement blocked: Path obstructed by cinema seating or walls.';
      if (this.onBlockedCallback) {
        this.onBlockedCallback(reason);
      }
      return { moved: false, x: this.currentX, y: this.currentY, reason };
    }
  }

  /**
   * Validates if a movement vector is permissible inside cinema architecture:
   * - Aisles (Central, Left, Right, Rear Concourse, Front Concourse)
   * - Row lanes (within tolerance of any row Y line)
   */
  private isValidMovement(
    currX: number,
    currY: number,
    targetX: number,
    targetY: number
  ): { valid: boolean; reason?: string } {
    // 1. Boundary check: Cinema auditorium walls
    if (targetX < 4.0 || targetX > 96.0 || targetY < 10.0 || targetY > 97.0) {
      return { valid: false, reason: 'Auditorium wall reached. Movement outside boundaries is not allowed.' };
    }

    const inAisle = (x: number, y: number) => {
      // If we have aisles defined from screenMap, use them
      if (this.aisles && this.aisles.length > 0) {
        const inConfiguredAisle = this.aisles.some((a) => {
          if (a.type === 'VERTICAL') {
            const w = (a.width || 8.0) + 2.0; // slight tolerance
            const ax = a.x !== undefined ? a.x : 50.0;
            const y1 = a.y1 !== undefined ? a.y1 - 1.5 : 12.0;
            const y2 = a.y2 !== undefined ? a.y2 + 2.0 : 97.0;
            return Math.abs(x - ax) <= w / 2 && y >= y1 && y <= y2;
          } else {
            const h = (a.height || 6.0) + 2.0;
            const ay = a.y !== undefined ? a.y : 88.0;
            const x1 = a.x1 !== undefined ? a.x1 - 2.0 : 4.0;
            const x2 = a.x2 !== undefined ? a.x2 + 2.0 : 96.0;
            return Math.abs(y - ay) <= h / 2 && x >= x1 && x <= x2;
          }
        });
        if (inConfiguredAisle) return true;
      }

      // Default aisle corridors:
      // Central Aisle: 42 to 58 (width 16)
      // Left Aisle: 4 to 14
      // Right Aisle: 86 to 96
      // Rear Concourse: 84 to 97
      // Front Concourse: 10 to 22
      const inCentralAisle = x >= 42.0 && x <= 58.0;
      const inLeftAisle = x >= 4.0 && x <= 14.0;
      const inRightAisle = x >= 86.0 && x <= 96.0;
      const inRearAisle = y >= 84.0 && y <= 97.0;
      const inFrontAisle = y >= 10.0 && y <= 22.0;
      return inCentralAisle || inLeftAisle || inRightAisle || inRearAisle || inFrontAisle;
    };

    const isNearRowLane = (y: number) => {
      return this.rowPositions.some((rowY) => Math.abs(y - rowY) <= 3.8);
    };

    const isVerticalMove = Math.abs(targetY - currY) > 0.4;

    // If moving vertically across rows:
    // User MUST be inside an aisle to move vertically between rows!
    // Stepping over cinema seats is physically prohibited.
    if (isVerticalMove) {
      if (!inAisle(currX, currY) && !inAisle(targetX, targetY)) {
        return {
          valid: false,
          reason: 'Cannot step over seats. Please walk along your row back to the central or side aisle to change rows.',
        };
      }
    }

    // Target position must either be in a designated aisle or within a row lane
    if (!inAisle(targetX, targetY) && !isNearRowLane(targetY)) {
      return {
        valid: false,
        reason: 'Obstruction: Please remain within marked auditorium aisles and row walkways.',
      };
    }

    return { valid: true };
  }

  private notify(): void {
    const loc = this.getCurrentLocation();
    this.listeners.forEach((listener) => {
      try {
        listener(loc);
      } catch (err) {
        console.error('Error notifying location listener:', err);
      }
    });
  }
}
