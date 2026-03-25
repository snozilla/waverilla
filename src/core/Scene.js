import * as THREE from 'three';
import { COLORS, IS_MOBILE } from '../utils/constants.js';

export class GameScene {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !IS_MOBILE,
      powerPreference: IS_MOBILE ? 'default' : 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // Mobile: cap at 1.5x to massively reduce GPU load (3x = 9x pixels)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x88bbdd, 0.0015);

    // Lights
    const ambient = new THREE.AmbientLight(0x6688aa, 0.6);
    this.scene.add(ambient);

    this.sunLight = new THREE.DirectionalLight(0xffeedd, 1.5);
    this.sunLight.position.set(100, 80, 50);
    this.scene.add(this.sunLight);

    const hemi = new THREE.HemisphereLight(0x88ccff, 0x446633, 0.4);
    this.scene.add(hemi);

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render(camera) {
    this.renderer.render(this.scene, camera);
  }
}
