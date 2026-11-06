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
   * - Free movement along all aisles (central, left, right, front, rear concourses).
   * - Smooth alignment into row lanes when turning from aisles.
   * - Movement along row seating lanes to reach booked seats.
   * - Stepping over seat backs between rows is physically blocked with helpful guidance.
   * - Clamped to auditorium boundaries with clear notifications.
   */
  public moveDirection(
    direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT',
    step: number = 2.5
  ): { moved: boolean; x: number; y: number; reason?: string } {
    let nextX = this.currentX;
    let nextY = this.currentY;

    if (direction === 'UP') {
      if (this.currentY <= 8.0) {
        const reason = 'Cinema screen reached. Please take your seat.';
        if (this.onBlockedCallback) this.onBlockedCallback(reason);
        return { moved: false, x: this.currentX, y: this.currentY, reason };
      }
      // If customer is in seating area between aisles, prevent walking through seat backs
      if (!this.isInAisle(this.currentX, this.currentY)) {
        const closestRow = this.getClosestRow(this.currentY, 3.5);
        const rowName = closestRow !== undefined ? `Row` : 'your row';
        const reason = `Cannot step over seats. Please walk along ${rowName} back to the central aisle to change rows.`;
        if (this.onBlockedCallback) this.onBlockedCallback(reason);
        return { moved: false, x: this.currentX, y: this.currentY, reason };
      }
      nextY = Math.max(8.0, Math.round((this.currentY - step) * 10) / 10);
    } else if (direction === 'DOWN') {
      if (this.currentY >= 96.0) {
        const reason = 'Auditorium entrance reached. Turn around towards the cinema screen.';
        if (this.onBlockedCallback) this.onBlockedCallback(reason);
        return { moved: false, x: this.currentX, y: this.currentY, reason };
      }
      if (!this.isInAisle(this.currentX, this.currentY)) {
        const closestRow = this.getClosestRow(this.currentY, 3.5);
        const rowName = closestRow !== undefined ? `Row` : 'your row';
        const reason = `Cannot step over seats. Please walk along ${rowName} back to the central aisle to change rows.`;
        if (this.onBlockedCallback) this.onBlockedCallback(reason);
        return { moved: false, x: this.currentX, y: this.currentY, reason };
      }
      nextY = Math.min(96.0, Math.round((this.currentY + step) * 10) / 10);
    } else if (direction === 'LEFT') {
      if (this.currentX <= 4.0) {
        const reason = 'Auditorium left wall reached.';
        if (this.onBlockedCallback) this.onBlockedCallback(reason);
        return { moved: false, x: this.currentX, y: this.currentY, reason };
      }
      // When turning from central aisle into row walkway, automatically snap Y to the nearest row centerline
      if (Math.abs(this.currentX - 50.0) <= 8.0 && this.currentY > 22.0 && this.currentY < 84.0) {
        const closest = this.getClosestRow(this.currentY, 6.0);
        if (closest !== undefined) {
          nextY = closest;
        }
      }
      nextX = Math.max(4.0, Math.round((this.currentX - step) * 10) / 10);
    } else if (direction === 'RIGHT') {
      if (this.currentX >= 96.0) {
        const reason = 'Auditorium right wall reached.';
        if (this.onBlockedCallback) this.onBlockedCallback(reason);
        return { moved: false, x: this.currentX, y: this.currentY, reason };
      }
      // When turning from central aisle into row walkway, automatically snap Y to the nearest row centerline
      if (Math.abs(this.currentX - 50.0) <= 8.0 && this.currentY > 22.0 && this.currentY < 84.0) {
        const closest = this.getClosestRow(this.currentY, 6.0);
        if (closest !== undefined) {
          nextY = closest;
        }
      }
      nextX = Math.min(96.0, Math.round((this.currentX + step) * 10) / 10);
    }

    this.setPosition(nextX, nextY);
    return { moved: true, x: this.currentX, y: this.currentY };
  }

  /**
   * Determines if a point is within an accessible aisle or concourse:
   * - Central Main Aisle (X: 38 - 62)
   * - Left Side Aisle (X: 4 - 16)
   * - Right Side Aisle (X: 84 - 96)
   * - Rear Cross Concourse & Foyer (Y: 84 - 97)
   * - Front Screen Concourse (Y: 8 - 22)
   * - Screen map configured corridors
   */
  public isInAisle(x: number, y: number): boolean {
    // Rear concourse / foyer (across full auditorium width)
    if (y >= 84.0) return true;
    // Front screen concourse (across full auditorium width)
    if (y <= 22.0) return true;
    // Central Main Aisle
    if (x >= 38.0 && x <= 62.0) return true;
    // Left Side Aisle
    if (x <= 16.0) return true;
    // Right Side Aisle
    if (x >= 84.0) return true;

    // Check custom configured aisles from screenMap
    if (this.aisles && this.aisles.length > 0) {
      const match = this.aisles.some((a) => {
        if (a.type === 'VERTICAL') {
          const w = (a.width || 8.0) + 4.0;
          const ax = a.x !== undefined ? a.x : 50.0;
          const y1 = a.y1 !== undefined ? a.y1 - 2.0 : 12.0;
          const y2 = a.y2 !== undefined ? a.y2 + 2.0 : 96.0;
          return Math.abs(x - ax) <= w / 2 && y >= y1 && y <= y2;
        } else {
          const h = (a.height || 6.0) + 4.0;
          const ay = a.y !== undefined ? a.y : 88.0;
          const x1 = a.x1 !== undefined ? a.x1 - 2.0 : 4.0;
          const x2 = a.x2 !== undefined ? a.x2 + 2.0 : 96.0;
          return Math.abs(y - ay) <= h / 2 && x >= x1 && x <= x2;
        }
      });
      if (match) return true;
    }

    return false;
  }

  /**
   * Finds the closest row Y line to a given coordinate within maxDistance
   */
  public getClosestRow(y: number, maxDistance: number = 6.0): number | undefined {
    let bestRow: number | undefined;
    let minD = maxDistance;
    for (const ry of this.rowPositions) {
      const d = Math.abs(y - ry);
      if (d <= minD) {
        minD = d;
        bestRow = ry;
      }
    }
    return bestRow;
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
