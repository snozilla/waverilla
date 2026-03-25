import * as THREE from 'three';
import { RACE, COLORS, PICKUP } from '../utils/constants.js';
import { Buoy } from '../entities/Buoy.js';
import { Pickup } from '../entities/Pickup.js';

export class Track {
  constructor(scene, water, trackWaypoints, boostPadIndices) {
    this.scene = scene;
    this.water = water;
    this.rawWaypoints = trackWaypoints;
    this.waypoints = [];
    this.buoys = [];
    this.boostPads = [];
    this.gateNormals = [];
    this.sceneObjects = []; // track all added objects for cleanup

    // Build spline from waypoints
    const points = trackWaypoints.map(wp => new THREE.Vector3(wp.x, 0, wp.z));
    this.spline = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);

    // Sample waypoints along spline at even intervals
    const numCheckpoints = trackWaypoints.length;
    for (let i = 0; i < numCheckpoints; i++) {
      const t = i / numCheckpoints;
      const point = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t).normalize();

      // Gate normal (perpendicular to tangent in XZ plane)
      const gateNormal = new THREE.Vector3(-tangent.z, 0, tangent.x);

      this.waypoints.push(point);
      this.gateNormals.push(gateNormal);

      // Place buoy pair at each checkpoint
      const halfWidth = RACE.buoyGateWidth / 2;
      const leftPos = new THREE.Vector3(
        point.x + gateNormal.x * halfWidth,
        0,
        point.z + gateNormal.z * halfWidth
      );
      const rightPos = new THREE.Vector3(
        point.x - gateNormal.x * halfWidth,
        0,
        point.z - gateNormal.z * halfWidth
      );

      const leftBuoy = new Buoy(scene, leftPos.x, leftPos.z, true, water);
      const rightBuoy = new Buoy(scene, rightPos.x, rightPos.z, false, water);
      this.buoys.push(leftBuoy, rightBuoy);

