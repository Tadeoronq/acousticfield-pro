/**
 * Estado Global de la Aplicación (Centralized State)
 */

export const AppState = {
  viewMode: 'waves', // 'waves' | 'heatmap'
  selectedSpeakerIndex: 0, // Índice de la bocina PA en edición

  venue: {
    type: 'indoor',
    shape: 'rectangle',
    length: 20,
    width: 15,
    height: 5,
    material: 'concrete',
    audienceCount: 200,
    voltage: 120
  },

  stage: {
    x: 4.5,
    y: 1.0,
    width: 6.0,
    length: 3.0
  },

  speakers: [
    { id: 1, type: 'main', x: 3.0, y: 2.0, z: 2.2, rotation: 0, angleH: 90, angleV: 60, tiltDown: 5, maxSpl: 128, rmsWatts: 500, active: true },
    { id: 2, type: 'main', x: 12.0, y: 2.0, z: 2.2, rotation: 0, angleH: 90, angleV: 60, tiltDown: 5, maxSpl: 128, rmsWatts: 500, active: true }
  ],

  subwoofers: [
    { id: 1, x: 7.5, y: 2.5, z: 0.5, maxSpl: 133, rmsWatts: 1000, active: true }
  ],

  listener: {
    x: 7.5,
    y: 10.0,
    splAtPosition: 0
  },

  sourceProfile: 'live_band'
};

const listeners = [];

export function subscribeState(callback) {
  listeners.push(callback);
}

export function notifyStateChange() {
  listeners.forEach(cb => cb(AppState));
}

// Métodos para agregar/quitar bocinas y subs de manera independiente
export function addSpeaker() {
  const newId = AppState.speakers.length + 1;
  AppState.speakers.push({
    id: newId,
    type: 'main',
    x: Math.min(AppState.venue.width - 1, 2 + newId * 1.5),
    y: 2.0,
    z: 2.2,
    rotation: 0,
    angleH: 90,
    angleV: 60,
    tiltDown: 5,
    maxSpl: 128,
    rmsWatts: 500,
    active: true
  });
  AppState.selectedSpeakerIndex = AppState.speakers.length - 1;
  notifyStateChange();
}

export function removeSpeaker() {
  if (AppState.speakers.length > 1) {
    AppState.speakers.pop();
    AppState.selectedSpeakerIndex = Math.min(AppState.selectedSpeakerIndex, AppState.speakers.length - 1);
    notifyStateChange();
  }
}

export function addSubwoofer() {
  const newId = AppState.subwoofers.length + 1;
  AppState.subwoofers.push({
    id: newId,
    x: Math.min(AppState.venue.width - 1, 3 + newId * 1.5),
    y: 2.5,
    z: 0.5,
    maxSpl: 133,
    rmsWatts: 1000,
    active: true
  });
  notifyStateChange();
}

export function removeSubwoofer() {
  if (AppState.subwoofers.length > 0) {
    AppState.subwoofers.pop();
    notifyStateChange();
  }
}