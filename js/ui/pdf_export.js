/**
 * Módulo de Exportación a PDF
 * Captura en el documento tanto la simulación como el Mapa de Calor SPL
 * con la leyenda espectral visible y métricas técnicas.
 */

import { AppState, notifyStateChange } from '../state.js';
import { calculateRT60, calculateSplAtPosition, getRecommendedSpecs } from '../physics/acoustics.js';
import { calculateElectricalLoad } from '../physics/electrical.js';
import { getCanvasEngine } from './render/canvas_engine.js';

export function generatePdfReport() {
  const canvasEngineInstance = getCanvasEngine();
  let heatmapImgData = '';
  let wavesImgData = '';

  // Capturar imágenes en alta resolución en ambos modos de simulación
  if (canvasEngineInstance) {
    heatmapImgData = canvasEngineInstance.renderHeatmapSnapshot();
    wavesImgData = canvasEngineInstance.renderWavesSnapshot();
    
    // Restaurar la vista del lienzo al modo activo del usuario
    notifyStateChange();
  }

  const rtResult = calculateRT60(AppState.venue);
  const splAtListener = calculateSplAtPosition(
    AppState.speakers,
    AppState.listener.x,
    AppState.listener.y,
    1.2,
    AppState.venue.type,
    AppState.subwoofers,
    AppState.venue.shape,
    AppState.venue.width,
    AppState.venue.length
  );
  
  const elecResult = calculateElectricalLoad(
    AppState.speakers,
    AppState.subwoofers,
    AppState.venue.voltage,
    0.85,
    AppState.venue,
    AppState.sourceProfile,
    rtResult.rt60
  );

  const specs = getRecommendedSpecs(
    AppState.venue,
    AppState.sourceProfile,
    rtResult.rt60,
    AppState.speakers,
    AppState.subwoofers
  );

  const shapeNames = {
    rectangle: 'Rectangular',
    circle: 'Circular / Palenque',
    fan: 'En Abanico (Teatro/Auditorio)',
    irregular: 'Polígono Irregular'
  };

  const materialNames = {
    concrete: 'Concreto / Vidrio (Reflexivo)',
    drywall: 'Tablaroca / Madera',
    brick: 'Ladrillo Visto',
    tile: 'Mármol / Azulejo',
    carpet: 'Alfombra / Mobiliario Afelpado',
    panels: 'Paneles Acústicos (Absorbente)'
  };

  const profileNames = {
    speech: 'Conferencia / Voz Hablada',
    strings: 'Instrumentos de Cuerda (Violín, Guitarra)',
    percussion: 'Percusiones / Batería / Tambores',
    live_band: 'Banda / Grupo en Vivo',
    edm: 'DJ / Música Electrónica'
  };

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permite las ventanas emergentes (pop-ups) para descargar el informe PDF.');
    return;
  }

  const currentDate = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Reporte Técnico - AcousticField Pro</title>
      <style>
        * { 
          box-sizing: border-box; 
          margin: 0; 
          padding: 0; 
          font-family: 'Segoe UI', Helvetica, Arial, sans-serif; 
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important; 
        }
        body { padding: 25px; background-color: #fff; color: #1e293b; font-size: 11px; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 15px; }
        .header h1 { font-size: 18px; color: #0f172a; text-transform: uppercase; }
        .header h1 span { color: #2563eb; }
        .header .date { font-size: 9px; color: #64748b; text-align: right; }
        
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
        .card h3 { font-size: 12px; color: #2563eb; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; }
        .card ul { list-style: none; }
        .card li { margin-bottom: 3px; color: #475569; }
        .card li strong { color: #0f172a; }

        /* MÉTRICAS PRINCIPALES EN BANNER */
        .metrics-banner { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px; background-color: #0f172a !important; color: #fff; padding: 10px; border-radius: 6px; }
        .metric-box { text-align: center; }
        .metric-box .label { font-size: 8px; text-transform: uppercase; color: #94a3b8; }
        .metric-box .value { font-size: 15px; font-weight: bold; color: #38bdf8; margin: 2px 0; }
        .metric-box .sub { font-size: 8px; color: #cbd5e1; }

        /* SECCIÓN VISUAL DE PLANOS Y MAPA TÉRMICO */
        .visual-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px; page-break-inside: avoid; }
        .visual-card { text-align: center; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; }
        .visual-card h4 { font-size: 11px; color: #0f172a; margin-bottom: 6px; text-align: left; }
        .visual-card img { max-width: 100%; height: 200px; border: 1px solid #cbd5e1; border-radius: 4px; background-color: #08090a !important; object-fit: contain; }

        /* LEYENDA TÉRMICA ESPECTRAL EN PDF */
        .heatmap-legend-pdf { 
          margin-bottom: 15px; 
          background-color: #08090a !important; 
          padding: 8px 12px; 
          border-radius: 6px; 
          color: #ffffff !important; 
          display: flex; 
          align-items: center; 
          gap: 10px; 
          font-size: 9px; 
          font-weight: bold;
        }
        .legend-bar-pdf { 
          flex: 1; 
          height: 12px; 
          border-radius: 6px; 
          background: linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000) !important; 
          border: 1px solid #ffffff;
        }

        .specs-section { margin-top: 10px; page-break-inside: avoid; }
        .specs-section h2 { font-size: 13px; color: #0f172a; border-left: 4px solid #2563eb; padding-left: 6px; margin-bottom: 10px; }
        .specs-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .spec-card { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; }
        .spec-card h4 { font-size: 10px; color: #1e40af; margin-bottom: 4px; }
        .spec-card ul { list-style: none; }
        .spec-card li { font-size: 9px; margin-bottom: 3px; color: #334155; }
        .spec-card li strong { color: #0f172a; }

        .footer { margin-top: 20px; text-align: center; font-size: 8px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }

        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>AcousticField <span>PRO</span></h1>
          <p style="font-size: 10px; color: #64748b;">Informe de Simulación Electroacústica y Diagnóstico de Sala</p>
        </div>
        <div class="date">
          <p><strong>Fecha:</strong> ${currentDate}</p>
          <p><strong>Estado:</strong> Simulación Completa</p>
        </div>
      </div>

      <!-- SECCIÓN 1 Y 2: RECINTO Y EQUIPO -->
      <div class="grid-2">
        <div class="card">
          <h3>1. Características del Recinto</h3>
          <ul>
            <li><strong>Entorno:</strong> ${AppState.venue.type === 'indoor' ? 'Interior (Muros)' : 'Exterior (Campo Abierto)'}</li>
            <li><strong>Geometría:</strong> ${shapeNames[AppState.venue.shape] || AppState.venue.shape}</li>
            <li><strong>Dimensiones:</strong> ${AppState.venue.length}m (Largo) x ${AppState.venue.width}m (Ancho) x ${AppState.venue.height}m (Alto)</li>
            <li><strong>Material Predominante:</strong> ${materialNames[AppState.venue.material] || AppState.venue.material}</li>
            <li><strong>Aforo Estimado:</strong> ${AppState.venue.audienceCount} personas</li>
            <li><strong>Suministro Eléctrico:</strong> ${AppState.venue.voltage}V</li>
          </ul>
        </div>

        <div class="card">
          <h3>2. Configuración de Equipos</h3>
          <ul>
            <li><strong>Perfil de Uso:</strong> ${profileNames[AppState.sourceProfile] || AppState.sourceProfile}</li>
            <li><strong>Dimensiones Tarima:</strong> ${AppState.stage.width}m x ${AppState.stage.length}m (Posición: X=${AppState.stage.x}m, Y=${AppState.stage.y}m)</li>
            <li><strong>Cajas Principales PA:</strong> ${AppState.speakers.length} unidad(es) activas</li>
            <li><strong>Subwoofers:</strong> ${AppState.subwoofers.length} unidad(es) activas</li>
            <li><strong>Posición Oyente:</strong> X=${AppState.listener.x}m, Y=${AppState.listener.y}m</li>
          </ul>
        </div>
      </div>

      <!-- BANNER DE MÉTRICAS -->
      <div class="metrics-banner">
        <div class="metric-box">
          <div class="label">Reverberación RT60</div>
          <div class="value">${rtResult.rt60} s</div>
          <div class="sub">${rtResult.status}</div>
        </div>
        <div class="metric-box">
          <div class="label">SPL @ Posición Oyente</div>
          <div class="value">${splAtListener} dB</div>
          <div class="sub">Presión Acústica Calculada</div>
        </div>
        <div class="metric-box">
          <div class="label">Carga Eléctrica Total</div>
          <div class="value">${elecResult.continuousAmps} A</div>
          <div class="sub">${elecResult.breakersNeeded} Breaker(s) 20A (${elecResult.wireGauge})</div>
        </div>
      </div>

      <!-- MUESTRA DE AMBAS SIMULACIONES (MAPA DE CALOR + ONDAS) -->
      <div class="visual-grid">
        <div class="visual-card">
          <h4>Mapa de Calor SPL (Presión Acústica)</h4>
          <img src="${heatmapImgData}" alt="Mapa de Calor SPL">
        </div>
        <div class="visual-card">
          <h4>Propagación y Frente de Ondas</h4>
          <img src="${wavesImgData}" alt="Animación de Ondas">
        </div>
      </div>

      <!-- LEYENDA ESPECTRAL TÉRMICA EN PDF -->
      <div class="heatmap-legend-pdf">
        <span>&lt; 75 dB (Sordo / Atenuación)</span>
        <div class="legend-bar-pdf"></div>
        <span>&gt; 105 dB (Saturación / Pico)</span>
      </div>

      <!-- SECCIÓN DE ESPECIFICACIONES TÉCNICAS RECOMENDADAS -->
      <div class="specs-section">
        <h2>3. Especificaciones Técnicas Recomendadas del Sistema</h2>
        <div class="specs-grid">
          <div class="spec-card">
            <h4>A. Cajas, Arreglo y Electroacústica</h4>
            <ul>
              ${specs.electroacoustics.map(s => `<li><strong>${s.label}:</strong> ${s.value}</li>`).join('')}
            </ul>
          </div>

          <div class="spec-card">
            <h4>B. Amplificación y Cadena Digital</h4>
            <ul>
              ${specs.amplification.map(s => `<li><strong>${s.label}:</strong> ${s.value}</li>`).join('')}
            </ul>
          </div>

          <div class="spec-card" style="grid-column: span 2;">
            <h4>C. Comportamiento Acústico e Inteligibilidad</h4>
            <ul>
              ${specs.acoustics.map(s => `<li><strong>${s.label}:</strong> ${s.value}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>AcousticField Pro - Documento generado para planeación técnica electroacústica.</p>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 450);
        };
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
}