import { RACE } from '../utils/constants.js';

export class RaceManager {
  constructor(track, racers) {
    this.track = track;
    this.racers = racers;
    this.state = 'pre'; // pre, countdown, racing, finished
    this.countdownTimer = RACE.countdownDuration;
    this.raceTime = 0;
    this.positions = [];
    this.finishOrder = [];
    this.playerFinishTime = null;
    this.onCountdownTick = null;
    this.onRaceStart = null;
    this.onLapComplete = null;
    this.onRaceFinish = null;
  }

  startCountdown() {
    this.state = 'countdown';
    this.countdownTimer = RACE.countdownDuration;
    // Fire initial "3" immediately (duration is 4, so first visible number is 3)
    this.onCountdownTick?.(Math.ceil(this.countdownTimer) - 1);
  }

  update(dt) {
    if (this.state === 'countdown') {
      this.updateCountdown(dt);
    } else if (this.state === 'racing') {
      this.updateRace(dt);
    }
  }

  updateCountdown(dt) {
    const prevSec = Math.ceil(this.countdownTimer);
    this.countdownTimer -= dt;
    const curSec = Math.ceil(this.countdownTimer);

    if (curSec !== prevSec && curSec > 0) {
      this.onCountdownTick?.(curSec);
    }

    if (this.countdownTimer <= 0) {
      this.state = 'racing';
      this.onRaceStart?.();
    }
  }

  updateRace(dt) {
    this.raceTime += dt;

    // Update checkpoint progress for each racer
    for (const racer of this.racers) {
      if (racer.finished) continue;

      const prevCheckpoint = racer.currentCheckpoint;
      const newCheckpoint = this.track.getCheckpointIndex(
        racer.position,
        racer.currentCheckpoint
      );

      if (newCheckpoint !== prevCheckpoint) {
        racer.currentCheckpoint = newCheckpoint;

        // Check gate pass for power
        const gate = this.track.checkGatePass(racer.position, prevCheckpoint);
        if (gate.passed && gate.correct) {
          racer.power = Math.min(5, racer.power + 1);
        }

        // Lap completion (crossed checkpoint 0)
        if (newCheckpoint === 0 && prevCheckpoint === this.track.waypoints.length - 1) {
          racer.lap++;
          this.onLapComplete?.(racer, racer.lap);

          if (racer.lap >= RACE.totalLaps) {
            racer.finished = true;
            racer.finishTime = this.raceTime;
            this.finishOrder.push(racer);

            // Track when player finishes
            if (racer === this.racers[0]) {
              this.playerFinishTime = this.raceTime;
            }

            if (this.finishOrder.length === this.racers.length) {
              this.state = 'finished';
              this.onRaceFinish?.(this.finishOrder);
            }
          }
        }
      }

      // Progress score: lap * totalCheckpoints + currentCheckpoint + fractional
      const trackProgress = this.track.getProgressAlongTrack(racer.position);
      racer.progress = racer.lap * this.track.waypoints.length +
        racer.currentCheckpoint + trackProgress;
    }

    // Auto-finish remaining racers 5s after player finishes
    if (this.playerFinishTime && this.raceTime - this.playerFinishTime > 5) {
      const remaining = this.racers
        .filter(r => !r.finished)
        .sort((a, b) => b.progress - a.progress);
      for (const r of remaining) {
        r.finished = true;
        r.finishTime = this.raceTime;
        this.finishOrder.push(r);
      }
      if (remaining.length > 0) {
        this.state = 'finished';
        this.onRaceFinish?.(this.finishOrder);
      }
    }

    // Sort positions
    this.positions = [...this.racers]
      .filter(r => !r.finished)
      .sort((a, b) => b.progress - a.progress);

    // Add finished racers at front
    this.positions = [...this.finishOrder, ...this.positions];
  }

  getPosition(racer) {
    const idx = this.positions.indexOf(racer);
    return idx >= 0 ? idx + 1 : this.racers.length;
  }

  reset() {
    this.state = 'pre';
    this.countdownTimer = RACE.countdownDuration;
    this.raceTime = 0;
    this.positions = [];
    this.finishOrder = [];
    this.playerFinishTime = null;

    for (const racer of this.racers) {
      racer.currentCheckpoint = 0;
      racer.lap = 0;
      racer.progress = 0;
      racer.finished = false;
      racer.finishTime = 0;
      racer.power = 0;
      racer.boostTimer = 0;
    }
  }
}
