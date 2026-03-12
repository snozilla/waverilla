import * as THREE from 'three';
import { JETSKI, AI } from '../utils/constants.js';
import { clamp, shortAngleDist } from '../utils/math.js';

// Skill profiles: [speedMult, turnMult, aggression, wobbleAmplitude]
const SKILL_PROFILES = [
  { speed: 0.92, turn: 0.95, aggression: 0.6, wobble: 2.0 },  // AI 1 - decent
  { speed: 0.88, turn: 0.90, aggression: 0.4, wobble: 3.0 },  // AI 2 - average
  { speed: 0.95, turn: 0.98, aggression: 0.8, wobble: 1.5 },  // AI 3 - strong
  { speed: 0.85, turn: 0.85, aggression: 0.3, wobble: 4.0 },  // AI 4 - weak
  { speed: 0.90, turn: 0.92, aggression: 0.5, wobble: 2.5 },  // AI 5 - medium
];

export class AIController {
  constructor(index) {
    this.index = index;
    this.profile = SKILL_PROFILES[index] || SKILL_PROFILES[0];
    this.lateralOffset = (Math.random() - 0.5) * AI.lateralOffsetRange;
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.stuckTimer = 0;
    this.lastProgress = 0;
  }

  update(jetski, track, playerProgress, time, dt) {
    if (jetski.finished) return { throttle: 0, steer: 0 };

    // Rubber banding
    const progressDiff = playerProgress - jetski.progress;
    const rubberBand = 1 + clamp(progressDiff * AI.rubberBandStrength, -0.15, AI.maxRubberBandBoost - 1);

    // Current target waypoint
    const numWaypoints = track.waypoints.length;
    const targetIdx = jetski.currentCheckpoint;
    const nextIdx = (targetIdx + 1) % numWaypoints;

    const target = track.waypoints[targetIdx];
    const nextTarget = track.waypoints[nextIdx];

    // Add lateral offset + wobble
    const gateNormal = track.gateNormals[targetIdx];
    const wobble = Math.sin(time * 1.5 + this.wobblePhase) * this.profile.wobble;
    const offset = this.lateralOffset + wobble;

    const aimX = target.x + gateNormal.x * offset;
    const aimZ = target.z + gateNormal.z * offset;

    // Steering toward target
    const dx = aimX - jetski.position.x;
    const dz = aimZ - jetski.position.z;
    const targetAngle = Math.atan2(dx, dz);
    const angleDiff = shortAngleDist(jetski.rotation, targetAngle);

    let steer = clamp(angleDiff * 2.5, -1, 1) * this.profile.turn;

    // Throttle control
    let throttle = this.profile.speed * rubberBand;

    // Slow down in sharp turns
    if (Math.abs(angleDiff) > 0.8) {
      throttle *= 0.7;
    }

    // Boost on boost pads
    if (track.checkBoostPad(jetski.position)) {
      jetski.boostTimer = 2.0;
    }

    // Anti-stuck: if no progress in a while, steer harder
    if (Math.abs(jetski.progress - this.lastProgress) < 0.01) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 2) {
        steer += (Math.random() - 0.5) * 2;
        throttle = 1;
      }
    } else {
      this.stuckTimer = 0;
    }
    this.lastProgress = jetski.progress;

    return { throttle, steer };
  }
}
