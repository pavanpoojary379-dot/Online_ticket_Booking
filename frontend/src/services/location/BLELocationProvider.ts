import { ILocationProvider, LocationCoordinates, LocationCallback } from './LocationProvider';

/**
 * Architectural specification and stub for Future BLE (Bluetooth Low Energy) Hardware Positioning.
 *
 * In a physical cinema deployment:
 * 1. Fixed BLE iBeacons / Eddystone beacons are positioned at:
 *    - Entrance Gate (e.g. UUID: BEACON-ENTRANCE)
 *    - Main Aisle intersections (UUID: BEACON-AISLE-FRONT, BEACON-AISLE-MID, BEACON-AISLE-REAR)
 *    - Row entrances (e.g. BEACON-ROW-A ... BEACON-ROW-F)
 * 2. The mobile app (via Native iOS CoreBluetooth / Android BluetoothLeScanner) samples RSSI values.
 * 3. A trilateration / weighted centroid algorithm estimates physical coordinates (x, y).
 * 4. This provider passes updates directly to the CineBook Indoor Navigation Engine without UI changes.
 */
export class BLELocationProvider implements ILocationProvider {
  private listeners: Set<LocationCallback> = new Set();
  private isScanning: boolean = false;
  private currentX: number = 50.0;
  private currentY: number = 95.0;

  public getName(): string {
    return 'Bluetooth Low Energy (Hardware Ready)';
  }

  public getSource(): 'SIMULATION' | 'BLE' {
    return 'BLE';
  }

  public isRealHardware(): boolean {
    // Web Bluetooth in browser cannot scan background iBeacons without native mobile app bridge
    return false;
  }

  public getCurrentLocation(): LocationCoordinates {
    return {
      x: this.currentX,
      y: this.currentY,
      source: 'BLE',
      accuracyMeters: 1.2,
      timestamp: Date.now(),
    };
  }

  public subscribe(callback: LocationCallback): () => void {
    this.listeners.add(callback);
    callback(this.getCurrentLocation());
    return () => {
      this.listeners.delete(callback);
    };
  }

  public start(): void {
    this.isScanning = true;
    console.info('[BLE Provider] Beacon scanning initialized. Awaiting beacon RSSI packets...');
  }

  public stop(): void {
    this.isScanning = false;
  }

  public setPosition(x: number, y: number): void {
    this.currentX = x;
    this.currentY = y;
    this.notify();
  }

  public moveDirection(direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', step: number = 2.5): { moved: boolean; x: number; y: number; reason?: string } {
    // Hardware BLE positioning derives location from radio signals; manual movement not typical
    console.warn('[BLE Provider] Manual movement not applicable in hardware positioning mode.');
    return { moved: false, x: this.currentX, y: this.currentY, reason: 'Manual movement not applicable in hardware BLE mode.' };
  }

  private notify(): void {
    const loc = this.getCurrentLocation();
    this.listeners.forEach((listener) => listener(loc));
  }
}

