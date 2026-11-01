/**
 * Motor de Renderizado en Lienzo (Canvas 2D Engine)
 * Soporta renderizado de capturas independientes para reportes PDF.
 */

import { AppState, subscribeState, notifyStateChange } from '../state.js';
import { calculateSplAtPosition } from '../physics/acoustics.js';

class CanvasRenderEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.waveRadius = 0;
    this.draggedElement = null;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    this.initEvents();
    this.startLoop();

    subscribeState(() => this.render());
  }

  getScale() {
    const margin = 40;
    const availableWidth = this.canvas.width - margin * 2;
    const availableHeight = this.canvas.height - margin * 2;

    const scaleX = availableWidth / AppState.venue.width;
    const scaleY = availableHeight / AppState.venue.length;

    const scale = Math.min(scaleX, scaleY);
    const offsetX = (this.canvas.width - AppState.venue.width * scale) / 2;
    const offsetY = (this.canvas.height - AppState.venue.length * scale) / 2;

    return { scale, offsetX, offsetY };
  }

  mToPx(x, y) {
    const { scale, offsetX, offsetY } = this.getScale();
    return {
      px: offsetX + x * scale,
      py: offsetY + y * scale
    };
  }

  pxToM(px, py) {
    const { scale, offsetX, offsetY } = this.getScale();
    return {
      x: Math.max(0, Math.min(AppState.venue.width, (px - offsetX) / scale)),
      y: Math.max(0, Math.min(AppState.venue.length, (py - offsetY) / scale))
    };
  }

  clear() {
    this.ctx.fillStyle = '#08090a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawVenue() {
    const { scale, offsetX, offsetY } = this.getScale();
    const wPx = AppState.venue.width * scale;
    const lPx = AppState.venue.length * scale;

    this.ctx.save();
    this.ctx.strokeStyle = '#343a46';
    this.ctx.fillStyle = '#121418';
    this.ctx.lineWidth = 3;

    if (AppState.venue.shape === 'circle') {
      const radius = Math.min(wPx, lPx) / 2;
      this.ctx.beginPath();
      this.ctx.arc(offsetX + wPx / 2, offsetY + lPx / 2, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

    } else if (AppState.venue.shape === 'fan') {
      this.ctx.beginPath();
      this.ctx.moveTo(offsetX + wPx * 0.25, offsetY);
      this.ctx.lineTo(offsetX + wPx * 0.75, offsetY);
      this.ctx.lineTo(offsetX + wPx, offsetY + lPx);
      this.ctx.lineTo(offsetX, offsetY + lPx);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

    } else if (AppState.venue.shape === 'irregular') {
      this.ctx.beginPath();
      this.ctx.moveTo(offsetX + wPx * 0.1, offsetY);
      this.ctx.lineTo(offsetX + wPx * 0.9, offsetY + lPx * 0.05);
      this.ctx.lineTo(offsetX + wPx, offsetY + lPx * 0.85);
      this.ctx.lineTo(offsetX + wPx * 0.4, offsetY + lPx);
      this.ctx.lineTo(offsetX, offsetY + lPx * 0.7);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

    } else {
      this.ctx.fillRect(offsetX, offsetY, wPx, lPx);
      this.ctx.strokeRect(offsetX, offsetY, wPx, lPx);
    }

    // Dibujar Escenario
    const stagePos = this.mToPx(AppState.stage.x, AppState.stage.y);
    const stageWPx = AppState.stage.width * scale;
    const stageLPx = AppState.stage.length * scale;

    this.ctx.fillStyle = '#1e293b';
    this.ctx.strokeStyle = '#2563eb';
    this.ctx.lineWidth = 2;
    this.ctx.fillRect(stagePos.px, stagePos.py, stageWPx, stageLPx);
    this.ctx.strokeRect(stagePos.px, stagePos.py, stageWPx, stageLPx);

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = 'bold 11px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('ESCENARIO', stagePos.px + stageWPx / 2, stagePos.py + stageLPx / 2 + 4);

    this.ctx.restore();
  }

  drawWaveAnimation() {
    const { scale } = this.getScale();

    this.waveRadius += 1.5;
    if (this.waveRadius > 120) this.waveRadius = 0;

    this.ctx.save();

    AppState.speakers.forEach(speaker => {
      if (!speaker.active) return;
      const { px, py } = this.mToPx(speaker.x, speaker.y);
      const powerFactor = Math.sqrt((speaker.rmsWatts || 500) / 500);

      for (let r = this.waveRadius; r > 0; r -= 30) {
        const opacity = Math.max(0, 1 - r / 120);
        this.ctx.beginPath();
        this.ctx.arc(px, py, r * (scale / 10) * powerFactor, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(37, 99, 235, ${opacity * 0.7})`;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }
    });

    AppState.subwoofers.forEach(sub => {
      if (!sub.active) return;
      const { px, py } = this.mToPx(sub.x, sub.y);
      const powerFactor = Math.sqrt((sub.rmsWatts || 1000) / 1000);

      for (let r = this.waveRadius; r > 0; r -= 30) {
        const opacity = Math.max(0, 1 - r / 120);
        this.ctx.beginPath();
        this.ctx.arc(px, py, r * (scale / 10) * powerFactor, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(217, 70, 239, ${opacity * 0.6})`;
        this.ctx.lineWidth = 2.5;
        this.ctx.stroke();
      }
    });

    this.ctx.restore();
  }

  drawHeatmap() {
    const { scale } = this.getScale();
    const stepM = 0.5;
    const stepPx = stepM * scale;

    this.ctx.save();

    const rt60 = AppState.venue.rt60 || 1.0;
    const reflectionMultiplier = Math.min(1.25, Math.max(0.9, rt60 / 1.5));

    for (let x = 0; x < AppState.venue.width; x += stepM) {
      for (let y = 0; y < AppState.venue.length; y += stepM) {
        let spl = calculateSplAtPosition(
          AppState.speakers,
          x + stepM / 2,
          y + stepM / 2,
          1.2,
          AppState.venue.type,
          AppState.subwoofers,
          AppState.venue.shape,   // Geometría activa ('rectangle', 'circle', 'fan')
          AppState.venue.width,   // Ancho
          AppState.venue.length   // Largo
        );

        spl *= reflectionMultiplier;

        const color = this.splToColor(spl);
        const { px, py } = this.mToPx(x, y);

        this.ctx.fillStyle = color;
        this.ctx.fillRect(px, py, stepPx + 0.5, stepPx + 0.5);
      }
    }

    this.ctx.restore();
  }

  splToColor(spl) {
    if (spl < 70) return 'rgba(0, 0, 128, 0.4)';
    if (spl < 82) return 'rgba(0, 128, 255, 0.5)';
    if (spl < 92) return 'rgba(0, 255, 128, 0.6)';
    if (spl < 100) return 'rgba(255, 255, 0, 0.7)';
    if (spl < 106) return 'rgba(255, 128, 0, 0.8)';
    return 'rgba(255, 0, 0, 0.85)';
  }

  drawSpeakers() {
    const { scale } = this.getScale();

    AppState.speakers.forEach((speaker, index) => {
      if (!speaker.active) return;
      const { px, py } = this.mToPx(speaker.x, speaker.y);

      this.ctx.save();
      this.ctx.translate(px, py);
      
      const angleRad = ((speaker.rotation || 0) * Math.PI) / 180;
      this.ctx.rotate(angleRad);

      const halfAngle = ((speaker.angleH || 90) / 2) * (Math.PI / 180);
      const coneLength = 4 * scale;

      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.arc(0, 0, coneLength, Math.PI / 2 - halfAngle, Math.PI / 2 + halfAngle);
      this.ctx.closePath();
      
      const isSelected = index === AppState.selectedSpeakerIndex;
      this.ctx.fillStyle = isSelected ? 'rgba(234, 179, 8, 0.25)' : 'rgba(37, 99, 235, 0.15)';
      this.ctx.fill();
      this.ctx.strokeStyle = isSelected ? '#eab308' : 'rgba(37, 99, 235, 0.5)';
      this.ctx.lineWidth = isSelected ? 2 : 1;
      this.ctx.stroke();

      this.ctx.restore();

      this.ctx.fillStyle = isSelected ? '#eab308' : '#ef4444';
      this.ctx.beginPath();
      this.ctx.arc(px, py, isSelected ? 10 : 8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 9px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`PA${index + 1}`, px, py + 3);
    });

    AppState.subwoofers.forEach((sub, index) => {
      if (!sub.active) return;
      const { px, py } = this.mToPx(sub.x, sub.y);

      this.ctx.save();
      this.ctx.fillStyle = '#d946ef';
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.5;
      this.ctx.fillRect(px - 8, py - 8, 16, 16);
      this.ctx.strokeRect(px - 8, py - 8, 16, 16);

      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 8px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`S${index + 1}`, px, py + 3);
      this.ctx.restore();
    });
  }

  drawListener() {
    const { px, py } = this.mToPx(AppState.listener.x, AppState.listener.y);

    this.ctx.save();

    this.ctx.beginPath();
    this.ctx.arc(px, py, 12, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.arc(px, py, 6, 0, Math.PI * 2);
    this.ctx.fillStyle = '#10b981';
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    const spl = AppState.listener.splAtPosition || 0;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 11px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${spl} dB`, px, py - 14);

    this.ctx.restore();
  }

  // RENDERIZADO FORZADO PARA CAPTURAS EN REPORTE PDF
  renderHeatmapSnapshot() {
    this.clear();
    this.drawVenue();
    this.drawHeatmap();
    this.drawSpeakers();
    this.drawListener();
    return this.canvas.toDataURL('image/png');
  }

  renderWavesSnapshot() {
    this.clear();
    this.drawVenue();
    this.drawWaveAnimation();
    this.drawSpeakers();
    this.drawListener();
    return this.canvas.toDataURL('image/png');
  }

  initEvents() {
    const handleStart = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const px = clientX - rect.left;
      const py = clientY - rect.top;

      const listenerPx = this.mToPx(AppState.listener.x, AppState.listener.y);
      if (Math.hypot(px - listenerPx.px, py - listenerPx.py) < 18) {
        this.draggedElement = 'listener';
        return;
      }

      for (let i = 0; i < AppState.speakers.length; i++) {
        const spk = AppState.speakers[i];
        const spkPx = this.mToPx(spk.x, spk.y);
        if (Math.hypot(px - spkPx.px, py - spkPx.py) < 15) {
          this.draggedElement = { type: 'speaker', index: i };
          AppState.selectedSpeakerIndex = i;
          notifyStateChange();
          return;
        }
      }

      for (let i = 0; i < AppState.subwoofers.length; i++) {
        const sub = AppState.subwoofers[i];
        const subPx = this.mToPx(sub.x, sub.y);
        if (Math.hypot(px - subPx.px, py - subPx.py) < 15) {
          this.draggedElement = { type: 'sub', index: i };
          return;
        }
      }

      const { scale } = this.getScale();
      const stagePos = this.mToPx(AppState.stage.x, AppState.stage.y);
      const stageWPx = AppState.stage.width * scale;
      const stageLPx = AppState.stage.length * scale;

      if (px >= stagePos.px && px <= stagePos.px + stageWPx && py >= stagePos.py && py <= stagePos.py + stageLPx) {
        this.draggedElement = 'stage';
        const currentM = this.pxToM(px, py);
        this.dragOffsetX = currentM.x - AppState.stage.x;
        this.dragOffsetY = currentM.y - AppState.stage.y;
      }
    };

    const handleMove = (e) => {
      if (!this.draggedElement) return;

      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const { x, y } = this.pxToM(px, py);

      if (this.draggedElement === 'listener') {
        AppState.listener.x = parseFloat(x.toFixed(1));
        AppState.listener.y = parseFloat(y.toFixed(1));

      } else if (this.draggedElement === 'stage') {
        AppState.stage.x = Math.max(0, Math.min(AppState.venue.width - AppState.stage.width, parseFloat((x - this.dragOffsetX).toFixed(1))));
        AppState.stage.y = Math.max(0, Math.min(AppState.venue.length - AppState.stage.length, parseFloat((y - this.dragOffsetY).toFixed(1))));

      } else if (this.draggedElement.type === 'speaker') {
        const spk = AppState.speakers[this.draggedElement.index];
        if (spk) {
          spk.x = parseFloat(x.toFixed(1));
          spk.y = parseFloat(y.toFixed(1));
        }

      } else if (this.draggedElement.type === 'sub') {
        const sub = AppState.subwoofers[this.draggedElement.index];
        if (sub) {
          sub.x = parseFloat(x.toFixed(1));
          sub.y = parseFloat(y.toFixed(1));
        }
      }

      notifyStateChange();
    };

    const handleEnd = () => {
      this.draggedElement = null;
    };

    this.canvas.addEventListener('mousedown', handleStart);
    this.canvas.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);

    this.canvas.addEventListener('touchstart', handleStart);
    this.canvas.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
  }

  render() {
    this.clear();
    this.drawVenue();

    if (AppState.viewMode === 'heatmap') {
      this.drawHeatmap();
    } else {
      this.drawWaveAnimation();
    }

    this.drawSpeakers();
    this.drawListener();
  }

  startLoop() {
    const loop = () => {
      if (AppState.viewMode === 'waves') {
        this.render();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

export let canvasEngineInstance = null;

export function initCanvasEngine(canvasId) {
  canvasEngineInstance = new CanvasRenderEngine(canvasId);
  return canvasEngineInstance;
}