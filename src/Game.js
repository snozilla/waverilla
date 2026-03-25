import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { GameScene } from './core/Scene.js';
import { InputManager } from './core/InputManager.js';
import { WaterSurface } from './water/WaterSurface.js';
import { BuoyancyPhysics } from './physics/BuoyancyPhysics.js';
import { CollisionSystem } from './physics/CollisionSystem.js';
import { JetSki, preloadJetSkiModel } from './entities/JetSki.js';
import { ChaseCamera } from './camera/ChaseCamera.js';
import { Track } from './track/Track.js';
import { RaceManager } from './race/RaceManager.js';
import { AIController } from './ai/AIController.js';
import { Wake } from './effects/Wake.js';
import { Spray } from './effects/Spray.js';
import { BoostEffect } from './effects/BoostEffect.js';
import { createSkybox } from './effects/Skybox.js';
import { HUD } from './hud/HUD.js';
import { AudioManager } from './audio/AudioManager.js';
import { RACE, TRACKS, PICKUP } from './utils/constants.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.gameScene = new GameScene(this.canvas);
    this.scene = this.gameScene.scene;
    this.input = new InputManager();
    this.hud = new HUD();
    this.audio = new AudioManager();
    this.clock = new THREE.Clock();

    this.time = 0;
    this.started = false;
    this.initialized = false;
    this.playerWasAirborne = false;
    this.selectedTrackIndex = 0;
    this.paused = false;
    this._pauseHeld = false;

    this.init();
  }

  async init() {
    // Skybox
    createSkybox(this.scene);

    // Water
    this.water = new WaterSurface(this.scene);

    // Track
    const trackDef = TRACKS[this.selectedTrackIndex];
    this.track = new Track(this.scene, this.water, trackDef.waypoints, trackDef.boostPadIndices);

    // Physics
    this.buoyancy = new BuoyancyPhysics(this.water);
    this.collisions = new CollisionSystem();

    // Camera (needed for pre-load rendering)
    this.chaseCamera = new ChaseCamera(window.innerWidth / window.innerHeight);

    // Post-processing
    this.setupPostProcessing();

    // Preload jet ski GLB model before creating racers
    const selectPrompt = document.querySelector('.select-prompt');
    const trackSelect = document.getElementById('track-select');
    selectPrompt.textContent = 'Loading...';
    trackSelect.style.display = 'none';
    try {
      await preloadJetSkiModel();
    } catch (e) {
      console.warn('GLB preload failed, using placeholders:', e);
    }
    selectPrompt.textContent = 'Select a Track';
    trackSelect.style.display = '';

    // Player jet ski (model is now preloaded - will use GLB directly)
    this.player = new JetSki(this.scene, 0);

    // AI jet skis
    this.aiRacers = [];
    this.aiControllers = [];
    for (let i = 0; i < 5; i++) {
      const ai = new JetSki(this.scene, i + 1);
      this.aiRacers.push(ai);
      this.aiControllers.push(new AIController(i));
    }

    this.allRacers = [this.player, ...this.aiRacers];

    // Effects for each racer
    this.wakes = this.allRacers.map(() => new Wake(this.scene));
    this.sprays = this.allRacers.map(() => new Spray(this.scene));
    this.boostEffect = new BoostEffect(this.scene);

    // Laser traction visible line
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3()
    ]);
    const laserMat = new THREE.LineBasicMaterial({
      color: 0xaa00ff,
      transparent: true,
      opacity: 0.7,
    });
    this.laserLine = new THREE.Line(laserGeo, laserMat);
    this.laserLine.visible = false;
    this.laserLine.frustumCulled = false;
    this.scene.add(this.laserLine);

    // Race manager
    this.raceManager = new RaceManager(this.track, this.allRacers);
    this.setupRaceCallbacks();
    this.setupPauseCallbacks();

    // Position racers at start
    this.positionAtStart();

    this.initialized = true;

    // Draw track previews on level select cards
    this.drawTrackPreviews();

    // Level select handler
    const startOverlay = document.getElementById('start-overlay');
    this.startOverlay = startOverlay;

    // Init audio + play intro on first click anywhere on the overlay
    startOverlay.addEventListener('click', () => {
      this.audio.init();
    }, { once: true });

    // Bind track card clicks
    const trackCards = startOverlay.querySelectorAll('.track-card');
    trackCards.forEach(card => {
      card.addEventListener('click', () => {
        if (!this.initialized) return;
        const idx = parseInt(card.dataset.trackIndex, 10);
        this.selectTrack(idx);
        this.audio.skipIntro = true;
        this.audio.init();
        this.audio.stopIntro();
        this.audio.restartEngine();
        this.audio.playTrackMusic(TRACKS[idx].music);
        startOverlay.classList.add('hidden');
        this.hud.show();
        this.started = true;
        this.raceManager.startCountdown();
      });
    });

    // Restart button → back to level select
    this.hud.restartBtn.addEventListener('click', () => {
      this.backToLevelSelect();
    });
  }

  setupRaceCallbacks() {
    this.raceManager.onCountdownTick = (num) => {
      this.hud.showCountdown(num);
      this.audio.playCountdown(num);
    };

    this.raceManager.onRaceStart = () => {
      this.hud.showCountdown(0); // GO!
      this.audio.playCountdown(0);
    };

    this.raceManager.onLapComplete = (racer, lap) => {
      if (racer === this.player) {
        this.audio.playLapComplete();
      }
    };

    this.raceManager.onRaceFinish = (finishOrder) => {
      this.audio.playFinish();
      this.audio.stopEngine();
      this.audio.stopTrackMusic();
      setTimeout(() => {
        this.hud.showResults(finishOrder);
      }, 1500);
    };
  }

  setupPauseCallbacks() {
    this.hud.onResume = () => this.togglePause();
    this.hud.onSFXVolume = (v) => this.audio.setSFXVolume(v);
    this.hud.onMusicVolume = (v) => this.audio.setMusicVolume(v);
    this.hud.onPauseRestart = () => this.backToLevelSelect();
  }

  togglePause() {
    this.paused = !this.paused;
    if (this.paused) {
      this.audio.pauseAudio();
      this.hud.showPause();
    } else {
      this.audio.resumeAudio();
      this.hud.hidePause();
    }
  }

  drawTrackPreviews() {
    const canvases = document.querySelectorAll('.track-preview');
    canvases.forEach((canvas, i) => {
      if (i >= TRACKS.length) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const wps = TRACKS[i].waypoints;

      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const wp of wps) {
        minX = Math.min(minX, wp.x); maxX = Math.max(maxX, wp.x);
        minZ = Math.min(minZ, wp.z); maxZ = Math.max(maxZ, wp.z);
      }
      const pad = 20;
      minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;
      const rangeX = maxX - minX;
      const rangeZ = maxZ - minZ;

      const toX = x => ((x - minX) / rangeX) * (w - 12) + 6;
      const toY = z => ((z - minZ) / rangeZ) * (h - 12) + 6;

      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0,204,255,0.6)';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let j = 0; j <= wps.length; j++) {
        const wp = wps[j % wps.length];
        if (j === 0) ctx.moveTo(toX(wp.x), toY(wp.z));
        else ctx.lineTo(toX(wp.x), toY(wp.z));
      }
      ctx.stroke();

      // Start dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(toX(wps[0].x), toY(wps[0].z), 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  positionAtStart() {
    const trackDef = TRACKS[this.selectedTrackIndex];
    const wp0 = trackDef.waypoints[0];
    const wp1 = trackDef.waypoints[1];

    // Direction from wp0 to wp1
    const dirX = wp1.x - wp0.x;
    const dirZ = wp1.z - wp0.z;
    const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
    const fwdX = dirX / len;
    const fwdZ = dirZ / len;

    // Perpendicular for grid formation
    const perpX = -fwdZ;
    const perpZ = fwdX;

    const heading = Math.atan2(fwdX, fwdZ);

    // Position racers in 2x3 grid behind start
    const positions = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: -1 },
      { row: 1, col: 1 },
      { row: 2, col: 0 },
      { row: 2, col: 1 },
    ];

    for (let i = 0; i < this.allRacers.length; i++) {
      const racer = this.allRacers[i];
      const p = positions[i] || { row: 2, col: 0 };

      const rx = wp0.x - fwdX * (p.row * 5 + 5) + perpX * (p.col * 4 - 2);
      const rz = wp0.z - fwdZ * (p.row * 5 + 5) + perpZ * (p.col * 4 - 2);
      const ry = this.water.getHeightAt(rx, rz, 0) + 0.5;
      racer.position.set(rx, ry, rz);
      racer.rotation = heading;
      racer.velocity.set(0, 0, 0);
      racer.speed = 0;
    }
  }

  setupPostProcessing() {
    const renderer = this.gameScene.renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(this.scene, this.chaseCamera.camera);
    this.composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.3,  // strength
      0.4,  // radius
      0.85  // threshold
    );
    this.composer.addPass(bloomPass);

    const fxaaPass = new ShaderPass(FXAAShader);
    const pixelRatio = renderer.getPixelRatio();
    fxaaPass.material.uniforms['resolution'].value.set(
      1 / (window.innerWidth * pixelRatio),
      1 / (window.innerHeight * pixelRatio)
    );
    this.composer.addPass(fxaaPass);

    window.addEventListener('resize', () => {
      this.composer.setSize(window.innerWidth, window.innerHeight);
      const pr = renderer.getPixelRatio();
      fxaaPass.material.uniforms['resolution'].value.set(
        1 / (window.innerWidth * pr),
        1 / (window.innerHeight * pr)
      );
    });
  }

  selectTrack(index) {
    this.selectedTrackIndex = index;
    // Tear down old track
    this.track.destroy();
    // Build new track
    const trackDef = TRACKS[index];
    this.track = new Track(this.scene, this.water, trackDef.waypoints, trackDef.boostPadIndices);
    // Reconnect race manager
    this.raceManager.track = this.track;
    this.raceManager.reset();
    this.resetPickups();
    this.positionAtStart();
  }

  backToLevelSelect() {
    this.paused = false;
    this.hud.hidePause();
    this.audio.resumeAudio();
    this.audio.stopTrackMusic();
    this.audio.stopEngine();
    this.hud.hideResults();
    this.hud.hide();
    this.started = false;
    this.raceManager.reset();
    this.resetPickups();
    this.positionAtStart();
    this.startOverlay.classList.remove('hidden');
  }

  resetPickups() {
    // Reset all racer powerups
    for (const racer of this.allRacers) {
      if (racer.activePickup === 'giant') {
        racer.mesh.scale.setScalar(racer.originalScale || 1);
      }
      racer.activePickup = null;
      racer.pickupTimer = 0;
      racer.pickupMaxDuration = 0;
      racer.laserTarget = null;
    }
    // Reset track pickups
    this.track.resetPickups();
  }

  restart() {
    this.paused = false;
    this.hud.hidePause();
    this.audio.resumeAudio();
    this.hud.hideResults();
    this.raceManager.reset();
    this.resetPickups();
    this.positionAtStart();
    this.raceManager.startCountdown();
  }

  update() {
    if (!this.initialized) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    if (!this.started) {
      // Animate water + track + buoyancy even before start so racers are visible
      this.water.update(this.time);
      this.track.update(this.time, dt);
      for (const racer of this.allRacers) {
        this.buoyancy.apply(racer, this.time, dt);
        racer.mesh.position.copy(racer.position);
        racer.mesh.rotation.order = 'YXZ';
        racer.mesh.rotation.y = racer.rotation;
        racer.mesh.rotation.x = racer.pitch;
        racer.mesh.rotation.z = racer.roll;
      }

      // Camera behind the starting grid looking forward along track
      const camTrack = TRACKS[this.selectedTrackIndex];
      const wp0 = camTrack.waypoints[0];
      const wp1 = camTrack.waypoints[1];
      const dx = wp1.x - wp0.x, dz = wp1.z - wp0.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      const fwdX = dx / len, fwdZ = dz / len;

      const camX = wp0.x - fwdX * 30;
      const camZ = wp0.z - fwdZ * 30;
      const camY = this.water.getHeightAt(camX, camZ, this.time) + 12;

      this.chaseCamera.currentPos.set(camX, camY, camZ);
      this.chaseCamera.currentLookAt.set(wp0.x + fwdX * 20, 2, wp0.z + fwdZ * 20);
      this.chaseCamera.camera.position.copy(this.chaseCamera.currentPos);
      this.chaseCamera.camera.lookAt(this.chaseCamera.currentLookAt);
      this.composer.render();
      return;
    }

    // Pause toggle (only during racing, not on results)
    const isRacing = this.raceManager.state === 'racing';
    if (this.input.pause && !this._pauseHeld && isRacing) {
      this._pauseHeld = true;
      this.togglePause();
    }
    if (!this.input.pause) this._pauseHeld = false;

    // When paused: still render frozen scene, skip everything else
    if (this.paused) {
      this.composer.render();
      return;
    }

    // Water
    this.water.update(this.time);

    // Track update (buoy bobbing, boost pads, pickups)
    this.track.update(this.time, dt);

    // Race manager
    this.raceManager.update(dt);

    // Input
    this.input.update(dt);

    // Player physics
    if (isRacing && !this.player.finished) {
      // Check boost pad
      const hitPad = this.track.checkBoostPad(this.player.position);
      if (hitPad) {
        if (this.player.boostTimer <= 0) {
          this.player.boostTimer = 2.0;
          this.audio.playBoost();
          this.track.flashBoostPad(hitPad, this.time);
        }
      }

      this.player.applyPhysics(
        this.input.smoothed.throttle,
        this.input.smoothed.steer,
        dt,
        this.input.boost || this.player.boostTimer > 0
      );

      // Jump
      if (this.input.jump && !this.player.airborne && !this._jumpHeld) {
        this.player.velocity.y = 12;
        this._jumpHeld = true;
      }
      if (!this.input.jump) this._jumpHeld = false;
    }

    // Buoyancy for player
    this.buoyancy.apply(this.player, this.time, dt);

    // AI update
    for (let i = 0; i < this.aiRacers.length; i++) {
      const ai = this.aiRacers[i];
      const ctrl = this.aiControllers[i];

      if (isRacing && !ai.finished) {
        // AI boost pad check
        const aiPad = this.track.checkBoostPad(ai.position);
        if (aiPad && ai.boostTimer <= 0) {
          ai.boostTimer = 2.0;
          this.track.flashBoostPad(aiPad, this.time);
        }

        const { throttle, steer } = ctrl.update(
          ai, this.track, this.player.progress, this.time, dt
        );
        ai.applyPhysics(throttle, steer, dt, ai.boostTimer > 0);
      }

      this.buoyancy.apply(ai, this.time, dt);
    }

    // Update stun timers for all racers
    for (const racer of this.allRacers) {
      racer.updateStun(dt);
    }

    // Pickup collection for all racers
    if (isRacing) {
      for (const racer of this.allRacers) {
        if (racer.finished) continue;
        const hitPickup = this.track.checkPickup(racer.position);
        if (hitPickup) {
          const type = hitPickup.collect();
          if (type) {
            const duration = PICKUP.durations[type];
            racer.activatePickup(type, duration);
            if (racer === this.player) {
              this.audio.playPickup();
            }
          }
        }
      }

      // Update powerup timers + laser traction
      for (const racer of this.allRacers) {
        racer.updatePickup(dt);

        // Laser traction: pull toward racer ahead
        if (racer.activePickup === 'laser') {
          let bestTarget = null;
          let bestProgress = Infinity;
          const myProgress = racer.lap * 1000 + racer.progress;
          for (const other of this.allRacers) {
            if (other === racer || other.finished) continue;
            const otherProgress = other.lap * 1000 + other.progress;
            if (otherProgress > myProgress && otherProgress < bestProgress) {
              bestProgress = otherProgress;
              bestTarget = other;
            }
          }
          if (bestTarget) {
            racer.laserTarget = bestTarget;
            const dx = bestTarget.position.x - racer.position.x;
            const dz = bestTarget.position.z - racer.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist > 1) {
              const pullStrength = 25;
              racer.velocity.x += (dx / dist) * pullStrength * dt;
              racer.velocity.z += (dz / dist) * pullStrength * dt;
            }
          }
        }
      }

      // Update laser line visual for player
      if (this.player.activePickup === 'laser' && this.player.laserTarget) {
        const positions = this.laserLine.geometry.attributes.position;
        const p = this.player.position;
        const t = this.player.laserTarget.position;
        positions.setXYZ(0, p.x, p.y + 1.5, p.z);
        positions.setXYZ(1, t.x, t.y + 1.5, t.z);
        positions.needsUpdate = true;
        this.laserLine.visible = true;
        this.laserLine.material.opacity = 0.4 + Math.sin(this.time * 10) * 0.3;
      } else {
        this.laserLine.visible = false;
      }
    }

    // Collisions
    const collisionEvents = this.collisions.checkRacerCollisions(this.allRacers);
    this.collisions.checkBuoyCollisions(this.allRacers, this.track.buoys);

    // Process collision events — tackle mechanic + effects
    for (const evt of collisionEvents) {
      const { a, b, impactSpeed } = evt;
      const playerInvolved = (a === this.player || b === this.player);

      if (impactSpeed > 5) {
        this.audio.playCollision();
        this.chaseCamera.addShake(Math.min(impactSpeed * 0.05, 0.8));
      }

      // Tackle: player presses X during hard collision → stun opponent
      if (playerInvolved && this.input.tackle && impactSpeed > 8) {
        const opponent = (a === this.player) ? b : a;
        if (!opponent.stunned) {
          opponent.stun(3);
          this.chaseCamera.addShake(1.0);
        }
      }
    }

    // Effects
    for (let i = 0; i < this.allRacers.length; i++) {
      const racer = this.allRacers[i];
      this.wakes[i].update(racer.position, racer.rotation, racer.speed, racer.waterHeight, dt);
      this.sprays[i].emit(racer.position, racer.rotation, racer.speed, racer.waterHeight);
      this.sprays[i].update(dt);
    }

    // Player boost effect
    this.boostEffect.setActive(
      this.player.boosting,
      this.player.position,
      this.player.getForward()
    );

    // Camera
    this.chaseCamera.update(this.player, dt);

    // Landing shake (only on transition from airborne to grounded)
    const wasAirborne = this.playerWasAirborne;
    this.playerWasAirborne = this.player.airborne;
    if (wasAirborne && !this.player.airborne) {
      this.chaseCamera.addShake(0.5);
      this.audio.playSplash();
    }

    // Audio
    this.audio.updateEngine(this.player.speed, this.player.boosting);

    // HUD
    this.hud.updateSpeed(this.player.getSpeedKmh());
    this.hud.updatePosition(isRacing ? this.raceManager.getPosition(this.player) : 1);
    this.hud.updateLap(this.player.lap);
    this.hud.updatePower(this.player.power);
    this.hud.updateMinimap(this.allRacers, this.track);
    this.hud.updatePickup(this.player.activePickup, this.player.pickupTimer, this.player.pickupMaxDuration);

    // Render
    this.composer.render();
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    this.update();
  }

  start() {
    this.clock.start();
    this.loop();
  }
}
