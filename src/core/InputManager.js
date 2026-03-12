export class InputManager {
  constructor() {
    this.keys = {};
    this.smoothed = { throttle: 0, steer: 0 };

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  get throttle() {
    if (this.keys['KeyW'] || this.keys['ArrowUp']) return 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) return -0.5;
    return 0;
  }

  get steer() {
    let s = 0;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) s += 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) s -= 1;
    return s;
  }

  get boost() {
    return !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
  }

  get jump() {
    return !!this.keys['Space'];
  }

  update(dt) {
    const smoothRate = 6;
    this.smoothed.throttle += (this.throttle - this.smoothed.throttle) * Math.min(1, smoothRate * dt);
    this.smoothed.steer += (this.steer - this.smoothed.steer) * Math.min(1, smoothRate * dt);
  }
}
