import * as THREE from 'three';

const MAX_LINES = 40;

export class BoostEffect {
  constructor(scene) {
    this.lines = [];
    this.scene = scene;
    this.active = false;

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_LINES * 6); // 2 points per line
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.LineBasicMaterial({
      color: 0x00ccff,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    });

    this.lineSegments = new THREE.LineSegments(geo, mat);
    this.lineSegments.visible = false;
    scene.add(this.lineSegments);
  }

  setActive(active, position, forward) {
    this.active = active;
    this.lineSegments.visible = active;

    if (active && position) {
      const positions = this.lineSegments.geometry.attributes.position.array;

      for (let i = 0; i < MAX_LINES; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 1 + Math.random() * 3;
        const len = 3 + Math.random() * 5;

        const startX = position.x + Math.cos(angle) * dist;
        const startY = position.y + (Math.random() - 0.5) * 2;
        const startZ = position.z + Math.sin(angle) * dist;

        positions[i * 6] = startX;
        positions[i * 6 + 1] = startY;
        positions[i * 6 + 2] = startZ;

        positions[i * 6 + 3] = startX - forward.x * len;
        positions[i * 6 + 4] = startY;
        positions[i * 6 + 5] = startZ - forward.z * len;
      }

      this.lineSegments.geometry.attributes.position.needsUpdate = true;
    }
  }

  dispose(scene) {
    scene.remove(this.lineSegments);
    this.lineSegments.geometry.dispose();
    this.lineSegments.material.dispose();
  }
}
