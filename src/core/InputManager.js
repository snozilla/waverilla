export class InputManager {
  constructor() {
    this.keys = {};
    this.smoothed = { throttle: 0, steer: 0 };

    // Touch state
    this._touchThrottle = 0;
    this._touchSteer = 0;
    this._touchBoost = false;
    this._touchJump = false;
    this._touchTackle = false;
    this._touchPause = false;
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    if (this.isMobile) {
      this._initTouch();
    }
  }

  _initTouch() {
    const controls = document.getElementById('touch-controls');
    if (controls) controls.style.display = 'block';

    // Joystick
    const zone = document.getElementById('joystick-zone');
    const thumb = document.getElementById('joystick-thumb');
    if (!zone || !thumb) return;

    const baseRadius = 70;
    const maxDist = 40;
    let joystickId = null;
    const baseCenter = { x: 65, y: 65 };

    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      joystickId = t.identifier;
      this._updateJoystick(t, zone, thumb, baseCenter, maxDist);
    }, { passive: false });

    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === joystickId) {
          this._updateJoystick(t, zone, thumb, baseCenter, maxDist);
        }
      }
    }, { passive: false });

    const resetJoystick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joystickId) {
          joystickId = null;
          this._touchThrottle = 0;
          this._touchSteer = 0;
          thumb.style.left = '42px';
          thumb.style.top = '42px';
        }
      }
    };
    zone.addEventListener('touchend', resetJoystick);
    zone.addEventListener('touchcancel', resetJoystick);

    // Buttons
    this._bindTouchBtn('touch-boost', '_touchBoost');
    this._bindTouchBtn('touch-jump', '_touchJump');
    this._bindTouchBtn('touch-tackle', '_touchTackle');

    // Pause button
    const pauseBtn = document.getElementById('touch-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this._touchPause = true;
        setTimeout(() => { this._touchPause = false; }, 200);
      }, { passive: false });
    }
  }

  _updateJoystick(touch, zone, thumb, center, maxDist) {
    const rect = zone.getBoundingClientRect();
    const dx = (touch.clientX - rect.left) - center.x;
    const dy = (touch.clientY - rect.top) - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, maxDist);
    const angle = Math.atan2(dy, dx);

    const nx = clamped * Math.cos(angle);
    const ny = clamped * Math.sin(angle);

    thumb.style.left = (center.x - 23 + nx) + 'px';
    thumb.style.top = (center.y - 23 + ny) + 'px';

    // Map to throttle/steer
    this._touchSteer = -(nx / maxDist);
    this._touchThrottle = -(ny / maxDist);
  }

  _bindTouchBtn(id, prop) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this[prop] = true;
      btn.classList.add('active');
    }, { passive: false });
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this[prop] = false;
      btn.classList.remove('active');
    }, { passive: false });
    btn.addEventListener('touchcancel', (e) => {
      this[prop] = false;
      btn.classList.remove('active');
    });
  }

  get throttle() {
    if (this.keys['KeyW'] || this.keys['ArrowUp']) return 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) return -0.5;
    if (Math.abs(this._touchThrottle) > 0.1) return this._touchThrottle;
    return 0;
  }

  get steer() {
    let s = 0;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) s += 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) s -= 1;
    if (s === 0 && Math.abs(this._touchSteer) > 0.1) s = this._touchSteer;
    return s;
  }

  get boost() {
    return !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this._touchBoost);
  }

  get jump() {
    return !!(this.keys['Space'] || this._touchJump);
  }

  get tackle() {
    return !!(this.keys['KeyX'] || this._touchTackle);
  }

  get pause() {
    return !!(this.keys['Escape'] || this._touchPause);
  }

  update(dt) {
    const smoothRate = 6;
    this.smoothed.throttle += (this.throttle - this.smoothed.throttle) * Math.min(1, smoothRate * dt);
    this.smoothed.steer += (this.steer - this.smoothed.steer) * Math.min(1, smoothRate * dt);
  }
}
