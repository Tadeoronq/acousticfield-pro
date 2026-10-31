/**
 * Presets y Plantillas de Configuración Rápida
 */
import { AppState, notifyStateChange } from '../state.js';

export const PRESETS = {
  bar: {
    venue: {
      type: 'indoor',
      shape: 'rectangle',
      length: 18,
      width: 10,
      height: 4,
      material: 'concrete',
      audienceCount: 150,
      voltage: 120
    },
    speakers: [
      { id: 1, type: 'main', x: 2.0, y: 2.0, z: 3.0, angleH: 90, angleV: 60, tiltDown: 12, maxSpl: 128, rmsWatts: 500, active: true },
      { id: 2, type: 'main', x: 8.0, y: 2.0, z: 3.0, angleH: 90, angleV: 60, tiltDown: 12, maxSpl: 128, rmsWatts: 500, active: true }
    ],
    subwoofers: [
      { id: 1, x: 5.0, y: 1.5, maxSpl: 133, rmsWatts: 1000, active: true }
    ],
    sourceProfile: 'edm'
  },
  boda: {
    venue: {
      type: 'indoor',
      shape: 'rectangle',
      length: 25,
      width: 15,
      height: 5,
      material: 'drywall',
      audienceCount: 250,
      voltage: 120
    },
    speakers: [
      { id: 1, type: 'main', x: 3.5, y: 3.0, z: 2.2, angleH: 90, angleV: 60, tiltDown: 5, maxSpl: 130, rmsWatts: 700, active: true },
      { id: 2, type: 'main', x: 11.5, y: 3.0, z: 2.2, angleH: 90, angleV: 60, tiltDown: 5, maxSpl: 130, rmsWatts: 700, active: true }
    ],
    subwoofers: [
      { id: 1, x: 7.5, y: 2.5, maxSpl: 134, rmsWatts: 1200, active: true }
    ],
    sourceProfile: 'live_band'
  }
};

export function loadPreset(presetKey) {
  const preset = PRESETS[presetKey];
  if (!preset) return;

  Object.assign(AppState.venue, preset.venue);
  AppState.speakers = JSON.parse(JSON.stringify(preset.speakers));
  AppState.subwoofers = JSON.parse(JSON.stringify(preset.subwoofers));
  AppState.sourceProfile = preset.sourceProfile;

  // Actualizar UI HTML
  document.getElementById('venue-type').value = AppState.venue.type;
  document.getElementById('venue-shape').value = AppState.venue.shape;
  document.getElementById('venue-length').value = AppState.venue.length;
  document.getElementById('venue-width').value = AppState.venue.width;
  document.getElementById('venue-height').value = AppState.venue.height;
  document.getElementById('venue-material').value = AppState.venue.material;
  document.getElementById('venue-audience').value = AppState.venue.audienceCount;
  document.getElementById('source-profile').value = AppState.sourceProfile;

  notifyStateChange();
}