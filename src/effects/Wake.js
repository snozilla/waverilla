import * as THREE from 'three';

const MAX_WAKE_POINTS = 60;
const MAX_VERTS = MAX_WAKE_POINTS * 2;
const MAX_TRIS = (MAX_WAKE_POINTS - 1) * 2;
const WAKE_LIFETIME = 3;

export class Wake {
  constructor(scene) {
    this.points = [];
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX_VERTS * 3);
    this.colors = new Float32Array(MAX_VERTS * 4); // RGBA vertex colors for fade
    this.indices = new Uint16Array(MAX_TRIS * 3);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));
    this.geometry.setIndex(new THREE.BufferAttribute(this.indices, 1));

    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, material);
    scene.add(this.mesh);

    this.timer = 0;
  }

  update(position, rotation, speed, waterHeight, dt) {
    this.timer += dt;

    if (this.timer > 0.05 && Math.abs(speed) > 2) {
      this.timer = 0;

      const cosR = Math.cos(rotation);
      const sinR = Math.sin(rotation);
      const backX = position.x - sinR * 2;
      const backZ = position.z - cosR * 2;

      const width = 0.5 + Math.abs(speed) * 0.06;
      const perpX = cosR * width;
      const perpZ = -sinR * width;

      this.points.push({
        lx: backX + perpX, lz: backZ + perpZ,
        rx: backX - perpX, rz: backZ - perpZ,
        y: waterHeight + 0.05,
        age: 0,
        origLx: backX + perpX, origLz: backZ + perpZ,
        origRx: backX - perpX, origRz: backZ - perpZ,
      });

      if (this.points.length > MAX_WAKE_POINTS) {
        this.points.shift();
      }
    }

    // Build geometry
    let vi = 0;
    let alive = 0;

    for (let i = this.points.length - 1; i >= 0; i--) {
      const p = this.points[i];
      p.age += dt;

      if (p.age > WAKE_LIFETIME) {
        this.points.splice(i, 1);
        continue;
      }
    }

    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const life = 1 - p.age / WAKE_LIFETIME;

      // Spread wake outward over time
      const spread = 1 + p.age * 1.5;
      const cx = (p.origLx + p.origRx) * 0.5;
      const cz = (p.origLz + p.origRz) * 0.5;

      this.positions[vi * 3]     = cx + (p.origLx - cx) * spread;
      this.positions[vi * 3 + 1] = p.y;
      this.positions[vi * 3 + 2] = cz + (p.origLz - cz) * spread;
      this.colors[vi * 4]     = 1;
      this.colors[vi * 4 + 1] = 1;
      this.colors[vi * 4 + 2] = 1;
      this.colors[vi * 4 + 3] = life * 0.25;
      vi++;

      this.positions[vi * 3]     = cx + (p.origRx - cx) * spread;
      this.positions[vi * 3 + 1] = p.y;
      this.positions[vi * 3 + 2] = cz + (p.origRz - cz) * spread;
      this.colors[vi * 4]     = 1;
      this.colors[vi * 4 + 1] = 1;
      this.colors[vi * 4 + 2] = 1;
      this.colors[vi * 4 + 3] = life * 0.25;
      vi++;

      alive++;
    }

    // Zero remaining
    for (let i = vi * 3; i < this.positions.length; i++) {
      this.positions[i] = 0;
    }
    for (let i = vi * 4; i < this.colors.length; i++) {
      this.colors[i] = 0;
    }

    // Build triangle strip indices
    let ii = 0;
    for (let i = 0; i < alive - 1; i++) {
      const base = i * 2;
      this.indices[ii++] = base;
      this.indices[ii++] = base + 1;
      this.indices[ii++] = base + 2;

      this.indices[ii++] = base + 1;
      this.indices[ii++] = base + 3;
      this.indices[ii++] = base + 2;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.index.needsUpdate = true;
    this.geometry.setDrawRange(0, ii);
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.geometry.dispose();
    this.mesh.material.dispose();
  }
}
