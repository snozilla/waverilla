import * as THREE from 'three';
import { JETSKI, COLORS } from '../utils/constants.js';
import { clamp, lerp } from '../utils/math.js';
import { AssetLoader } from '../core/AssetLoader.js';

// Shared model references - loaded once, cloned per racer
let _sharedModel = null;
let _modelLoadPromise = null;
let _gorillaModel = null;
let _gorillaLoadPromise = null;

function loadSharedModel() {
  if (_modelLoadPromise) return _modelLoadPromise;
  _modelLoadPromise = AssetLoader.loadGLTF('models/jetski.glb').then((gltf) => {
    _sharedModel = gltf.scene;
    return _sharedModel;
  });
  return _modelLoadPromise;
}

function loadGorillaModel() {
  if (_gorillaLoadPromise) return _gorillaLoadPromise;
  _gorillaLoadPromise = AssetLoader.loadGLTF('src/models/gorilla.glb').then((gltf) => {
    _gorillaModel = gltf.scene;
    return _gorillaModel;
  });
  return _gorillaLoadPromise;
}

// Call this before creating any JetSki instances
export async function preloadJetSkiModel() {
  await Promise.all([loadSharedModel(), loadGorillaModel()]);
}

export class JetSki {
  constructor(scene, colorIndex = 0) {
    this.scene = scene;
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotation = 0;
    this.pitch = 0;
    this.roll = 0;
    this.targetPitch = 0;
    this.targetRoll = 0;
    this.speed = 0;
    this.airborne = false;
    this.waterHeight = 0;
    this.boosting = false;
    this.boostTimer = 0;
    this.power = 0;
    this.leanRoll = 0;

    this.currentCheckpoint = 0;
    this.lap = 0;
    this.progress = 0;
    this.finished = false;
    this.finishTime = 0;

    this.colorIndex = colorIndex;

    // Stun state
    this.stunned = false;
    this.stunnedTimer = 0;
    this.gorillaMesh = null;
    this.gorillaOrigPos = null;
    this.gorillaOrigRot = null;

    // Pickup / powerup state
    this.activePickup = null;
    this.pickupTimer = 0;
    this.pickupMaxDuration = 0;
    this.laserTarget = null;
    this.originalScale = 1;

    // Use GLB model if preloaded, otherwise fallback to placeholder
    if (_sharedModel) {
      this.mesh = this.createFromGLB(COLORS.racers[colorIndex]);
    } else {
      this.mesh = this.createPlaceholder(COLORS.racers[colorIndex]);
      // Try loading async as fallback
      this.loadModelAsync(COLORS.racers[colorIndex]);
    }
    scene.add(this.mesh);
  }

