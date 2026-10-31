/**
 * Motor de Cálculo Acústico e Inteligibilidad (Acoustic Engine)
 */

const ABSORPTION_COEFFS = {
  concrete: 0.03,
  drywall: 0.10,
  brick: 0.05,
  tile: 0.02,
  carpet: 0.30,
  panels: 0.65
};

export function calculateRT60(venue) {
  if (venue.type === 'outdoor') {
    return { rt60: 0.05, status: 'Campo abierto (Sin reverberación)' };
  }

  const volume = venue.length * venue.width * venue.height;
  const floorCeilingArea = 2 * (venue.length * venue.width);
  const wallsArea = 2 * (venue.length * venue.height) + 2 * (venue.width * venue.height);
  const totalSurfaceArea = floorCeilingArea + wallsArea;

  const alpha = ABSORPTION_COEFFS[venue.material] || 0.05;
  let totalAbsorption = totalSurfaceArea * alpha;

  const audienceAbsorption = (venue.audienceCount || 0) * 0.4;
  totalAbsorption += audienceAbsorption;

  const rt60 = (0.161 * volume) / totalAbsorption;

  let status = 'Aceptable';
  if (rt60 > 1.8) status = 'Muy Reverberante (Eco crítico - Perjudicial para voz)';
  else if (rt60 > 1.2) status = 'Reverberación moderada (Ideal para conciertos/música)';
  else if (rt60 < 0.6) status = 'Seco / Muy absorbente (Ideal para conferencias)';

  return { rt60: parseFloat(rt60.toFixed(2)), status };
}

