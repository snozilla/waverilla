// ── Wave Parameters (shared between GPU shader and CPU sampling) ──
export const GERSTNER_WAVES = [
  { amplitude: 1.2,  wavelength: 40,  speed: 1.2,  direction: [1.0, 0.0],  steepness: 0.4 },
  { amplitude: 0.8,  wavelength: 25,  speed: 1.8,  direction: [0.7, 0.7],  steepness: 0.35 },
  { amplitude: 0.5,  wavelength: 15,  speed: 2.4,  direction: [-0.3, 0.9], steepness: 0.3 },
  { amplitude: 0.3,  wavelength: 10,  speed: 3.0,  direction: [0.9, -0.4], steepness: 0.25 },
  { amplitude: 0.2,  wavelength: 7,   speed: 3.6,  direction: [-0.6, 0.8], steepness: 0.2 },
  { amplitude: 0.15, wavelength: 5,   speed: 4.2,  direction: [0.4, -0.9], steepness: 0.15 },
];

// ── Water Grid ──
export const WATER_SIZE = 800;
export const WATER_SEGMENTS = 256;

// ── Jet Ski Physics ──
export const JETSKI = {
  maxThrust: 60,
  boostThrust: 90,
  dragCoeff: 0.02,
  lateralDrag: 0.08,
  turnSpeed: 2.2,
  turnSpeedAtMax: 1.0,
  maxSpeed: 45,
  boostMaxSpeed: 60,
  leanFactor: 0.35,
  mass: 1,
  gravity: -9.8,
  hullWidth: 1.8,
  hullLength: 3.2,
  buoyancyForce: 50,
  buoyancyDamping: 8,
  waterRideHeight: 0.4,
};

// ── Race ──
export const RACE = {
  totalLaps: 3,
  totalRacers: 6,
  countdownDuration: 4, // 3-2-1-GO
  checkpointRadius: 25,
  buoyGateWidth: 45,
};

// ── AI ──
export const AI = {
  lookAheadDistance: 30,
  lateralOffsetRange: 8,
  rubberBandStrength: 0.3,
  maxRubberBandBoost: 1.3,
};

// ── Camera ──
export const CAMERA = {
  distance: 14,
  height: 6,
  lookAheadY: 2,
  lerpSpeed: 4,
  fovBase: 70,
  fovBoost: 85,
  fovSpeed: 80,
};

// ── Colors ──
export const COLORS = {
  racers: [
    0x00aaff, // Player - blue
    0xff3333, // AI 1 - red
    0x33ff33, // AI 2 - green
    0xff9900, // AI 3 - orange
    0xff33ff, // AI 4 - pink
    0xffff00, // AI 5 - yellow
  ],
  water: 0x006699,
  buoyRed: 0xff2200,
  buoyYellow: 0xffcc00,
  sky: 0x87ceeb,
};

// ── Pickups / Powerups ──
export const PICKUP = {
  collectionRadius: 5,
  respawnTime: 10,
  types: ['turbo', 'laser', 'electric', 'giant'],
  durations: {
    turbo: 3,
    laser: 4,
    electric: 5,
    giant: 5,
  },
  colors: {
    turbo: 0xff8800,
    laser: 0xaa00ff,
    electric: 0x00ffff,
    giant: 0xff2222,
  },
};

// ── Track definitions ──
export const TRACKS = [
  {
    name: 'Tropical Loop',
    difficulty: 'Easy',
    music: [
      { url: '/src/audio/tropical-looop.mp3', volume: 0.8 },
      { url: '/src/audio/tropical-loop-theme.mp3', volume: 0.5 },
    ],
    waypoints: [
      { x: 0,    z: 0 },
      { x: 60,   z: -30 },
      { x: 130,  z: -20 },
      { x: 180,  z: 20 },
      { x: 200,  z: 80 },
      { x: 180,  z: 140 },
      { x: 130,  z: 180 },
      { x: 70,   z: 200 },
      { x: 10,   z: 190 },
      { x: -40,  z: 160 },
      { x: -70,  z: 110 },
      { x: -80,  z: 60 },
      { x: -60,  z: 20 },
      { x: -30,  z: -10 },
    ],
    boostPadIndices: [3, 7, 11],
  },
  {
    name: 'Shark Bay',
    difficulty: 'Medium',
    music: [
      { url: '/src/audio/shark-bay-theme.mp3', volume: 0.8 },
      { url: '/src/audio/shark-bay.mp3', volume: 1.0 },
    ],
    waypoints: [
      { x: 0,    z: 0 },
      { x: 50,   z: -40 },
      { x: 110,  z: -50 },
      { x: 160,  z: -20 },
      { x: 190,  z: 30 },
      { x: 200,  z: 90 },
      { x: 170,  z: 140 },
      { x: 120,  z: 160 },
      { x: 60,   z: 170 },
      { x: 10,   z: 150 },
      { x: -30,  z: 110 },
      { x: -60,  z: 60 },
      { x: -70,  z: 10 },
      { x: -50,  z: -30 },
      { x: -20,  z: -20 },
    ],
    boostPadIndices: [2, 6, 10, 13],
  },
  {
    name: 'Typhoon Run',
    difficulty: 'Hard',
    music: [
      { url: '/src/audio/typhoon-rnn-theme.mp3', volume: 0.8 },
      { url: '/src/audio/typhoon-run.mp3', volume: 1.0 },
    ],
    waypoints: [
      { x: 0,    z: 0 },
      { x: 70,   z: -20 },
      { x: 150,  z: -40 },
      { x: 210,  z: 10 },
      { x: 240,  z: 80 },
      { x: 210,  z: 150 },
      { x: 150,  z: 190 },
      { x: 80,   z: 210 },
      { x: 20,   z: 190 },
      { x: -40,  z: 150 },
      { x: -80,  z: 90 },
      { x: -100, z: 30 },
      { x: -80,  z: -30 },
      { x: -40,  z: -60 },
      { x: 10,   z: -50 },
      { x: 50,   z: -30 },
    ],
    boostPadIndices: [2, 5, 9, 13],
  },
  {
    name: "Dragon's Wake",
    difficulty: 'Expert',
    music: [
      { url: '/src/audio/dragons-wake-theme.mp3', volume: 0.8 },
      { url: '/src/audio/dragons-wake.mp3', volume: 1.0 },
    ],
    waypoints: [
      { x: 0,    z: 0 },
      { x: 40,   z: -30 },
      { x: 90,   z: -50 },
      { x: 140,  z: -30 },
      { x: 160,  z: 20 },
      { x: 130,  z: 60 },
      { x: 80,   z: 70 },
      { x: 50,   z: 100 },
      { x: 80,   z: 140 },
      { x: 140,  z: 160 },
      { x: 180,  z: 130 },
      { x: 190,  z: 80 },
      { x: 170,  z: 40 },
      { x: 200,  z: 0 },
      { x: 180,  z: -40 },
      { x: 120,  z: -70 },
      { x: 50,   z: -60 },
      { x: -10,  z: -30 },
    ],
    boostPadIndices: [3, 7, 11, 15],
  },
];
