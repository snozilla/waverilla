import { distXZ } from '../utils/math.js';

const COLLISION_RADIUS = 2.5;
const BOUNCE_FORCE = 15;
const BUOY_COLLISION_RADIUS = 3;
const BUOY_BOUNCE_FORCE = 20;

export class CollisionSystem {
  checkRacerCollisions(racers) {
    for (let i = 0; i < racers.length; i++) {
      for (let j = i + 1; j < racers.length; j++) {
        const a = racers[i];
        const b = racers[j];
        const dist = distXZ(a.position, b.position);

        if (dist < COLLISION_RADIUS && dist > 0.01) {
          const nx = (b.position.x - a.position.x) / dist;
          const nz = (b.position.z - a.position.z) / dist;
          const overlap = COLLISION_RADIUS - dist;

          // Separate
          a.position.x -= nx * overlap * 0.5;
          a.position.z -= nz * overlap * 0.5;
          b.position.x += nx * overlap * 0.5;
          b.position.z += nz * overlap * 0.5;

          // Bounce
          const relVelX = a.velocity.x - b.velocity.x;
          const relVelZ = a.velocity.z - b.velocity.z;
          const relDot = relVelX * nx + relVelZ * nz;

          if (relDot > 0) {
            a.velocity.x -= relDot * nx * 0.5;
            a.velocity.z -= relDot * nz * 0.5;
            b.velocity.x += relDot * nx * 0.5;
            b.velocity.z += relDot * nz * 0.5;
          }
        }
      }
    }
  }

  checkBuoyCollisions(racers, buoys) {
    for (const racer of racers) {
      for (const buoy of buoys) {
        const dist = distXZ(racer.position, buoy.position);
        if (dist < BUOY_COLLISION_RADIUS && dist > 0.01) {
          const nx = (racer.position.x - buoy.position.x) / dist;
          const nz = (racer.position.z - buoy.position.z) / dist;
          const overlap = BUOY_COLLISION_RADIUS - dist;

          racer.position.x += nx * overlap;
          racer.position.z += nz * overlap;

          const dot = racer.velocity.x * nx + racer.velocity.z * nz;
          if (dot < 0) {
            racer.velocity.x -= dot * nx * 1.5;
            racer.velocity.z -= dot * nz * 1.5;
          }
        }
      }
    }
  }
}
