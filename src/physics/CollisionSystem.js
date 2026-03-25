import { distXZ } from '../utils/math.js';

const COLLISION_RADIUS = 2.5;
const BOUNCE_FORCE = 15;
const BUOY_COLLISION_RADIUS = 3;
const BUOY_BOUNCE_FORCE = 20;

export class CollisionSystem {
  checkRacerCollisions(racers) {
    const events = [];

    for (let i = 0; i < racers.length; i++) {
      for (let j = i + 1; j < racers.length; j++) {
        const a = racers[i];
        const b = racers[j];
        const dist = distXZ(a.position, b.position);

        // Giant mode: use larger collision radius
        const radiusA = a.activePickup === 'giant' ? COLLISION_RADIUS * 2 : COLLISION_RADIUS;
        const radiusB = b.activePickup === 'giant' ? COLLISION_RADIUS * 2 : COLLISION_RADIUS;
        const combinedRadius = (radiusA + radiusB) / 2;

        if (dist < combinedRadius && dist > 0.01) {
          const nx = (b.position.x - a.position.x) / dist;
          const nz = (b.position.z - a.position.z) / dist;
          const overlap = combinedRadius - dist;

          // Separate
          a.position.x -= nx * overlap * 0.5;
          a.position.z -= nz * overlap * 0.5;
          b.position.x += nx * overlap * 0.5;
          b.position.z += nz * overlap * 0.5;

          // Bounce (stronger multiplier)
          const relVelX = a.velocity.x - b.velocity.x;
          const relVelZ = a.velocity.z - b.velocity.z;
          const relDot = relVelX * nx + relVelZ * nz;

          if (relDot > 0) {
            const bounce = 0.8;

            // Electric shield: shielded racer doesn't get bounced, other gets 2x
            const aShield = a.activePickup === 'electric';
            const bShield = b.activePickup === 'electric';

            const aBounce = bShield ? 2.0 : (aShield ? 0 : bounce);
            const bBounce = aShield ? 2.0 : (bShield ? 0 : bounce);

            a.velocity.x -= relDot * nx * aBounce;
            a.velocity.z -= relDot * nz * aBounce;
            b.velocity.x += relDot * nx * bBounce;
            b.velocity.z += relDot * nz * bBounce;

            // Lateral impulse perpendicular to collision normal for "off course" push
            const perpX = -nz;
            const perpZ = nx;
            const lateralForce = relDot * 0.3;
            const aLateral = bShield ? 2.0 : (aShield ? 0 : 1);
            const bLateral = aShield ? 2.0 : (bShield ? 0 : 1);
            a.velocity.x += perpX * lateralForce * aLateral;
            a.velocity.z += perpZ * lateralForce * aLateral;
            b.velocity.x -= perpX * lateralForce * bLateral;
            b.velocity.z -= perpZ * lateralForce * bLateral;

            events.push({ a, b, impactSpeed: Math.abs(relDot) });
          }
        }
      }
    }

    return events;
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