      // Boost pads at specified indices
      if (boostPadIndices.includes(i)) {
        this.createBoostPad(scene, point, tangent, i);
      }
    }

    // Spawn pickups at midpoints between every-other waypoint pair
    this.pickups = [];
    this.spawnPickups(scene);

    // Start/finish line visual
    this.createStartLine(scene);

    // Visualize track path (thin line for debugging / reference)
    this.createTrackLine(scene);
  }

  spawnPickups(scene) {
    const numCheckpoints = this.rawWaypoints.length;
    for (let i = 0; i < numCheckpoints; i += 2) {
      const t1 = i / numCheckpoints;
      const t2 = ((i + 1) % numCheckpoints) / numCheckpoints;
      const midT = (t1 + t2) / 2;
      const point = this.spline.getPointAt(midT);
      point.y = 0;
      const pickup = new Pickup(scene, point);
      this.pickups.push(pickup);
    }
  }

  createBoostPad(scene, position, tangent, index) {
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00aaff,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });

    const group = new THREE.Group();
    group.position.copy(position);
    group.position.y = 0.1;
    group.rotation.y = Math.atan2(tangent.x, tangent.z);

    // Create 3 chevrons pointing forward (along +Z local)
    const chevronWidth = 6;
    const armLength = 3.5;
    const thickness = 1.8;
    const spacing = 3.2;

    for (let i = 0; i < 3; i++) {
      const shape = new THREE.Shape();
      // Outer chevron V
      shape.moveTo(0, armLength);
      shape.lineTo(chevronWidth / 2, 0);
      shape.lineTo(chevronWidth / 2, -thickness);
      shape.lineTo(0, armLength - thickness);
      shape.lineTo(-chevronWidth / 2, -thickness);
      shape.lineTo(-chevronWidth / 2, 0);
      shape.closePath();

      const geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(-Math.PI / 2);
      geo.rotateY(Math.PI);
      const mesh = new THREE.Mesh(geo, padMat);
      mesh.position.z = (i - 1) * spacing;
      group.add(mesh);
    }

    scene.add(group);
    this.sceneObjects.push(group);

    this.boostPads.push({
      position: position.clone(),
      radius: 8,
      mesh: group,
      index,
    });
  }

  createStartLine(scene) {
    const wp0 = this.waypoints[0];
    const normal = this.gateNormals[0];
    const width = RACE.buoyGateWidth;

    const geo = new THREE.PlaneGeometry(width, 3);
    geo.rotateX(-Math.PI / 2);

    // Checkerboard pattern via canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const checkSize = 16;
    for (let x = 0; x < canvas.width; x += checkSize) {
      for (let y = 0; y < canvas.height; y += checkSize) {
        ctx.fillStyle = ((x + y) / checkSize) % 2 === 0 ? '#ffffff' : '#111111';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    const line = new THREE.Mesh(geo, mat);
    line.position.copy(wp0);
    line.position.y = 0.15;
    line.rotation.y = Math.atan2(normal.x, normal.z) + Math.PI / 2;
    scene.add(line);
    this.startLine = line;
    this.sceneObjects.push(line);
  }

  createTrackLine(scene) {
    const points = this.spline.getPoints(200);
    const geo = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p.x, 2, p.z)));
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    this.sceneObjects.push(line);
  }

  update(time, dt) {
    // Update buoy bobbing
    for (const buoy of this.buoys) {
      buoy.update(time);
    }

    // Update pickups
    for (const pickup of this.pickups) {
      pickup.update(time, dt || 0.016);
    }

    // Animate boost pads
    const baseEmissive = 0.5 + Math.sin(time * 5) * 0.3;
    for (const pad of this.boostPads) {
      pad.mesh.position.y = 0.1 + Math.sin(time * 3) * 0.15;

      // Flash effect on hit
      let flashT = 0;
      if (pad.flashTime !== undefined) {
        flashT = Math.max(0, 1 - (time - pad.flashTime) / 0.4);
      }
      const emissive = baseEmissive + flashT * 2.0;
      const scale = 1 + flashT * 0.4;
      pad.mesh.scale.set(scale, 1, scale);

      pad.mesh.traverse(child => {
        if (child.isMesh) {
          child.material.emissiveIntensity = emissive;
          child.material.opacity = 0.6 + flashT * 0.4;
        }
      });
    }

    // Start line on water
    if (this.startLine) {
      this.startLine.position.y = this.water.getHeightAt(
        this.startLine.position.x,
        this.startLine.position.z,
        time
      ) + 0.15;
    }
  }

  getProgressAlongTrack(position) {
    // Find closest point on spline
    let bestT = 0;
    let bestDist = Infinity;
    const steps = 200;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pt = this.spline.getPointAt(t);
      const dx = position.x - pt.x;
      const dz = position.z - pt.z;
      const dist = dx * dx + dz * dz;
      if (dist < bestDist) {
        bestDist = dist;
        bestT = t;
      }
    }
    return bestT;
  }

  getCheckpointIndex(position, currentCheckpoint) {
    const wp = this.waypoints[currentCheckpoint];
    const dx = position.x - wp.x;
    const dz = position.z - wp.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < RACE.checkpointRadius) {
      return (currentCheckpoint + 1) % this.waypoints.length;
    }
    return currentCheckpoint;
  }

  // Check if racer passed through gate correctly (between buoys)
  checkGatePass(position, checkpointIndex) {
    const wp = this.waypoints[checkpointIndex];
    const normal = this.gateNormals[checkpointIndex];
    const dx = position.x - wp.x;
    const dz = position.z - wp.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < RACE.checkpointRadius) {
      // Check which side of the gate center the racer is on
      const side = dx * normal.x + dz * normal.z;
      return { passed: true, correct: true, side };
    }
    return { passed: false, correct: false, side: 0 };
  }

  checkBoostPad(position) {
    for (const pad of this.boostPads) {
      const dx = position.x - pad.position.x;
      const dz = position.z - pad.position.z;
      if (dx * dx + dz * dz < pad.radius * pad.radius) {
        return pad;
      }
    }
    return null;
  }

  checkPickup(position) {
    for (const pickup of this.pickups) {
      if (!pickup.active) continue;
      const dx = position.x - pickup.position.x;
      const dz = position.z - pickup.position.z;
      if (dx * dx + dz * dz < PICKUP.collectionRadius * PICKUP.collectionRadius) {
        return pickup;
      }
    }
    return null;
  }

  resetPickups() {
    for (const pickup of this.pickups) {
      pickup.reset();
    }
  }

  flashBoostPad(pad, time) {
    pad.flashTime = time;
  }

  destroy() {
    // Remove buoys
    for (const buoy of this.buoys) {
      this.scene.remove(buoy.mesh);
      buoy.mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    // Remove tracked scene objects (boost pads, start line, track line)
    for (const obj of this.sceneObjects) {
      this.scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    }
    // Remove pickups
    for (const pickup of this.pickups) {
      pickup.destroy();
    }
    this.pickups = [];
    this.buoys = [];
    this.boostPads = [];
    this.sceneObjects = [];
    this.waypoints = [];
    this.gateNormals = [];
  }
}
