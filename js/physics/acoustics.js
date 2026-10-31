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
  if (sourceProfile === 'edm' || sourceProfile === 'electronic') freqResponse = '35 Hz - 20,000 Hz (Respuesta extendida en sub-graves)';
  else if (sourceProfile === 'speech') freqResponse = '80 Hz - 16,000 Hz (Corte de graves enfocado en voz)';

  // Definir si es sistema activo (por defecto true en configuraciones modernas)
  const isPoweredSystem = true; 

  let totalSpeakerWatts = 0;
  speakers.forEach(s => totalSpeakerWatts += (s.rmsWatts || 500));
  let totalSubWatts = 0;
  subwoofers.forEach(s => totalSubWatts += (s.rmsWatts || 1000));

  const targetRms = (totalSpeakerWatts + totalSubWatts) * 1.3; // Con headroom
  const snrTarget = '≥ 105 dB (SNR para sonido limpio sin piso de ruido)';
  const thdTarget = '< 0.05% THD (Distorsión Armónica Total imperceptible)';

  let sampleRate = '48 kHz (Estándar profesional para eventos en vivo)';
  let bitDepth = '24-bit (Rango dinámico amplio > 120 dB)';
  if (sourceProfile === 'strings' || sourceProfile === 'percussion') {
    sampleRate = '96 kHz / 24-bit (Alta resolución para instrumentos de precisión)';
  }

  const volume = venue.length * venue.width * (venue.height || 5);
  const surfaceArea = 2 * (venue.width * venue.length + venue.width * (venue.height || 5) + venue.length * (venue.height || 5));
  
  const dcDistance = parseFloat((0.14 * Math.sqrt(volume / Math.max(0.1, rt60))).toFixed(1));
  
  let c50Clarity = '+3 dB (Excelente inteligibilidad de la palabra)';
  if (rt60 > 2.0) c50Clarity = '-3 dB / Pobre (Campo reverberante dominante)';
  else if (rt60 > 1.2) c50Clarity = '0 dB / Moderado (Aceptable para música en vivo)';

  // --- Lógica condicional avanzada para Sabins si RT60 > 1.5s ---
  let absorptionSuggestion = 'Superficies con absorción acústica adecuada';
  if (rt60 > 1.5) {
    const targetRt60 = sourceProfile === 'speech' ? 0.8 : 1.2;
    const currentSabins = (0.161 * volume) / rt60;
    const targetSabins = (0.161 * volume) / targetRt60;
    const missingSabins = Math.max(0, targetSabins - currentSabins);
    const percentageNeeded = Math.min(100, ((missingSabins / surfaceArea) * 100)).toFixed(1);
    
    absorptionSuggestion = `Tratar al menos el ${percentageNeeded}% (${missingSabins.toFixed(1)} Sabins métricos) de las superficies con paneles fonoabsorbentes (NRC 0.85+)`;
  }

  const electroacousticsList = [
    { label: 'Cantidad Cajas PA', value: `${speakerCount}x Sistemas Principales Activos (Aforo estimado: ${venue.audienceCount || 100} pers.)` },
    { label: 'Subwoofers Requeridos', value: subCount > 0 ? `${subCount}x Subwoofers de 18" en arreglo optimizado` : 'Sin subwoofers activos' },
    { label: 'Refuerzos (Delays)', value: needsDelays ? `${delayCount}x Cajas secundarias alineadas a los ${Math.round(venue.length * 0.6)}m` : 'No se requieren cajas de retardo' },
    { label: 'Down-tilt Recomendado', value: `${suggestedTilt}° de inclinación hacia la audiencia` },
    { label: 'Respuesta en Frecuencia', value: freqResponse }
  ];

  // Ocultar métricas pasivas si el sistema es activo
  if (!isPoweredSystem) {
    electroacousticsList.push(
      { label: 'Impedancia Nominal', value: '8 Ω por vía (Enlace controlado)' },
      { label: 'Sensibilidad Requerida', value: '≥ 98 dB SPL @ 1W/1m' }
    );
  }

  return {
    electroacoustics: electroacousticsList,
    amplification: [
      { label: 'Potencia Real Sugerida', value: `${targetRms} W RMS (Incluyendo headroom dinámico de 3dB)` },
      { label: 'Relación Señal/Ruido', value: snrTarget },
      { label: 'Distorsión Armónica', value: thdTarget },
      { label: 'Procesamiento Digital (DSP)', value: `Filtros FIR, Alineación temporal y DAC @ ${sampleRate}, ${bitDepth}` }
    ],
    acoustics: [
      { label: 'Distancia Crítica (Dc)', value: `${dcDistance}m desde el proscenio (Equilibrio directo/reverberante)` },
      { label: 'Índice de Claridad C50/C80', value: c50Clarity },
      { label: 'Sugerencia de Absorción', value: absorptionSuggestion }
    ]
  };
}