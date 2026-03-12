import * as THREE from 'three';
import { COLORS } from '../utils/constants.js';

export class Buoy {
  constructor(scene, x, z, isLeft, water) {
    this.water = water;
    this.baseX = x;
    this.baseZ = z;
    this.position = new THREE.Vector3(x, 0, z);

    const color = isLeft ? COLORS.buoyRed : COLORS.buoyYellow;

    const group = new THREE.Group();

    // Base float
    const baseGeo = new THREE.CylinderGeometry(0.8, 1.0, 0.6, 12);
    const baseMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: 0.3,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.3;
    group.add(base);

    // Post
    const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.5, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.y = 1.55;
    group.add(post);

    // Top sphere
    const topGeo = new THREE.SphereGeometry(0.3, 12, 8);
    const topMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
      roughness: 0.2,
    });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 2.9;
    group.add(top);

    // Stripe rings
    for (let i = 0; i < 2; i++) {
      const ringGeo = new THREE.TorusGeometry(0.85, 0.08, 8, 16);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.15 + i * 0.3;
      group.add(ring);
    }

    group.scale.setScalar(3);
    this.mesh = group;
    scene.add(group);
  }

  update(time) {
    const h = this.water.getHeightAt(this.baseX, this.baseZ, time);
    this.position.y = h;
    this.mesh.position.set(this.baseX, h, this.baseZ);

    // Gentle bobbing rotation
    this.mesh.rotation.x = Math.sin(time * 1.5 + this.baseX) * 0.05;
    this.mesh.rotation.z = Math.cos(time * 1.2 + this.baseZ) * 0.05;
  }
}
