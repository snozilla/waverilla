import { RACE, COLORS } from '../utils/constants.js';

export class HUD {
  constructor() {
    this.hud = document.getElementById('hud');
    this.speedEl = document.getElementById('speed-value');
    this.positionEl = document.getElementById('position-value');
    this.lapEl = document.getElementById('lap-value');
    this.countdownEl = document.getElementById('countdown-overlay');
    this.resultsOverlay = document.getElementById('results-overlay');
    this.resultsList = document.getElementById('results-list');
    this.restartBtn = document.getElementById('restart-btn');
    this.startOverlay = document.getElementById('start-overlay');
    this.powerArrows = document.querySelectorAll('.power-arrow');
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');
  }

  show() {
    this.hud.style.display = 'block';
  }

  hide() {
    this.hud.style.display = 'none';
  }

  updateSpeed(kmh) {
    this.speedEl.textContent = Math.round(kmh);
  }

  updatePosition(pos) {
    this.positionEl.textContent = pos;
    if (pos === 1) this.positionEl.style.color = '#ffcc00';
    else if (pos <= 3) this.positionEl.style.color = '#ffffff';
    else this.positionEl.style.color = '#ff6666';
  }

  updateLap(lap) {
    const display = Math.min(lap + 1, RACE.totalLaps);
    this.lapEl.textContent = `${display} / ${RACE.totalLaps}`;
  }

  updatePower(power) {
    this.powerArrows.forEach((arrow, i) => {
      arrow.classList.toggle('active', i < power);
    });
  }

  showCountdown(number) {
    this.countdownEl.textContent = number > 0 ? number : 'GO!';
    this.countdownEl.classList.add('show');
    this.countdownEl.style.transform = 'translate(-50%, -50%) scale(1.5)';

    setTimeout(() => {
      this.countdownEl.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 50);

    setTimeout(() => {
      this.countdownEl.classList.remove('show');
    }, 800);
  }

  showResults(finishOrder) {
    this.resultsOverlay.classList.remove('hidden');
    this.resultsList.innerHTML = '';

    const names = ['YOU', 'RED', 'GREEN', 'ORANGE', 'PINK', 'YELLOW'];
    const hexColors = ['#00aaff', '#ff3333', '#33ff33', '#ff9900', '#ff33ff', '#ffff00'];

    finishOrder.forEach((racer, idx) => {
      const div = document.createElement('div');
      const name = names[racer.colorIndex] || `RACER ${racer.colorIndex + 1}`;
      const color = hexColors[racer.colorIndex] || '#ffffff';
      const time = racer.finishTime.toFixed(2);
      div.innerHTML = `<span style="color:${color}">${idx + 1}. ${name}</span> - ${time}s`;
      this.resultsList.appendChild(div);
    });
  }

  hideResults() {
    this.resultsOverlay.classList.add('hidden');
  }

  hideStart() {
    this.startOverlay.classList.add('hidden');
  }

  updateMinimap(racers, track) {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(0, 20, 40, 0.8)';
    ctx.fillRect(0, 0, w, h);

    // Find bounds from track's raw waypoints
    const wps = track.rawWaypoints;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const wp of wps) {
      minX = Math.min(minX, wp.x);
      maxX = Math.max(maxX, wp.x);
      minZ = Math.min(minZ, wp.z);
      maxZ = Math.max(maxZ, wp.z);
    }

    const pad = 30;
    minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;
    const rangeX = maxX - minX;
    const rangeZ = maxZ - minZ;

    const toMapX = (x) => ((x - minX) / rangeX) * (w - 16) + 8;
    const toMapY = (z) => ((z - minZ) / rangeZ) * (h - 16) + 8;

    // Draw track
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= wps.length; i++) {
      const wp = wps[i % wps.length];
      const mx = toMapX(wp.x);
      const my = toMapY(wp.z);
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    }
    ctx.stroke();

    // Draw racers
    const hexColors = ['#00aaff', '#ff3333', '#33ff33', '#ff9900', '#ff33ff', '#ffff00'];
    for (let i = racers.length - 1; i >= 0; i--) {
      const racer = racers[i];
      const mx = toMapX(racer.position.x);
      const my = toMapY(racer.position.z);

      ctx.fillStyle = hexColors[racer.colorIndex] || '#ffffff';
      ctx.beginPath();
      const size = i === 0 ? 5 : 3;
      ctx.arc(mx, my, size, 0, Math.PI * 2);
      ctx.fill();

      // Player outline
      if (i === 0) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }
}
