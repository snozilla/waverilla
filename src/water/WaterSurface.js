import * as THREE from 'three';
import { GERSTNER_WAVES, WATER_SIZE, WATER_SEGMENTS } from '../utils/constants.js';

const vertexShader = /* glsl */`
uniform float uTime;
uniform float uAmplitudes[6];
uniform float uWavelengths[6];
uniform float uSpeeds[6];
uniform vec2  uDirections[6];
uniform float uSteepnesses[6];

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

#define PI 3.14159265359

vec3 gerstnerWave(vec2 dir, float amplitude, float wavelength, float speed, float steepness, vec2 pos, float time) {
    float k = 2.0 * PI / wavelength;
    float c = speed / k;
    float f = k * (dot(dir, pos) - c * time);
    float a = steepness / k;

    return vec3(
        dir.x * a * cos(f),
        amplitude * sin(f),
        dir.y * a * cos(f)
    );
}

void main() {
    vUv = uv;
    vec3 pos = position;
    vec3 tangent = vec3(1.0, 0.0, 0.0);
    vec3 binormal = vec3(0.0, 0.0, 1.0);

    for (int i = 0; i < 6; i++) {
        vec2 dir = normalize(uDirections[i]);
        float k = 2.0 * PI / uWavelengths[i];
        float c = uSpeeds[i] / k;
        float f = k * (dot(dir, pos.xz) - c * uTime);
        float a = uSteepnesses[i] / k;
        float amp = uAmplitudes[i];

        pos.x += dir.x * a * cos(f);
        pos.y += amp * sin(f);
        pos.z += dir.y * a * cos(f);

        // tangent
        tangent.x -= dir.x * dir.x * uSteepnesses[i] * sin(f);
        tangent.y += dir.x * amp * k * cos(f);
        tangent.z -= dir.x * dir.y * uSteepnesses[i] * sin(f);

        // binormal
        binormal.x -= dir.x * dir.y * uSteepnesses[i] * sin(f);
        binormal.y += dir.y * amp * k * cos(f);
        binormal.z -= dir.y * dir.y * uSteepnesses[i] * sin(f);
    }

    vNormal = normalize(cross(binormal, tangent));
    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const fragmentShader = /* glsl */`
uniform float uTime;
uniform vec3 uSunDirection;
uniform vec3 uWaterColor;
uniform vec3 uWaterDeepColor;
uniform samplerCube uEnvMap;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

#define PI 3.14159265359

// Simple noise for foam
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
    vec3 normal = normalize(vNormal);

    // Scrolling normal perturbation
    vec2 uv1 = vWorldPos.xz * 0.05 + uTime * 0.02;
    vec2 uv2 = vWorldPos.xz * 0.08 - uTime * 0.015;
    float n1 = noise(uv1 * 8.0);
    float n2 = noise(uv2 * 10.0);
    normal.xz += (n1 - 0.5) * 0.15 + (n2 - 0.5) * 0.1;
    normal = normalize(normal);

    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    // Fresnel
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0);
    fresnel = mix(0.02, 1.0, fresnel);

    // Reflection
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflectionColor = vec3(0.5, 0.7, 0.9); // fallback sky color
    #ifdef USE_ENVMAP
      reflectionColor = textureCube(uEnvMap, reflectDir).rgb;
    #endif

    // Water color with depth
    float depthFactor = smoothstep(-3.0, 1.0, vWorldPos.y);
    vec3 waterColor = mix(uWaterDeepColor, uWaterColor, depthFactor);

    // Specular sun glint
    vec3 halfDir = normalize(viewDir + uSunDirection);
    float spec = pow(max(dot(normal, halfDir), 0.0), 256.0);
    vec3 specular = vec3(1.0, 0.95, 0.8) * spec * 2.0;

    // Foam on peaks
    float foam = smoothstep(0.7, 1.5, vWorldPos.y);
    foam *= noise(vWorldPos.xz * 2.0 + uTime * 0.5) * 0.8 + 0.2;

    // Combine
    vec3 color = mix(waterColor, reflectionColor, fresnel);
    color += specular;
    color = mix(color, vec3(0.9, 0.95, 1.0), foam * 0.6);

    // Subsurface scattering approximation
    float sss = pow(max(dot(viewDir, -uSunDirection), 0.0), 4.0);
    sss *= max(0.0, normal.y) * 0.3;
    color += vec3(0.0, 0.5, 0.4) * sss;

    gl_FragColor = vec4(color, 0.92);
}
`;

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
