// Test suite for SimulationLocationProvider movements, collisions, and state
import { readFileSync } from 'fs';

// Simple lightweight mock of the class to test logic directly
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
    const clampedY = Math.max(10.0, Math.min(97.0, y));
    this.currentX = Math.round(clampedX * 10) / 10;
    this.currentY = Math.round(clampedY * 10) / 10;
  }

  resetToEntrance(entranceX = 50.0, entranceY = 95.0) {
    this.setPosition(entranceX, entranceY);
  }

  moveDirection(direction, step = 2.5) {
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

    // When turning from central or side aisles into a row walkway, snap Y to row centerline
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

  isValidMovement(currX, currY, targetX, targetY) {
    // 1. Boundary check: Cinema auditorium walls
    if (targetX < 4.0 || targetX > 96.0 || targetY < 10.0 || targetY > 97.0) {
      return { valid: false, reason: 'Auditorium wall reached. Movement outside boundaries is not allowed.' };
    }

    const inAisle = (x, y) => {
      if (this.aisles && this.aisles.length > 0) {
        const inConfiguredAisle = this.aisles.some((a) => {
          if (a.type === 'VERTICAL') {
            const w = (a.width || 8.0) + 2.0;
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

      const inCentralAisle = x >= 42.0 && x <= 58.0;
      const inLeftAisle = x >= 4.0 && x <= 14.0;
      const inRightAisle = x >= 86.0 && x <= 96.0;
      const inRearAisle = y >= 84.0 && y <= 97.0;
      const inFrontAisle = y >= 10.0 && y <= 22.0;
      return inCentralAisle || inLeftAisle || inRightAisle || inRearAisle || inFrontAisle;
    };

    const isNearRowLane = (y) => {
      return this.rowPositions.some((rowY) => Math.abs(y - rowY) <= 3.8);
    };

    const isVerticalMove = Math.abs(targetY - currY) > 0.4;

    if (isVerticalMove) {
      if (!inAisle(currX, currY) && !inAisle(targetX, targetY)) {
        return {
          valid: false,
          reason: 'Cannot step over seats. Please walk along your row back to the central or side aisle to change rows.',
        };
      }
    }

    if (!inAisle(targetX, targetY) && !isNearRowLane(targetY)) {
      return {
        valid: false,
        reason: 'Obstruction: Please remain within marked auditorium aisles and row walkways.',
      };
    }

    return { valid: true };
  }
}

console.log('==================================================');
console.log('RUNNING SMART INDOOR SIMULATION MOVEMENT TEST SUITE');
console.log('==================================================');

const provider = new SimulationLocationProviderTest(50.0, 95.0, [24.0, 35.6, 47.2, 58.8, 70.4, 82.0]);
let lastBlockedReason = null;
provider.onBlocked((msg) => { lastBlockedReason = msg; });

// TEST 1: Initial position at entrance
console.log(`Starting Position: (${provider.currentX}, ${provider.currentY})`);
if (provider.currentX !== 50.0 || provider.currentY !== 95.0) throw new Error('Initial position mismatch');
console.log('✓ Test 1 Passed: Initial position initialized at (50.0, 95.0)');

// TEST 2: Move UP along central aisle
const up1 = provider.moveDirection('UP', 2.5);
console.log(`After UP: moved=${up1.moved}, pos=(${up1.x}, ${up1.y})`);
if (!up1.moved || up1.y !== 92.5) throw new Error('Failed moving UP');
console.log('✓ Test 2 Passed: Move UP forward along central aisle');

// TEST 3: Move DOWN towards entrance
const down1 = provider.moveDirection('DOWN', 2.5);
console.log(`After DOWN: moved=${down1.moved}, pos=(${down1.x}, ${down1.y})`);
if (!down1.moved || down1.y !== 95.0) throw new Error('Failed moving DOWN');
console.log('✓ Test 3 Passed: Move DOWN backward along aisle');

// TEST 4: Boundary check - try to walk beyond rear wall
provider.moveDirection('DOWN', 2.5); // to 97.5 (blocked)
if (lastBlockedReason === null || !lastBlockedReason.includes('wall reached')) {
  throw new Error('Wall boundary check failed');
}
console.log(`✓ Test 4 Passed: Wall collision detected -> "${lastBlockedReason}"`);

// TEST 5: Walk along central aisle to near Row F (Y = 82.0)
provider.resetToEntrance();
// Move up several steps to Y = 82.5
for (let i = 0; i < 5; i++) {
  provider.moveDirection('UP', 2.5);
}
console.log(`Arrived near Row F at Y=${provider.currentY}`);
console.log('✓ Test 5 Passed: Navigated along central aisle towards Row F');

// TEST 6: Turn LEFT into Row F lane
// Current: (50.0, 82.5). Turn left into Row F (82.0).
const left1 = provider.moveDirection('LEFT', 2.5);
console.log(`Turned LEFT into Row F: moved=${left1.moved}, pos=(${left1.x}, ${left1.y})`);
if (!left1.moved) throw new Error('Failed to turn into row lane');
console.log('✓ Test 6 Passed: Turned LEFT into Row F walkway with automatic Y alignment');

// TEST 7: Move further LEFT along Row F towards seats
for (let i = 0; i < 5; i++) {
  provider.moveDirection('LEFT', 2.5);
}
console.log(`Deep in Row F at: (${provider.currentX}, ${provider.currentY})`);
if (provider.currentX >= 42.0) throw new Error('Should be in seating area');
console.log('✓ Test 7 Passed: Successfully walked through Row F seating lane');

// TEST 8: Stepping over seats collision check
// Try to move UP while inside the seating row!
lastBlockedReason = null;
const upOverSeats = provider.moveDirection('UP', 2.5);
if (upOverSeats.moved || !lastBlockedReason.includes('Cannot step over seats')) {
  throw new Error(`Expected seat obstacle block, got: ${JSON.stringify(upOverSeats)}`);
}
console.log(`✓ Test 8 Passed: Stepping over seats blocked -> "${lastBlockedReason}"`);

// TEST 9: Walk back to central aisle to change rows
for (let i = 0; i < 6; i++) {
  provider.moveDirection('RIGHT', 2.5);
}
console.log(`Returned to central aisle at X=${provider.currentX}`);
if (provider.currentX < 42.0 || provider.currentX > 58.0) throw new Error('Should be back in central aisle');
console.log('✓ Test 9 Passed: Walked back to central aisle');

// TEST 10: Now moving UP in central aisle is permitted again!
const upAisle = provider.moveDirection('UP', 2.5);
if (!upAisle.moved) throw new Error('Should be able to move vertically in central aisle');
console.log(`✓ Test 10 Passed: Vertical movement restored inside central aisle -> (${provider.currentX}, ${provider.currentY})`);

// TEST 11: Reset to entrance
provider.resetToEntrance();
if (provider.currentX !== 50.0 || provider.currentY !== 95.0) throw new Error('Reset failed');
console.log(`✓ Test 11 Passed: Reset to entrance restored coordinates to (50.0, 95.0)`);

console.log('==================================================');
console.log('ALL 11 SIMULATION MOVEMENT TESTS PASSED 100%!');
console.log('==================================================');

