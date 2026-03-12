import * as THREE from 'three';
import { CAMERA } from '../utils/constants.js';
import { lerp } from '../utils/math.js';

export class ChaseCamera {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(CAMERA.fovBase, aspect, 0.5, 2000);
    this.currentPos = new THREE.Vector3(0, 10, -20);
    this.currentLookAt = new THREE.Vector3(0, 0, 0);
    this.shakeAmount = 0;
    this.targetFov = CAMERA.fovBase;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  update(target, dt) {
    const fwd = target.getForward();
    const speed = Math.abs(target.speed);

    // Desired camera position behind and above
    const desiredX = target.position.x - fwd.x * CAMERA.distance;
    const desiredY = target.position.y + CAMERA.height;
    const desiredZ = target.position.z - fwd.z * CAMERA.distance;

    // Smooth follow
    const t = 1 - Math.exp(-CAMERA.lerpSpeed * dt);
    this.currentPos.x = lerp(this.currentPos.x, desiredX, t);
    this.currentPos.y = lerp(this.currentPos.y, desiredY, t);
    this.currentPos.z = lerp(this.currentPos.z, desiredZ, t);

    // Look-at point ahead of target
    const lookAtX = target.position.x + fwd.x * 5;
    const lookAtY = target.position.y + CAMERA.lookAheadY;
    const lookAtZ = target.position.z + fwd.z * 5;

    this.currentLookAt.x = lerp(this.currentLookAt.x, lookAtX, t);
    this.currentLookAt.y = lerp(this.currentLookAt.y, lookAtY, t);
    this.currentLookAt.z = lerp(this.currentLookAt.z, lookAtZ, t);

    // Screen shake
    let shakeX = 0, shakeY = 0;
    if (this.shakeAmount > 0) {
      shakeX = (Math.random() - 0.5) * this.shakeAmount;
      shakeY = (Math.random() - 0.5) * this.shakeAmount;
      this.shakeAmount *= 0.9;
      if (this.shakeAmount < 0.01) this.shakeAmount = 0;
    }

    this.camera.position.set(
      this.currentPos.x + shakeX,
      this.currentPos.y + shakeY,
      this.currentPos.z
    );
    this.camera.lookAt(this.currentLookAt);

    // Speed-dependent FOV
    const speedRatio = speed / 45;
    this.targetFov = lerp(CAMERA.fovBase, CAMERA.fovSpeed, speedRatio);
    if (target.boosting) this.targetFov = CAMERA.fovBoost;
    this.camera.fov = lerp(this.camera.fov, this.targetFov, t);
    this.camera.updateProjectionMatrix();
  }

  addShake(amount) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }
}