export function calculateDistance3D(x1, y1, z1, x2, y2, z2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function calculateOffAxisLoss(speaker, listenerX, listenerY, listenerZ) {
  const dx = listenerX - speaker.x;
  const dy = listenerY - speaker.y;
  
  // Ángulo relativo respecto a la rotación propia de esta bocina
  const angleRad = Math.atan2(dx, dy);
  const angleDeg = (angleRad * (180 / Math.PI));
  
  const speakerRotation = speaker.rotation || 0;
  let relativeAngle = Math.abs(angleDeg - speakerRotation);
  if (relativeAngle > 180) relativeAngle = 360 - relativeAngle;

  const halfCoverageH = (speaker.angleH || 90) / 2;

  if (relativeAngle <= halfCoverageH) {
    return (relativeAngle / halfCoverageH) * 3;
  } else {
    const extraAngle = relativeAngle - halfCoverageH;
    return 3 + (extraAngle * 0.35);
  }
}

// Suma logarítmica de presión acústica SPL incluyendo Bocinas PA y Subwoofers
export function calculateSplAtPosition(speakers, listenerX, listenerY, listenerZ = 1.2, venueType = 'indoor', subwoofers = []) {
  let totalIntensity = 0;

  // 1. Aporte de Cajas Principales PA
  speakers.forEach(speaker => {
    if (!speaker.active) return;

    const dist = Math.max(1, calculateDistance3D(speaker.x, speaker.y, speaker.z, listenerX, listenerY, listenerZ));
    let distanceLoss = 20 * Math.log10(dist);

    if (venueType === 'indoor' && dist > 8) {
      distanceLoss *= 0.82;
    }

    const offAxisLoss = calculateOffAxisLoss(speaker, listenerX, listenerY, listenerZ);
    const splFromSpeaker = (speaker.maxSpl || 128) - distanceLoss - offAxisLoss;

    totalIntensity += Math.pow(10, splFromSpeaker / 10);
  });

  // 2. Aporte de Subwoofers (Omnidireccionales en baja frecuencia)
  if (subwoofers && Array.isArray(subwoofers)) {
    subwoofers.forEach(sub => {
      if (!sub.active) return;

      const dist = Math.max(1, calculateDistance3D(sub.x, sub.y, sub.z || 0.5, listenerX, listenerY, listenerZ));
      let distanceLoss = 20 * Math.log10(dist);

      if (venueType === 'indoor' && dist > 6) {
        distanceLoss *= 0.85;
      }

      // Los subwoofers no tienen pérdida fuera de eje sustancial (Patrón esférico)
      const splFromSub = (sub.maxSpl || 133) - distanceLoss;
      totalIntensity += Math.pow(10, splFromSub / 10);
    });
  }

  if (totalIntensity <= 0) return 0;

  const totalSpl = 10 * Math.log10(totalIntensity);
  return parseFloat(totalSpl.toFixed(1));
}

export function getRecommendedSpecs(venue, sourceProfile, rt60, speakers, subwoofers) {
  const speakerCount = speakers ? speakers.length : 2;
  const subCount = subwoofers ? subwoofers.length : 1;
  const needsDelays = venue.length > 25;
  const delayCount = needsDelays ? 2 : 0;
  
  const suggestedTilt = Math.min(15, Math.max(3, Math.round(venue.length / 3)));

  let freqResponse = '55 Hz - 18,000 Hz (Full-Range estándar)';
  if (sourceProfile === 'edm') freqResponse = '35 Hz - 20,000 Hz (Respuesta extendida en sub-graves)';
  else if (sourceProfile === 'speech') freqResponse = '80 Hz - 16,000 Hz (Corte de graves enfocado en voz)';

  const systemImpedance = '8 Ω por caja (Conexión segura para amplificadores de 4 Ω / 8 Ω)';
  const minSensitivity = 'Sensibilidad sugerida: ≥ 98 dB SPL @ 1W/1m';

  let totalSpeakerWatts = 0;
  speakers.forEach(s => totalSpeakerWatts += (s.rmsWatts || 500));
  let totalSubWatts = 0;
  subwoofers.forEach(s => totalSubWatts += (s.rmsWatts || 1000));

  const targetRms = totalSpeakerWatts + totalSubWatts;
  const snrTarget = '≥ 95 dB (SNR para sonido limpio sin hiss de fondo)';
  const thdTarget = '< 0.05% THD (Distorsión Armónica Total imperceptible)';

  let sampleRate = '48 kHz (Estándar profesional para eventos en vivo)';
  let bitDepth = '24-bit (Rango dinámico amplio > 120 dB)';
  if (sourceProfile === 'strings' || sourceProfile === 'percussion') {
    sampleRate = '96 kHz / 24-bit (Alta resolución para instrumentos de precisión)';
  }

  const dcDistance = parseFloat((0.057 * Math.sqrt((venue.length * venue.width * venue.height) / Math.max(0.1, rt60))).toFixed(1));
  const c50Clarity = rt60 < 1.0 ? '+3 dB (Excelente inteligibilidad de la palabra)' : '-2 dB (Requiere ecualización / tratamiento)';

  return {
    electroacoustics: [
      { label: 'Cantidad Cajas PA', value: `${speakerCount}x Cajas Principales activas` },
      { label: 'Subwoofers Requeridos', value: subCount > 0 ? `${subCount}x Subwoofers de 18" en el plano` : 'Sin subwoofers activos' },
      { label: 'Refuerzos (Delays)', value: needsDelays ? `${delayCount}x Cajas secundarias alineadas a los ${Math.round(venue.length * 0.6)}m` : 'No se requieren cajas de retardo' },
      { label: 'Down-tilt Recomendado', value: `${suggestedTilt}° de inclinación hacia la audiencia` },
      { label: 'Respuesta en Frecuencia', value: freqResponse },
      { label: 'Impedancia Nominal', value: systemImpedance },
      { label: 'Sensibilidad Requerida', value: minSensitivity }
    ],
    amplification: [
      { label: 'Potencia Real Sugerida', value: `${targetRms} W RMS Continuos acumulados` },
      { label: 'Relación Señal/Ruido', value: snrTarget },
      { label: 'Distorsión Armónica', value: thdTarget },
      { label: 'Procesamiento Digital', value: `DAC @ ${sampleRate}, ${bitDepth}` }
    ],
    acoustics: [
      { label: 'Distancia Crítica (Dc)', value: `${dcDistance}m desde el escenario (Punto de eco equilibrado)` },
      { label: 'Índice de Claridad C50', value: c50Clarity },
      { label: 'Sugerencia de Absorción', value: rt60 > 1.5 ? 'Instalar paneles absorbentes en la pared trasera para eliminar rebotes' : 'Superficies con absorción adecuada' }
    ]
  };
}