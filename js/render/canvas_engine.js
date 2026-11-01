/**
 * Motor de Renderizado Gráfico y Canvas (Canvas Render Engine)
 * AcousticField Pro - Versión Profesional Expandida
 */

import { AppState } from '../state.js';
import { calculateSplAtPosition } from '../physics/acoustics.js';

let renderEngineInstance = null;

/**
 * Inicializa la instancia global del motor de renderizado de Canvas.
 * @param {String} canvasId - ID del elemento canvas en el DOM
 * @returns {CanvasRenderEngine} Instancia del motor
 */
export function initCanvasEngine(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.warn(`[CanvasEngine] No se encontró el elemento canvas con ID: ${canvasId}`);
    return null;
  }
  renderEngineInstance = new CanvasRenderEngine(canvas);
  return renderEngineInstance;
}

/**
 * Obtiene la instancia activa del motor gráfico.
 * @returns {CanvasRenderEngine}
 */
export function getCanvasEngine() {
  return renderEngineInstance;
}

class CanvasRenderEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Configuración inicial de dimensiones y escalas
    this.setupCanvasSize();
    
    // Variables de estado para interacción con el mouse (Drag & Drop de equipos)
    this.isDragging = false;
    this.selectedItem = null;
    this.itemType = null; // 'speaker' o 'subwoofer'
    this.dragOffset = { x: 0, y: 0 };
    this.hoveredItem = null;

    // Vincular eventos de redimensionamiento e interactividad
    window.addEventListener('resize', () => this.setupCanvasSize());
    this.initInteractionListeners();
  }

  /**
   * Configura las dimensiones físicas y lógicas del canvas adaptándolas al contenedor padre.
   */
  setupCanvasSize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth || 800;
      this.canvas.height = parent.clientHeight || 600;
    }
    this.render();
  }

  /**
   * Calcula la escala de conversión de metros a píxeles basada en las dimensiones del recinto.
   */
  getScale() {
    const venueWidth = AppState.venue.width || 15;
    const venueLength = AppState.venue.length || 20;
    
    const padding = 60; // Margen perimetral en píxeles
    const availW = this.canvas.width - padding * 2;
    const availH = this.canvas.height - padding * 2;

    const scaleX = availW / venueWidth;
    const scaleY = availH / venueLength;
    const scale = Math.min(scaleX, scaleY);

    return { 
      scale, 
      offsetX: padding + (availW - venueWidth * scale) / 2, 
      offsetY: padding + (availH - venueLength * scale) / 2 
    };
  }

  /**
   * Convierte coordenadas de metros (espacio real del recinto) a píxeles en pantalla.
   */
  mToPx(x, y) {
    const { scale, offsetX, offsetY } = this.getScale();
    return {
      px: offsetX + x * scale,
      py: offsetY + y * scale
    };
  }

  /**
   * Convierte coordenadas de píxeles en pantalla a metros en el plano del recinto.
   */
  pxToM(px, py) {
    const { scale, offsetX, offsetY } = this.getScale();
    return {
      x: (px - offsetX) / scale,
      y: (py - offsetY) / scale
    };
  }

  /**
   * Mapea un valor de presión acústica SPL (dB) a un color RGBA semi-transparente para el mapa de calor.
   */
  splToColor(spl) {
    if (spl < 70)  return 'rgba(30, 144, 255, 0.45)';  // Azul (Bajo nivel / Óptimo)
    if (spl < 82)  return 'rgba(0, 206, 209, 0.45)';  // Turquesa
    if (spl < 94)  return 'rgba(50, 205, 50, 0.45)';   // Verde (Nivel moderado de referencia)
    if (spl < 102) return 'rgba(255, 255, 0, 0.5)';   // Amarillo (Advertencia de presión)
    if (spl < 110) return 'rgba(255, 140, 0, 0.55)';  // Naranja (Alto SPL)
    if (spl < 118) return 'rgba(255, 69, 0, 0.6)';    // Rojo claro (Crítico)
    return 'rgba(139, 0, 0, 0.65)';                   // Rojo oscuro / Borgoña (Saturación extrema)
  }

  /**
   * Dibuja la rejilla métrica de referencia sobre el plano de planta.
   */
  drawGrid() {
    const { scale, offsetX, offsetY } = this.getScale();
    const widthM = AppState.venue.width || 15;
    const lengthM = AppState.venue.length || 20;

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
    this.ctx.lineWidth = 1;
    this.ctx.fillStyle = '#64748b';
    this.ctx.font = '10px Inter, sans-serif';

    const step = widthM > 30 || lengthM > 30 ? 5 : 2; // Intervalos de grilla dinámicos

    // Líneas verticales y etiquetas de ancho
    for (let x = 0; x <= widthM; x += step) {
      const p1 = this.mToPx(x, 0);
      const p2 = this.mToPx(x, lengthM);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.px, p1.py);
      this.ctx.lineTo(p2.px, p2.py);
      this.ctx.stroke();

      if (x > 0 && x < widthM) {
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${x}m`, p1.px, p1.py - 8);
      }
    }

    // Líneas horizontales y etiquetas de largo
    for (let y = 0; y <= lengthM; y += step) {
      const p1 = this.mToPx(0, y);
      const p2 = this.mToPx(widthM, y);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.px, p1.py);
      this.ctx.lineTo(p2.px, p2.py);
      this.ctx.stroke();

      if (y > 0 && y < lengthM) {
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`${y}m`, p1.px - 8, p1.py + 4);
      }
    }

    this.ctx.restore();
  }

  /**
   * Dibuja los contornos y límites físicos del recinto según su geometría activa.
   */
  drawVenueBoundary() {
    const shape = AppState.venue.shape || 'rectangle';
    const widthM = AppState.venue.width || 15;
    const lengthM = AppState.venue.length || 20;

    const origin = this.mToPx(0, 0);
    const maxCorner = this.mToPx(widthM, lengthM);
    const canvasW = maxCorner.px - origin.px;
    const canvasH = maxCorner.py - origin.py;

    this.ctx.save();
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 3;
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';

    this.ctx.beginPath();
    if (shape === 'circle') {
      const centerX = origin.px + canvasW / 2;
      const centerY = origin.py + canvasH / 2;
      const radiusPx = Math.min(canvasW, canvasH) / 2;
      this.ctx.arc(centerX, centerY, radiusPx, 0, Math.PI * 2);
    } else if (shape === 'fan') {
      const startX = origin.px + canvasW / 2;
      const startY = origin.py;
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(origin.px + canvasW, origin.py + canvasH);
      this.ctx.lineTo(origin.px, origin.py + canvasH);
      this.ctx.closePath();
    } else {
      // Rectángulo estándar por defecto
      this.ctx.rect(origin.px, origin.py, canvasW, canvasH);
    }

    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * Dibuja el mapa de calor de propagación acústica aplicando una máscara de recorte estricta (clipping path).
   */
  drawHeatmap() {
    const { scale } = this.getScale();
    const stepM = 0.5; // Resolución de malla en metros
    const stepPx = stepM * scale;

    this.ctx.save();

    // --- MÁSCARA DE RECORTE GEOMÉTRICA (STENCIL / CLIPPING PATH ESTRICTO) ---
    // Impide terminantemente que el mapa de calor traspase las fronteras físicas del recinto
    this.ctx.beginPath();
    const shape = AppState.venue.shape || 'rectangle';
    const widthM = AppState.venue.width || 15;
    const lengthM = AppState.venue.length || 20;
    
    const origin = this.mToPx(0, 0);
    const maxCorner = this.mToPx(widthM, lengthM);
    const canvasW = maxCorner.px - origin.px;
    const canvasH = maxCorner.py - origin.py;

    if (shape === 'circle') {
      const centerX = origin.px + canvasW / 2;
      const centerY = origin.py + canvasH / 2;
      const radiusPx = Math.min(canvasW, canvasH) / 2;
      this.ctx.arc(centerX, centerY, radiusPx, 0, Math.PI * 2);
    } else if (shape === 'fan') {
      const startX = origin.px + canvasW / 2;
      const startY = origin.py;
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(origin.px + canvasW, origin.py + canvasH);
      this.ctx.lineTo(origin.px, origin.py + canvasH);
      this.ctx.closePath();
    } else {
      this.ctx.rect(origin.px, origin.py, canvasW, canvasH);
    }
    
    this.ctx.clip(); // Aplicar restricción de renderizado vectorial
    // -----------------------------------------------------------------------

    const rt60 = AppState.venue.rt60 || 1.0;
    const reflectionMultiplier = Math.min(1.25, Math.max(0.9, rt60 / 1.5));

    // Iteración sobre la matriz de puntos del recinto
    for (let x = 0; x < widthM; x += stepM) {
      for (let y = 0; y < lengthM; y += stepM) {
        let spl = calculateSplAtPosition(
          AppState.speakers,
          x + stepM / 2,
          y + stepM / 2,
          1.2,
          AppState.venue.type,
          AppState.subwoofers,
          shape,
          widthM,
          lengthM
        );

        spl *= reflectionMultiplier;

        const color = this.splToColor(spl);
        const { px, py } = this.mToPx(x, y);

        this.ctx.fillStyle = color;
        this.ctx.fillRect(px, py, stepPx + 0.8, stepPx + 0.8);
      }
    }

    this.ctx.restore();
  }

  /**
   * Renderiza las cajas acústicas principales (PA) con su orientación y cono de cobertura.
   */
  drawSpeakers() {
    if (!AppState.speakers || !Array.isArray(AppState.speakers)) return;

    AppState.speakers.forEach((speaker, index) => {
      if (speaker.active === false) return;
      const { px, py } = this.mToPx(speaker.x, speaker.y);

      this.ctx.save();
      this.ctx.translate(px, py);
      this.ctx.rotate((speaker.rotation || 0) * Math.PI / 180);

      // Cono de dispersión acústica direccional
      this.ctx.fillStyle = 'rgba(225, 29, 72, 0.12)';
      this.ctx.strokeStyle = 'rgba(225, 29, 72, 0.3)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(-30, -70);
      this.ctx.lineTo(30, -70);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      // Gabinete físico de la bocina PA
      this.ctx.fillStyle = '#e11d48';
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.fillRect(-12, -18, 24, 36);
      this.ctx.strokeRect(-12, -18, 24, 36);

      // Etiqueta de texto identificadora
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 11px Inter, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(`L${index + 1}`, 0, 0);

      this.ctx.restore();
    });
  }

  /**
   * Renderiza los subwoofers en el plano de planta.
   */
  drawSubwoofers() {
    if (!AppState.subwoofers || !Array.isArray(AppState.subwoofers)) return;

    AppState.subwoofers.forEach((sub, index) => {
      if (sub.active === false) return;
      const { px, py } = this.mToPx(sub.x, sub.y);

      this.ctx.save();
      this.ctx.translate(px, py);

      // Cuerpo del Subwoofer
      this.ctx.fillStyle = '#0284c7';
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.fillRect(-14, -14, 28, 28);
      this.ctx.strokeRect(-14, -14, 28, 28);

      // Etiqueta de texto identificadora
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 11px Inter, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(`S${index + 1}`, 0, 0);

      this.ctx.restore();
    });
  }

  /**
   * Dibuja una leyenda explicativa de niveles SPL en la esquina del canvas.
   */
  drawLegend() {
    const legendX = 20;
    const legendY = this.canvas.height - 90;
    const boxSize = 14;

    const items = [
      { label: '< 85 dB (Óptimo / Conversación)', color: 'rgba(0, 206, 209, 0.5)' },
      { label: '85 - 105 dB (Música / Rango ideal)', color: 'rgba(50, 205, 50, 0.5)' },
      { label: '105 - 115 dB (Alto impacto)', color: 'rgba(255, 140, 0, 0.6)' },
      { label: '> 115 dB (Saturación / Crítico)', color: 'rgba(255, 0, 0, 0.7)' }
    ];

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 1;
    this.ctx.fillRect(legendX, legendY, 230, 80);
    this.ctx.strokeRect(legendX, legendY, 230, 80);

    items.forEach((item, idx) => {
      const yPos = legendY + 12 + idx * 16;
      this.ctx.fillStyle = item.color;
      this.ctx.fillRect(legendX + 10, yPos, boxSize, boxSize);
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 0.5;
      this.ctx.strokeRect(legendX + 10, yPos, boxSize, boxSize);

      this.ctx.fillStyle = '#cbd5e1';
      this.ctx.font = '10px Inter, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(item.label, legendX + 32, yPos + boxSize / 2);
    });

    this.ctx.restore();
  }

  /**
   * Inicializa los listeners de eventos del mouse para permitir arrastrar y soltar equipos.
   */
  initInteractionListeners() {
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const { x, y } = this.pxToM(e.clientX - rect.left, e.clientY - rect.top);

      // Comprobar selección de Bocinas PA
      if (AppState.speakers) {
        for (let s of AppState.speakers) {
          if (Math.hypot(s.x - x, s.y - y) < 1.2) {
            this.selectedItem = s;
            this.itemType = 'speaker';
            this.isDragging = true;
            return;
          }
        }
      }

      // Comprobar selección de Subwoofers
      if (AppState.subwoofers) {
        for (let sub of AppState.subwoofers) {
          if (Math.hypot(sub.x - x, sub.y - y) < 1.2) {
            this.selectedItem = sub;
            this.itemType = 'subwoofer';
            this.isDragging = true;
            return;
          }
        }
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isDragging || !this.selectedItem) return;
      const rect = this.canvas.getBoundingClientRect();
      const { x, y } = this.pxToM(e.clientX - rect.left, e.clientY - rect.top);

      // Limitar el movimiento dentro de las dimensiones del recinto
      const maxW = AppState.venue.width || 15;
      const maxL = AppState.venue.length || 20;

      this.selectedItem.x = Math.max(0.5, Math.min(maxW - 0.5, x));
      this.selectedItem.y = Math.max(0.5, Math.min(maxL - 0.5, y));

      this.render();
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.selectedItem = null;
        this.itemType = null;
        // Disparar evento de actualización global si es necesario
        if (typeof window.triggerAppStateUpdate === 'function') {
          window.triggerAppStateUpdate();
        }
      }
    });
  }

  /**
   * Ejecuta el ciclo completo de renderizado gráfico en el canvas.
   */
  render() {
    if (!this.ctx) return;
    
    // Limpiar canvas completo
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Color de fondo del espacio de trabajo
    this.ctx.fillStyle = '#090d16';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Renderizar mapa de calor si el modo está activo
    if (AppState.viewMode === 'heatmap') {
      this.drawHeatmap();
    }

    // Renderizar contornos, grilla y equipos
    this.drawVenueBoundary();
    this.drawGrid();
    this.drawSpeakers();
    this.drawSubwoofers();
    this.drawLegend();
  }

  /**
   * Método de compatibilidad para animaciones o actualizaciones directas.
   */
  drawWaveAnimation() {
    this.render();
  }
}