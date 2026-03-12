import * as THREE from 'three';

const MAX_PARTICLES = 100;

export class Spray {
  constructor(scene) {
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.velocities = [];
    this.ages = new Float32Array(MAX_PARTICLES);
    this.alive = new Uint8Array(MAX_PARTICLES);

    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xccddff,
      size: 0.4,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, mat);
    scene.add(this.points);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.velocities.push(new THREE.Vector3());
      this.ages[i] = 99;
    }

    this.nextParticle = 0;
    this.emitTimer = 0;
  }

  emit(position, rotation, speed, waterHeight) {
    if (Math.abs(speed) < 5) return;

    const count = Math.floor(Math.abs(speed) / 10);
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);

    for (let i = 0; i < count; i++) {
      const idx = this.nextParticle;
      this.nextParticle = (this.nextParticle + 1) % MAX_PARTICLES;

      // Emit from sides/back of jet ski
      const side = (Math.random() - 0.5) * 2;
      const back = -1.5 - Math.random();

      const px = position.x + cosR * side + sinR * back;
      const pz = position.z - sinR * side + cosR * back;

      this.positions[idx * 3] = px;
      this.positions[idx * 3 + 1] = waterHeight + 0.2;
      this.positions[idx * 3 + 2] = pz;

      // Velocity: upward + outward
      this.velocities[idx].set(
        (Math.random() - 0.5) * 3 + cosR * side * 2,
        2 + Math.random() * 3,
        (Math.random() - 0.5) * 3 - sinR * side * 2
      );

      this.ages[idx] = 0;
      this.alive[idx] = 1;
    }
  }

  update(dt) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (!this.alive[i]) continue;

      this.ages[i] += dt;
      if (this.ages[i] > 1.5) {
        this.alive[i] = 0;
        this.positions[i * 3 + 1] = -100;
        continue;
      }

      this.velocities[i].y -= 9.8 * dt;

      this.positions[i * 3] += this.velocities[i].x * dt;
      this.positions[i * 3 + 1] += this.velocities[i].y * dt;
      this.positions[i * 3 + 2] += this.velocities[i].z * dt;
    }

    this.points.geometry.attributes.position.needsUpdate = true;
  }

  dispose(scene) {
    scene.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
