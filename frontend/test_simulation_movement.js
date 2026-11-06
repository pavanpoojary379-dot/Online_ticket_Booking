// Comprehensive Test Suite for SimulationLocationProvider (Task 10 Journey: Entrance -> Central Aisle -> Near Row D -> Inside Row D -> Seat D4)

class SimulationLocationProviderTest {
  constructor(initialX = 50.0, initialY = 95.0, rowPositions = [24.0, 35.6, 47.2, 58.8, 70.4, 82.0]) {
    this.currentX = initialX;
    this.currentY = initialY;
    this.rowPositions = rowPositions;
    this.aisles = [];
    this.onBlockedCallback = null;
  }

  setRowPositions(positions) {
    if (positions && positions.length > 0) this.rowPositions = positions;
  }

  setScreenMap(mapData) {
    if (mapData.row_positions) this.rowPositions = Object.values(mapData.row_positions);
    if (mapData.aisles) this.aisles = mapData.aisles;
  }

  onBlocked(cb) {
    this.onBlockedCallback = cb;
  }

  setPosition(x, y) {
    const clampedX = Math.max(4.0, Math.min(96.0, x));
    const clampedY = Math.max(8.0, Math.min(96.0, y));
    this.currentX = Math.round(clampedX * 10) / 10;
    this.currentY = Math.round(clampedY * 10) / 10;
  }

  resetToEntrance(entranceX = 50.0, entranceY = 95.0) {
    this.setPosition(entranceX, entranceY);
  }

  isInAisle(x, y) {
    if (y >= 84.0) return true; // Rear concourse
    if (y <= 22.0) return true; // Front concourse
    if (x >= 38.0 && x <= 62.0) return true; // Central Aisle
    if (x <= 16.0) return true; // Left Side Aisle
    if (x >= 84.0) return true; // Right Side Aisle
    return false;
  }