  createPlaceholder(color) {
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(3.2, 1.2, 7);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5 });
    const hull = new THREE.Mesh(geo, mat);
    hull.position.y = 0.3;
    group.add(hull);
    return group;
  }

  createFromGLB(color) {
    let clone = _sharedModel.clone();

    // Compute bounding box to auto-scale and center the model
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());

    // Scale to target size
    const targetLength = 7;
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = targetLength / maxDim;
    clone.scale.setScalar(scale);

    // Recalculate after scaling
    box.setFromObject(clone);
    const scaledCenter = box.getCenter(new THREE.Vector3());

    // Center horizontally, sit bottom at y=0
    clone.position.set(-scaledCenter.x, -box.min.y, -scaledCenter.z);

    // Rotate model so it faces +Z (forward in game)
    const pivot = new THREE.Group();
    pivot.add(clone);
    pivot.rotation.y = 0;

    const inner = new THREE.Group();
    inner.add(pivot);

    // Apply racer color tint to materials
    const tintColor = new THREE.Color(color);
    inner.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        if (child.material.color) {
          const orig = child.material.color.clone();
          const brightness = orig.r + orig.g + orig.b;
          if (brightness > 0.3) {
            child.material.color.lerp(tintColor, 0.6);
          }
        }
        child.material.envMapIntensity = 0.5;
        child.castShadow = true;
      }
    });

    const wrapper = new THREE.Group();
    wrapper.add(inner);

    // Add gorilla rider
    if (_gorillaModel) {
      const gorilla = _gorillaModel.clone();
      const gBox = new THREE.Box3().setFromObject(gorilla);
      const gSize = gBox.getSize(new THREE.Vector3());
      const gScale = 2.5 / Math.max(gSize.x, gSize.y, gSize.z);
      gorilla.scale.setScalar(gScale);

      gBox.setFromObject(gorilla);
      const gCenter = gBox.getCenter(new THREE.Vector3());
      gorilla.position.set(-gCenter.x, -gBox.min.y + 1.0, -gCenter.z + 0.3);

      // Tint gorilla with racer color (subtle)
      gorilla.traverse((child) => {
        if (child.isMesh) {
          child.material = child.material.clone();
          child.castShadow = true;
        }
      });

      inner.add(gorilla);
      this.gorillaMesh = gorilla;
      this.gorillaOrigPos = gorilla.position.clone();
      this.gorillaOrigRot = gorilla.rotation.clone();
    }

    return wrapper;
  }

  async loadModelAsync(color) {
    try {
      await loadSharedModel();
      const newMesh = this.createFromGLB(color);
      newMesh.position.copy(this.mesh.position);
      newMesh.rotation.copy(this.mesh.rotation);

      const parent = this.mesh.parent;
      if (parent) {
        parent.remove(this.mesh);
        parent.add(newMesh);
      }
      this.mesh = newMesh;
    } catch (e) {
      console.warn('Failed to load jetski.glb:', e);
    }
  }

  stun(duration) {
    this.stunned = true;
    this.stunnedTimer = duration;
  }

  updateStun(dt) {
    if (!this.stunned) return;
    this.stunnedTimer -= dt;

    if (this.gorillaMesh && this.gorillaOrigPos) {
      const totalDuration = 3;
      const elapsed = totalDuration - this.stunnedTimer;

      if (elapsed < 0.3) {
        // Fall sideways quickly
        const t = elapsed / 0.3;
        this.gorillaMesh.rotation.z = t * 1.4;
        this.gorillaMesh.position.y = this.gorillaOrigPos.y - t * 0.8;
      } else if (this.stunnedTimer > 0.5) {
        // Stay fallen
        this.gorillaMesh.rotation.z = 1.4;
        this.gorillaMesh.position.y = this.gorillaOrigPos.y - 0.8;
      } else {
        // Recover in last 0.5s
        const t = this.stunnedTimer / 0.5;
        this.gorillaMesh.rotation.z = t * 1.4;
        this.gorillaMesh.position.y = this.gorillaOrigPos.y - t * 0.8;
      }
    }

    if (this.stunnedTimer <= 0) {
      this.stunned = false;
      this.stunnedTimer = 0;
      if (this.gorillaMesh && this.gorillaOrigPos) {
        this.gorillaMesh.rotation.z = this.gorillaOrigRot.z;
        this.gorillaMesh.position.y = this.gorillaOrigPos.y;
      }
    }
  }

  activatePickup(type, duration) {
    this.activePickup = type;
    this.pickupTimer = duration;
    this.pickupMaxDuration = duration;
    this.laserTarget = null;

    if (type === 'giant') {
      this.originalScale = this.mesh.scale.x;
      this.mesh.scale.setScalar(2);
    }
  }

  updatePickup(dt) {
    if (!this.activePickup) return;
    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0) {
      // Deactivate
      if (this.activePickup === 'giant') {
        this.mesh.scale.setScalar(this.originalScale || 1);
      }
      this.activePickup = null;
      this.pickupTimer = 0;
      this.pickupMaxDuration = 0;
      this.laserTarget = null;
    }
  }

  applyPhysics(throttle, steer, dt, isBoosting = false) {
    // If stunned, only apply drag (no thrust/steering)
    if (this.stunned) {
      const dragX = -this.velocity.x * Math.abs(this.velocity.x) * JETSKI.dragCoeff;
      const dragZ = -this.velocity.z * Math.abs(this.velocity.z) * JETSKI.dragCoeff;
      this.velocity.x += dragX * dt;
      this.velocity.z += dragZ * dt;

      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;
      this.position.z += this.velocity.z * dt;

      const fwdX = Math.sin(this.rotation);
      const fwdZ = Math.cos(this.rotation);
      this.speed = this.velocity.x * fwdX + this.velocity.z * fwdZ;

      this.mesh.position.copy(this.position);
      this.mesh.rotation.order = 'YXZ';
      this.mesh.rotation.y = this.rotation;
      this.mesh.rotation.x = this.pitch;
      this.mesh.rotation.z = this.roll;
      return;
    }

    // Turbo powerup forces boost state
    if (this.activePickup === 'turbo') {
      this.boosting = true;
      this.boostTimer = Math.max(this.boostTimer, 0.5);
    } else if (isBoosting && this.boostTimer > 0) {
      this.boosting = true;
      this.boostTimer -= dt;
    } else {
      this.boosting = false;
    }

    const maxSpd = this.boosting ? JETSKI.boostMaxSpeed : JETSKI.maxSpeed;
    const thrust = this.boosting ? JETSKI.boostThrust : JETSKI.maxThrust;
    const powerBonus = 1 + this.power * 0.04;

    const fwdX = Math.sin(this.rotation);
    const fwdZ = Math.cos(this.rotation);

    this.speed = this.velocity.x * fwdX + this.velocity.z * fwdZ;

    const thrustForce = throttle * thrust * powerBonus;
    this.velocity.x += fwdX * thrustForce * dt;
    this.velocity.z += fwdZ * thrustForce * dt;

    const speedFactor = clamp(Math.abs(this.speed) / maxSpd, 0, 1);
    const turnRate = lerp(JETSKI.turnSpeed, JETSKI.turnSpeedAtMax, speedFactor);

    if (!this.airborne) {
      this.rotation += steer * turnRate * dt * (this.speed > 0 ? 1 : -0.5);
    }

    const dragX = -this.velocity.x * Math.abs(this.velocity.x) * JETSKI.dragCoeff;
    const dragZ = -this.velocity.z * Math.abs(this.velocity.z) * JETSKI.dragCoeff;
    this.velocity.x += dragX * dt;
    this.velocity.z += dragZ * dt;

    const rightX = Math.cos(this.rotation);
    const rightZ = -Math.sin(this.rotation);
    const lateralSpeed = this.velocity.x * rightX + this.velocity.z * rightZ;
    const lateralDecay = 1 - Math.exp(-JETSKI.lateralDrag * 60 * dt);
    this.velocity.x -= rightX * lateralSpeed * lateralDecay;
    this.velocity.z -= rightZ * lateralSpeed * lateralDecay;

    const currentSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
    if (currentSpeed > maxSpd * powerBonus) {
      const s = maxSpd * powerBonus / currentSpeed;
      this.velocity.x *= s;
      this.velocity.z *= s;
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    this.leanRoll = -steer * speedFactor * JETSKI.leanFactor;

    this.pitch = lerp(this.pitch, this.targetPitch + (this.airborne ? -0.1 : 0), 0.1);
    this.roll = lerp(this.roll, this.targetRoll + this.leanRoll, 0.1);

    this.mesh.position.copy(this.position);
    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.y = this.rotation;
    this.mesh.rotation.x = this.pitch;
    this.mesh.rotation.z = this.roll;
  }

  getForward() {
    return new THREE.Vector3(Math.sin(this.rotation), 0, Math.cos(this.rotation));
  }

  getSpeedKmh() {
    return Math.abs(this.speed) * 3.6;
  }
}
