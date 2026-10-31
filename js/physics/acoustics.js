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
  // 1. Análisis físico del recinto (Volumen y Superficie)
  const volume = venue.length * venue.width * (venue.height || 5);
  const surfaceArea = 2 * (venue.width * venue.length + venue.width * (venue.height || 5) + venue.length * (venue.height || 5));
  const audience = venue.audienceCount || 100;

  // 2. Cálculo analítico de la demanda de potencia RMS basado en aforo y física
  let basePowerPerPerson = 3.5; 
  if (sourceProfile === 'edm' || sourceProfile === 'electronic') basePowerPerPerson = 5.0;
  if (sourceProfile === 'speech') basePowerPerPerson = 1.5;

  const calculatedRequiredRms = Math.round(audience * basePowerPerPerson * (rt60 > 1.5 ? 1.25 : 1.0));
  
  // Sugerencia de cajas basada estrictamente en el aforo y la geometría
  const recommendedTopBoxes = Math.max(2, Math.ceil(audience / 100));
  const recommendedSubwoofers = Math.max(1, Math.ceil(audience / 150));

  const suggestedTilt = Math.min(15, Math.max(3, Math.round(venue.length / 3)));
  const needsDelays = venue.length > 25;

  let freqResponse = '55 Hz - 18,000 Hz (Full-Range estándar)';
  if (sourceProfile === 'edm' || sourceProfile === 'electronic') {
    freqResponse = '35 Hz - 20,000 Hz (Respuesta extendida en sub-graves)';
  } else if (sourceProfile === 'speech') {
    freqResponse = '80 Hz - 16,000 Hz (Corte de graves enfocado en inteligibilidad vocal)';
  }

  // Métricas acústicas derivadas de la física del recinto
  const dcDistance = parseFloat((0.14 * Math.sqrt(volume / Math.max(0.1, rt60))).toFixed(1));
  
  let c50Clarity = '+3 dB (Excelente inteligibilidad de la palabra y definición)';
  if (rt60 > 2.0) c50Clarity = '-3 dB / Pobre (Campo reverberante domina sobre el sonido directo)';
  else if (rt60 > 1.2) c50Clarity = '0 dB / Moderado (Adecuado para música en vivo)';

  // Sugerencia inteligente de absorción basada en Sabins si el RT60 es alto
  let absorptionSuggestion = 'Superficies con coeficiente de absorción adecuado para el espacio';
  if (rt60 > 1.5) {
    const targetRt60 = sourceProfile === 'speech' ? 0.8 : 1.2;
    const currentSabins = (0.161 * volume) / rt60;
    const targetSabins = (0.161 * volume) / targetRt60;
    const missingSabins = Math.max(0, targetSabins - currentSabins);
    const percentageNeeded = Math.min(100, ((missingSabins / surfaceArea) * 100)).toFixed(1);
    
    absorptionSuggestion = `Déficit acústico crítico: Tratar al menos el ${percentageNeeded}% (${missingSabins.toFixed(1)} Sabins métricos) con paneles fonoabsorbentes (NRC 0.85+)`;
  }

  return {
    electroacoustics: [
      { label: 'Topología Recomendada', value: `${recommendedTopBoxes}x Sistemas Principales Activos Balanceados (Diseñado para aforo de ${audience} pers.)` },
      { label: 'Subwoofers Sugeridos', value: `${recommendedSubwoofers}x Subwoofers de 18" acoplados en fase (Evita cancelación asimétrica)` },
      { label: 'Refuerzos (Delays)', value: needsDelays ? `Requerido: 2x Cajas de retardo alineadas a los ${Math.round(venue.length * 0.6)}m` : 'No se requieren líneas de retardo' },
      { label: 'Down-tilt Recomendado', value: `${suggestedTilt}° de inclinación hacia abajo para minimizar primeras reflexiones en muros` },
      { label: 'Respuesta en Frecuencia', value: freqResponse }
    ],
    amplification: [
      { label: 'Potencia Real Sugerida (Física)', value: `${calculatedRequiredRms} W RMS Totales (Calculada por aforo, volumen y headroom de 3dB)` },
      { label: 'Relación Señal/Ruido', value: '≥ 105 dB (SNR para operación limpia sin piso de ruido audible)' },
      { label: 'Distorsión Armónica (THD)', value: '< 0.05% THD a potencia nominal (Clase D de alta eficiencia)' },
      { label: 'Procesamiento Digital (DSP)', value: 'Filtrado FIR de fase lineal, alineación temporal (Delay ms) y EQ paramétrica' }
    ],
    acoustics: [
      { label: 'Distancia Crítica (Dc)', value: `${dcDistance}m desde el proscenio (Límite donde el campo directo iguala al reverberante)` },
      { label: 'Índice de Claridad C50/C80', value: c50Clarity },
      { label: 'Sugerencia de Absorción', value: absorptionSuggestion }
    ]
  };
}