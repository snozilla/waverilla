import * as THREE from 'three';
import { GERSTNER_WAVES, WATER_SIZE, WATER_SEGMENTS } from '../utils/constants.js';
import vertexShader from './waterVertex.glsl';
import fragmentShader from './waterFragment.glsl';

const TWO_PI = Math.PI * 2;

export class WaterSurface {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEGMENTS, WATER_SEGMENTS);
    geo.rotateX(-Math.PI / 2);

    this.uniforms = {
      uTime: { value: 0 },
      uAmplitudes: { value: GERSTNER_WAVES.map(w => w.amplitude) },
      uWavelengths: { value: GERSTNER_WAVES.map(w => w.wavelength) },
      uSpeeds: { value: GERSTNER_WAVES.map(w => w.speed) },
      uDirections: { value: GERSTNER_WAVES.map(w => new THREE.Vector2(w.direction[0], w.direction[1]).normalize()) },
      uSteepnesses: { value: GERSTNER_WAVES.map(w => w.steepness) },
      uSunDirection: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
      uWaterColor: { value: new THREE.Color(0.0, 0.3, 0.5) },
      uWaterDeepColor: { value: new THREE.Color(0.0, 0.05, 0.15) },
    };

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    scene.add(this.mesh);
  }

  update(time) {
    this.uniforms.uTime.value = time;
  }

  // CPU-side Gerstner wave height sampling (synced with GPU)
  getHeightAt(x, z, time) {
    let height = 0;
    for (let i = 0; i < GERSTNER_WAVES.length; i++) {
      const w = GERSTNER_WAVES[i];
      const dx = w.direction[0];
      const dz = w.direction[1];
      const len = Math.sqrt(dx * dx + dz * dz);
      const dirX = dx / len;
      const dirZ = dz / len;
      const k = TWO_PI / w.wavelength;
      const c = w.speed / k;
      const f = k * (dirX * x + dirZ * z - c * time);
      height += w.amplitude * Math.sin(f);
    }
    return height;
  }

  // Get height + normal for buoyancy
  getHeightAndNormal(x, z, time) {
    const eps = 0.5;
    const h  = this.getHeightAt(x, z, time);
    const hx = this.getHeightAt(x + eps, z, time);
    const hz = this.getHeightAt(x, z + eps, time);

    const normal = new THREE.Vector3(
      -(hx - h) / eps,
      1,
      -(hz - h) / eps
    ).normalize();

    return { height: h, normal };
  }

  // Full displaced position (for accurate hull sampling)
  getDisplacedPosition(x, z, time) {
    let dx = 0, dy = 0, dz = 0;
    for (let i = 0; i < GERSTNER_WAVES.length; i++) {
      const w = GERSTNER_WAVES[i];
      const wdx = w.direction[0];
      const wdz = w.direction[1];
      const len = Math.sqrt(wdx * wdx + wdz * wdz);
      const dirX = wdx / len;
      const dirZ = wdz / len;
      const k = TWO_PI / w.wavelength;
      const c = w.speed / k;
      const f = k * (dirX * x + dirZ * z - c * time);
      const a = w.steepness / k;
      dx += dirX * a * Math.cos(f);
      dy += w.amplitude * Math.sin(f);
      dz += dirZ * a * Math.cos(f);
    }
    return new THREE.Vector3(x + dx, dy, z + dz);
  }
}
