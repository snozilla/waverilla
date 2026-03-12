import * as THREE from 'three';

export function createSkybox(scene) {
  // Procedural gradient skybox using a large sphere
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Gradient from top (deep blue) to horizon (light blue/white) to bottom (water color)
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#1a3a6a');
  gradient.addColorStop(0.3, '#4488cc');
  gradient.addColorStop(0.5, '#88bbdd');
  gradient.addColorStop(0.55, '#aaddee');
  gradient.addColorStop(0.6, '#ddeeff');
  gradient.addColorStop(0.65, '#ccdde8');
  gradient.addColorStop(1.0, '#446688');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Add some subtle cloud-like noise
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * canvas.width;
    const y = canvas.height * 0.3 + Math.random() * canvas.height * 0.25;
    const r = 20 + Math.random() * 60;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;

  const skyGeo = new THREE.SphereGeometry(900, 32, 32);
  const skyMat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Set as environment for reflections
  scene.environment = tex;

  return sky;
}
