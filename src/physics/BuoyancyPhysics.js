import * as THREE from 'three';
import { JETSKI } from '../utils/constants.js';
import { lerp } from '../utils/math.js';

export class BuoyancyPhysics {
  constructor(water) {
    this.water = water;
    this.hullPoints = [
      new THREE.Vector3( JETSKI.hullWidth / 2,  0,  JETSKI.hullLength / 2),
      new THREE.Vector3(-JETSKI.hullWidth / 2,  0,  JETSKI.hullLength / 2),
      new THREE.Vector3( JETSKI.hullWidth / 2,  0, -JETSKI.hullLength / 2),
      new THREE.Vector3(-JETSKI.hullWidth / 2,  0, -JETSKI.hullLength / 2),
    ];
  }

  apply(entity, time, dt) {
    const pos = entity.position;
    const vel = entity.velocity;
    const rot = entity.rotation;

    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);

    // Sample water height at 4 hull corners for pitch/roll
    let avgWaterHeight = 0;
    const cornerHeights = [];

    for (let i = 0; i < this.hullPoints.length; i++) {
      const hp = this.hullPoints[i];
      const worldX = pos.x + hp.x * cosR + hp.z * sinR;
      const worldZ = pos.z - hp.x * sinR + hp.z * cosR;
      const waterH = this.water.getHeightAt(worldX, worldZ, time);
      cornerHeights.push(waterH);
      avgWaterHeight += waterH;
    }

    avgWaterHeight /= 4;

    const targetY = avgWaterHeight + JETSKI.waterRideHeight;
    const depth = targetY - pos.y;

    if (depth > -2) {
      // On or near water: strongly lerp Y to ride on surface
      // This gives a "riding the waves" feel without spring oscillation
      const stiffness = 10; // how fast it snaps to water
      const damping = 0.9;  // velocity damping when on water

      vel.y += depth * stiffness * dt;
      vel.y *= Math.pow(damping, dt * 60);

      // Clamp to prevent launching - vel.y should rarely exceed a small value
      if (vel.y > 5) vel.y = 5;

      entity.airborne = false;
    } else {
      // Truly airborne (jumped off a crest)
      vel.y += JETSKI.gravity * dt;
      entity.airborne = true;
    }

    // Pitch from front-back water height difference
    const frontH = (cornerHeights[0] + cornerHeights[1]) * 0.5;
    const backH = (cornerHeights[2] + cornerHeights[3]) * 0.5;
    const targetPitch = Math.atan2(frontH - backH, JETSKI.hullLength) * 0.5;

    // Roll from left-right water height difference
    const leftH = (cornerHeights[1] + cornerHeights[3]) * 0.5;
    const rightH = (cornerHeights[0] + cornerHeights[2]) * 0.5;
    const targetRoll = Math.atan2(leftH - rightH, JETSKI.hullWidth) * 0.3;

    entity.targetPitch = targetPitch;
    entity.targetRoll = targetRoll;
    entity.waterHeight = avgWaterHeight;

    return { submergedCount: entity.airborne ? 0 : 4, avgWaterHeight };
  }
}