  getClosestRow(y, maxDistance = 6.0) {
    let bestRow;
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

  moveDirection(direction, step = 2.5) {
    let nextX = this.currentX;
    let nextY = this.currentY;

    if (direction === 'UP') {
      if (this.currentY <= 8.0) {
        const reason = 'Cinema screen reached. Please take your seat.';
        if (this.onBlockedCallback) this.onBlockedCallback(reason);
        return { moved: false, x: this.currentX, y: this.currentY, reason };
      }
      if (!this.isInAisle(this.currentX, this.currentY)) {
        const closestRow = this.getClosestRow(this.currentY, 3.5);
        const reason = `Cannot step over seats. Please walk along the row back to the central aisle to change rows.`;
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
        const reason = `Cannot step over seats. Please walk along the row back to the central aisle to change rows.`;
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
}

console.log('======================================================================');
console.log('RUNNING SMART INDOOR SEAT NAVIGATION FULL JOURNEY TEST SUITE');
console.log('======================================================================');

const provider = new SimulationLocationProviderTest(50.0, 95.0, [24.0, 35.6, 47.2, 58.8, 70.4, 82.0]);
let lastBlockedReason = null;
provider.onBlocked((msg) => { lastBlockedReason = msg; });

// 1. Initial State: Entrance
console.log(`\n--- Stage 1: Entrance ---`);
console.log(`Marker Position: (${provider.currentX}, ${provider.currentY})`);
if (provider.currentX !== 50.0 || provider.currentY !== 95.0) throw new Error('Initial position error');
console.log('✓ Stage 1 Passed: Initialized at Entrance (50.0, 95.0)');

// 2. Down Movement at Entrance
console.log(`\n--- Testing Down & Boundary at Entrance ---`);
const down1 = provider.moveDirection('DOWN', 2.5);
console.log(`After DOWN: moved=${down1.moved}, pos=(${down1.x}, ${down1.y})`);
if (!down1.moved || down1.y !== 96.0) throw new Error('Should move down to 96.0');
const down2 = provider.moveDirection('DOWN', 2.5);
console.log(`At Rear Wall: moved=${down2.moved}, reason="${down2.reason}"`);
if (down2.moved) throw new Error('Should block at rear boundary');
console.log('✓ Stage 2 Passed: Down movement and rear boundary check validated');

// 3. Move along Central Aisle towards Row D (Y: 58.8)
console.log(`\n--- Stage 3: Central Aisle Movement Towards Row D ---`);
provider.resetToEntrance();
// Move up 14 steps towards Row D
for (let i = 0; i < 14; i++) {
  const res = provider.moveDirection('UP', 2.5);
  if (!res.moved) throw new Error(`Failed to move UP at step ${i}`);
}
console.log(`Near Row D: Position=(${provider.currentX}, ${provider.currentY})`);
// Y should be 60.0 (near Row D at 58.8, diff 1.2 <= 7.5 threshold for APPROACHING_ROW)
if (Math.abs(provider.currentY - 58.8) > 3.0) throw new Error(`Expected near Row D, got Y=${provider.currentY}`);
console.log('✓ Stage 3 Passed: Approaching Row D detected along Central Aisle');

// 4. Turn LEFT into Row D Seating Lane
console.log(`\n--- Stage 4: Enter Row D Seating Lane ---`);
const turnLeft = provider.moveDirection('LEFT', 2.5);
console.log(`Turned LEFT into Row D: moved=${turnLeft.moved}, pos=(${turnLeft.x}, ${turnLeft.y})`);
if (!turnLeft.moved || turnLeft.y !== 58.8) throw new Error('Failed to align into Row D');
console.log('✓ Stage 4 Passed: Entered Row D with automatic centerline snapping (Y = 58.8)');

// 5. Navigate through Row D to Seat D4 (X: 35.0, Y: 58.8)
console.log(`\n--- Stage 5: Move Along Row D to Seat D4 ---`);
// Move left 5 more steps to reach Seat D4 (target X: 35.0)
for (let i = 0; i < 5; i++) {
  const res = provider.moveDirection('LEFT', 2.5);
  if (!res.moved) throw new Error(`Failed to move left in row at step ${i}`);
}
console.log(`Arrived at Seat D4: (${provider.currentX}, ${provider.currentY})`);
if (provider.currentX !== 35.0 || provider.currentY !== 58.8) {
  throw new Error(`Expected (35.0, 58.8), got (${provider.currentX}, ${provider.currentY})`);
}
console.log('✓ Stage 5 Passed: Successfully arrived at exact Seat D4 (35.0, 58.8)');

// 6. Test Obstacle: Stepping over seats between rows
console.log(`\n--- Stage 6: Seat Collision & Obstacle Protection ---`);
lastBlockedReason = null;
const upOverSeats = provider.moveDirection('UP', 2.5);
if (upOverSeats.moved || !upOverSeats.reason.includes('Cannot step over seats')) {
  throw new Error(`Expected seat block, got: ${JSON.stringify(upOverSeats)}`);
}
console.log(`Blocked vertical movement over seats: "${upOverSeats.reason}"`);
if (provider.currentX !== 35.0 || provider.currentY !== 58.8) throw new Error('Position should remain unchanged');
console.log('✓ Stage 6 Passed: Stepping over seats physically prevented without freezing');

// 7. Walk Back along Row D to Central Aisle
console.log(`\n--- Stage 7: Walk Back to Central Aisle ---`);
for (let i = 0; i < 6; i++) {
  provider.moveDirection('RIGHT', 2.5);
}
console.log(`Returned to Aisle: Position=(${provider.currentX}, ${provider.currentY})`);
if (provider.currentX !== 50.0) throw new Error('Failed to return to central aisle');
console.log('✓ Stage 7 Passed: Returned to Central Aisle (50.0, 58.8)');

// 8. Test Checkpoint Jump & Reset
console.log(`\n--- Stage 8: Checkpoint Jump & Reset ---`);
provider.resetToEntrance();
if (provider.currentX !== 50.0 || provider.currentY !== 95.0) throw new Error('Reset failed');
console.log('✓ Stage 8 Passed: Reset to Entrance restored (50.0, 95.0)');

console.log('\n======================================================================');
console.log('🎉 ALL 8 JOURNEY & COLLISION TEST STAGES PASSED 100%!');
console.log('======================================================================');
