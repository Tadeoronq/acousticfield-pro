import { AppState, notifyStateChange, subscribeState, addSpeaker, removeSpeaker, addSubwoofer, removeSubwoofer } from './state.js';
import { calculateRT60, calculateSplAtPosition, getRecommendedSpecs } from './physics/acoustics.js';
import { calculateElectricalLoad } from './physics/electrical.js';
import { initCanvasEngine } from './render/canvas_engine.js';
import { dspEngine } from './audio/dsp_engine.js';
import { loadPreset } from './ui/presets.js';
import { generatePdfReport } from './ui/pdf_export.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('AcousticField Pro Inicializado.');

  initCanvasEngine('acoustic-canvas');

  // TABS DE NAVEGACIÓN
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.tab);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // MODO DE VISTA
  const btnWaves = document.getElementById('btn-mode-waves');
  const btnHeatmap = document.getElementById('btn-mode-heatmap');

  btnWaves.addEventListener('click', () => {
    btnWaves.classList.add('active');
    btnHeatmap.classList.remove('active');
    AppState.viewMode = 'waves';
    notifyStateChange();
  });

  btnHeatmap.addEventListener('click', () => {
    btnHeatmap.classList.add('active');
    btnWaves.classList.remove('active');
    AppState.viewMode = 'heatmap';
    notifyStateChange();
  });

  // AUDIO DSP
  const btnAudio = document.getElementById('btn-toggle-audio');
  btnAudio.addEventListener('click', () => {
    const isPlaying = dspEngine.toggleAudio();
    if (isPlaying) {
      btnAudio.textContent = '⏹ Detener Audio DSP';
      btnAudio.style.backgroundColor = '#ef4444';
    } else {
      btnAudio.textContent = '🔊 Escuchar Simulación DSP';
      btnAudio.style.backgroundColor = '#059669';
    }
  });

  // PRESETS Y PDF
  document.getElementById('btn-preset-bar').addEventListener('click', () => loadPreset('bar'));
  document.getElementById('btn-preset-boda').addEventListener('click', () => loadPreset('boda'));
  document.getElementById('btn-export-pdf').addEventListener('click', generatePdfReport);

  // BOTONES DE AGREGAR Y QUITAR
  document.getElementById('btn-add-speaker').addEventListener('click', addSpeaker);
  document.getElementById('btn-remove-speaker').addEventListener('click', removeSpeaker);
  document.getElementById('btn-add-sub').addEventListener('click', addSubwoofer);
  document.getElementById('btn-remove-sub').addEventListener('click', removeSubwoofer);

  const speakerSelect = document.getElementById('speaker-select');
  const speakerSplInput = document.getElementById('speaker-spl');
  const speakerAngleInput = document.getElementById('speaker-angle');
  const speakerRmsInput = document.getElementById('speaker-rms');

  speakerSelect.addEventListener('change', (e) => {
    AppState.selectedSpeakerIndex = parseInt(e.target.value) || 0;
    syncSpeakerInputs();
  });

  speakerSplInput.addEventListener('input', (e) => {
    const spk = AppState.speakers[AppState.selectedSpeakerIndex];
    if (spk) spk.maxSpl = parseFloat(e.target.value) || 120;
    notifyStateChange();
  });

  speakerAngleInput.addEventListener('input', (e) => {
    const spk = AppState.speakers[AppState.selectedSpeakerIndex];
    if (spk) spk.rotation = parseFloat(e.target.value) || 0;
    notifyStateChange();
  });

  speakerRmsInput.addEventListener('input', (e) => {
    const spk = AppState.speakers[AppState.selectedSpeakerIndex];
    if (spk) spk.rmsWatts = parseFloat(e.target.value) || 500;
    notifyStateChange();
  });

  document.getElementById('sub-spl').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value) || 130;
    AppState.subwoofers.forEach(sub => sub.maxSpl = val);
    notifyStateChange();
  });

  document.getElementById('sub-rms').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value) || 1000;
    AppState.subwoofers.forEach(sub => sub.rmsWatts = val);
    notifyStateChange();
  });

  // SALA Y FUENTE
  document.getElementById('venue-length').addEventListener('input', (e) => {
    AppState.venue.length = parseFloat(e.target.value) || 5;
    notifyStateChange();
  });

  document.getElementById('venue-width').addEventListener('input', (e) => {
    AppState.venue.width = parseFloat(e.target.value) || 5;
    notifyStateChange();
  });

  document.getElementById('venue-height').addEventListener('input', (e) => {
    AppState.venue.height = parseFloat(e.target.value) || 2;
    notifyStateChange();
  });

  document.getElementById('venue-type').addEventListener('change', (e) => {
    const selectedType = e.target.value;
    AppState.venue.type = selectedType;
    const materialSelect = document.getElementById('venue-material');

    if (selectedType === 'outdoor') {
      AppState.venue.material = 'open_air';
      AppState.venue.isMaterialLocked = true;
      if (materialSelect) {
        materialSelect.value = 'open_air';
        materialSelect.disabled = true;
      }
    } else {
      AppState.venue.isMaterialLocked = false;
      if (materialSelect) {
        materialSelect.disabled = false;
      }
    }
    notifyStateChange();
  });

  document.getElementById('venue-shape').addEventListener('change', (e) => {
    AppState.venue.shape = e.target.value;
    notifyStateChange();
  });

  document.getElementById('venue-material').addEventListener('change', (e) => {
    AppState.venue.material = e.target.value;
    notifyStateChange();
  });

  document.getElementById('venue-audience').addEventListener('input', (e) => {
    AppState.venue.audienceCount = parseInt(e.target.value) || 0;
    notifyStateChange();
  });

  document.getElementById('stage-w').addEventListener('input', (e) => {
    AppState.stage.width = parseFloat(e.target.value) || 2;
    notifyStateChange();
  });

  document.getElementById('stage-l').addEventListener('input', (e) => {
    AppState.stage.length = parseFloat(e.target.value) || 1;
    notifyStateChange();
  });

  document.getElementById('voltage-select').addEventListener('change', (e) => {
    AppState.venue.voltage = parseInt(e.target.value) || 120;
    notifyStateChange();
  });

  document.getElementById('source-profile').addEventListener('change', (e) => {
    AppState.sourceProfile = e.target.value;
    notifyStateChange();
    if (dspEngine && dspEngine.isPlaying) {
      dspEngine.updateAudioParams(AppState);
    }
  });

  function syncSpeakerInputs() {
    speakerSelect.innerHTML = '';
    AppState.speakers.forEach((s, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `PA${idx + 1} (${s.x}m, ${s.y}m)`;
      if (idx === AppState.selectedSpeakerIndex) opt.selected = true;
      speakerSelect.appendChild(opt);
    });

    const currentSpk = AppState.speakers[AppState.selectedSpeakerIndex];
    if (currentSpk) {
      speakerSplInput.value = currentSpk.maxSpl || 128;
      speakerAngleInput.value = currentSpk.rotation || 0;
      speakerRmsInput.value = currentSpk.rmsWatts || 500;
    }
  }

  // ACTUALIZACIÓN GENERAL
  function updateDashboard(state) {
    syncSpeakerInputs();

    // Sincronizar bloqueo de material si es exterior
    const materialSelect = document.getElementById('venue-material');
    if (materialSelect) {
      materialSelect.disabled = state.venue.isMaterialLocked;
      if (state.venue.isMaterialLocked) {
        materialSelect.value = 'open_air';
      }
    }

    const rtResult = calculateRT60(state.venue);
    document.getElementById('metric-rt60').textContent = `${rtResult.rt60} s`;
    document.getElementById('metric-rt60-status').textContent = rtResult.status;

    const splAtListener = calculateSplAtPosition(
      state.speakers,
      state.listener.x,
      state.listener.y,
      1.2,
      state.venue.type,
      state.subwoofers
    );
    state.listener.splAtPosition = splAtListener;
    document.getElementById('metric-spl-listener').textContent = `${splAtListener} dB`;

    const elecResult = calculateElectricalLoad(
      state.speakers,
      state.subwoofers,
      state.venue.voltage
    );
    document.getElementById('metric-current').textContent = `${elecResult.continuousAmps} A`;
    document.getElementById('metric-breakers').textContent = `${elecResult.breakersNeeded} Breaker(s) 20A (${elecResult.wireGauge})`;

    const specs = getRecommendedSpecs(
      state.venue,
      state.sourceProfile,
      rtResult.rt60,
      state.speakers,
      state.subwoofers
    );

    const recContainer = document.getElementById('recommendations-container');
    recContainer.innerHTML = `
      <div class="rec-category-card">
        <h4>1. Cajas, Arreglo y Electroacústica</h4>
        <ul>
          ${specs.electroacoustics.map(s => `<li><strong>${s.label}:</strong>${s.value}</li>`).join('')}
        </ul>
      </div>

      <div class="rec-category-card">
        <h4>2. Amplificación y Cadena Digital</h4>
        <ul>
          ${specs.amplification.map(s => `<li><strong>${s.label}:</strong>${s.value}</li>`).join('')}
        </ul>
      </div>

      <div class="rec-category-card" style="grid-column: span 2;">
        <h4>3. Comportamiento Acústico e Inteligibilidad</h4>
        <ul>
          ${specs.acoustics.map(s => `<li><strong>${s.label}:</strong>${s.value}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  subscribeState(updateDashboard);
  notifyStateChange();
});