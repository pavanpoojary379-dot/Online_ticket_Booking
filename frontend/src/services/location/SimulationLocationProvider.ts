import { ILocationProvider, LocationCoordinates, LocationCallback } from './LocationProvider';

export class SimulationLocationProvider implements ILocationProvider {
  private currentX: number = 50.0;
  private currentY: number = 95.0;
  private listeners: Set<LocationCallback> = new Set();
  private isRunning: boolean = false;
  private rowPositions: number[] = [24.0, 35.6, 47.2, 58.8, 70.4, 82.0]; // default row Y lines

  constructor(initialX: number = 50.0, initialY: number = 95.0, rowPositions?: number[]) {
    this.currentX = initialX;
    this.currentY = initialY;
    if (rowPositions && rowPositions.length > 0) {
      this.rowPositions = rowPositions;
    }
  }

  public setRowPositions(positions: number[]) {
    this.rowPositions = positions;
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
    const clampedX = Math.max(5.0, Math.min(95.0, x));
    const clampedY = Math.max(12.0, Math.min(96.0, y));

    this.currentX = Math.round(clampedX * 10) / 10;
    this.currentY = Math.round(clampedY * 10) / 10;
    this.notify();
  }

  /**
   * Directional pad movement with collision awareness:
   * Vertical movement between rows requires being inside an aisle corridor (Central, Left, or Right).
   * Customers cannot step over the back of cinema seats!
   */
  public moveDirection(direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', step: number = 2.5): void {
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

    // Check collision / valid walking path
    if (this.isValidMovement(this.currentX, this.currentY, nextX, nextY)) {
      this.setPosition(nextX, nextY);
    } else {
      // Allow slight sliding along the unobstructed axis
      if (direction === 'UP' || direction === 'DOWN') {
        // If vertical movement blocked by seats, snap to nearest aisle
        if (this.currentX > 35 && this.currentX < 65) {
          this.setPosition(50.0, nextY); // Move into central aisle
        }
      } else {
        this.setPosition(nextX, this.currentY);
      }
    }
  }

  /**
   * Validates if a movement vector is permissible inside cinema architecture:
   * - Aisles (Central: 44-56, Left: 4-12, Right: 88-96, Rear Concourse: 85-96, Front Concourse: 12-20)
   * - Row lanes (within 2.5 units of any row Y position)
   */
  private isValidMovement(currX: number, currY: number, targetX: number, targetY: number): boolean {
    // 1. Boundary check
    if (targetX < 5.0 || targetX > 95.0 || targetY < 12.0 || targetY > 96.0) {
      return false;
    }

    const inAisle = (x: number, y: number) => {
      const inCentralAisle = x >= 44.0 && x <= 56.0;
      const inLeftAisle = x >= 4.0 && x <= 12.0;
      const inRightAisle = x >= 88.0 && x <= 96.0;
      const inRearAisle = y >= 85.0 && y <= 96.0;
      const inFrontAisle = y >= 12.0 && y <= 20.0;
      return inCentralAisle || inLeftAisle || inRightAisle || inRearAisle || inFrontAisle;
    };

    const isNearRowLane = (y: number) => {
      return this.rowPositions.some((rowY) => Math.abs(y - rowY) <= 3.0);
    };

    // If moving vertically (changing Y by more than 1 unit), must be in an aisle
    const isVerticalMove = Math.abs(targetY - currY) > 0.5;
    if (isVerticalMove) {
      if (!inAisle(currX, currY) && !inAisle(targetX, targetY)) {
        // Attempting to walk vertically through seating rows!
        return false;
      }
    }

    // Must be in an aisle OR inside a row lane
    return inAisle(targetX, targetY) || isNearRowLane(targetY);
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

