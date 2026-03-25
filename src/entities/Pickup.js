import * as THREE from 'three';
import { PICKUP } from '../utils/constants.js';

export class Pickup {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position.clone();
    this.active = true;
    this.respawnTimer = 0;
    this.mesh = this.createMesh();
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  createMesh() {
    const group = new THREE.Group();

    // Glowing octahedron
    const geo = new THREE.OctahedronGeometry(1.2, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x00ffff,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    this.octaMat = mat;
    const octahedron = new THREE.Mesh(geo, mat);
    group.add(octahedron);
    this.octahedron = octahedron;

    // Point light for glow
    const light = new THREE.PointLight(0x00ffff, 2, 12);
    light.position.set(0, 0, 0);
    group.add(light);
    this.light = light;

    return group;
  }

  update(time, dt) {
    if (!this.active) {
      this.mesh.visible = false;
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.active = true;
        this.mesh.visible = true;
      }
      return;
    }

    // Bob up and down
    this.mesh.position.y = this.position.y + 2.5 + Math.sin(time * 3) * 0.6;

    // Rotate
    this.octahedron.rotation.y = time * 2.0;
    this.octahedron.rotation.x = Math.sin(time * 1.5) * 0.3;

    // Cycle colors
    const hue = (time * 0.15) % 1;
    const color = new THREE.Color().setHSL(hue, 1, 0.6);
    this.octaMat.emissive.copy(color);
    this.light.color.copy(color);

    // Pulse emissive
    this.octaMat.emissiveIntensity = 1.2 + Math.sin(time * 5) * 0.5;
  }

  collect() {
    if (!this.active) return null;
    this.active = false;
    this.mesh.visible = false;
    this.respawnTimer = PICKUP.respawnTime;

    // Random powerup type
    const types = PICKUP.types;
    return types[Math.floor(Math.random() * types.length)];
  }

  reset() {
    this.active = true;
    this.mesh.visible = true;
    this.respawnTimer = 0;
  }

  destroy() {
    this.scene.remove(this.mesh);
    this.octahedron.geometry.dispose();
    this.octaMat.dispose();
  }
}
