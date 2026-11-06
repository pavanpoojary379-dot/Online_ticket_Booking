export interface LocationCoordinates {
  x: number;
  y: number;
  source: 'SIMULATION' | 'BLE';
  accuracyMeters?: number;
  timestamp?: number;
}

export type LocationCallback = (coords: LocationCoordinates) => void;

export interface ILocationProvider {
  /** Returns the human-readable provider name */
  getName(): string;

  /** Returns provider mode (e.g., 'SIMULATION' or 'BLE') */
  getSource(): 'SIMULATION' | 'BLE';

  /** Returns current estimated coordinates */
  getCurrentLocation(): LocationCoordinates;

  /** Subscribes to location stream updates */
  subscribe(callback: LocationCallback): () => void;

  /** Starts the positioning service */
  start(): void;

  /** Stops the positioning service */
  stop(): void;

  /** Moves or sets position manually (supported in simulation) */
  setPosition(x: number, y: number): void;

  /** Directional delta movement (Up/Down/Left/Right) */
  moveDirection(direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', step?: number): { moved: boolean; x: number; y: number; reason?: string };

  /** Whether backed by active physical radio hardware */
  isRealHardware(): boolean;
}

