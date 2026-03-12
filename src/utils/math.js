import * as THREE from 'three';

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function smoothDamp(current, target, velocity, smoothTime, maxSpeed, dt) {
  smoothTime = Math.max(0.0001, smoothTime);
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const maxChange = maxSpeed * smoothTime;
  change = clamp(change, -maxChange, maxChange);
  const adjustedTarget = current - change;
  const temp = (velocity + omega * change) * dt;
  velocity = (velocity - omega * temp) * exp;
  let output = adjustedTarget + (change + temp) * exp;
  if (target - current > 0 === output > target) {
    output = target;
    velocity = (output - target) / dt;
  }
  return { value: output, velocity };
}

export function angle2D(x, z) {
  return Math.atan2(x, z);
}

export function distXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function closestPointOnSegment(p, a, b) {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ap = new THREE.Vector3().subVectors(p, a);
  let t = ap.dot(ab) / ab.dot(ab);
  t = clamp(t, 0, 1);
  return new THREE.Vector3().copy(a).addScaledVector(ab, t);
}

export function shortAngleDist(from, to) {
  const max = Math.PI * 2;
  const diff = ((to - from) % max + max) % max;
  return diff > Math.PI ? diff - max : diff;
}
