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
  
  // Cálculo de superficie según la geometría del recinto
  let floorCeilingArea = 0;
  let wallsArea = 0;

  if (venue.shape === 'circle') {
    const radius = venue.width / 2;
    floorCeilingArea = 2 * (Math.PI * Math.pow(radius, 2));
    wallsArea = (2 * Math.PI * radius) * venue.height;
  } else if (venue.shape === 'fan') {
    // Geometría en abanico (aprox 1.2x superficie por paredes divergentes)
    floorCeilingArea = 2 * (venue.length * venue.width * 0.85);
    wallsArea = 2 * (venue.length * venue.height) + 2 * (venue.width * venue.height);
  } else {
    // Rectangular / Estándar
    floorCeilingArea = 2 * (venue.length * venue.width);
    wallsArea = 2 * (venue.length * venue.height) + 2 * (venue.width * venue.height);
  }

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

// Suma logarítmica de SPL con efecto de concentración nodal por curvatura (Palenque / Abanico)
export function calculateSplAtPosition(speakers, listenerX, listenerY, listenerZ = 1.2, venueType = 'indoor', subwoofers = [], venueShape = 'rectangle', venueWidth = 15, venueLength = 20) {
  let totalIntensity = 0;

  speakers.forEach(speaker => {
    if (!speaker.active) return;

    const dist = Math.max(1, calculateDistance3D(speaker.x, speaker.y, speaker.z, listenerX, listenerY, listenerZ));
    let distanceLoss = 20 * Math.log10(dist);

    if (venueType === 'indoor' && dist > 8) {
      distanceLoss *= 0.82;
    }

    const offAxisLoss = calculateOffAxisLoss(speaker, listenerX, listenerY, listenerZ);
    let splFromSpeaker = (speaker.maxSpl || 128) - distanceLoss - offAxisLoss;

    // EFECTO PALENQUE / MANTAS CÓNCAVAS: Enfoque reflexivo hacia el centro geométrico
    if (venueShape === 'circle' && venueType === 'indoor') {
      const centerX = venueWidth / 2;
      const centerY = venueLength / 2;
      const distToCenter = Math.sqrt(Math.pow(listenerX - centerX, 2) + Math.pow(listenerY - centerY, 2));
      const focalRadius = venueWidth / 4; // Radio del punto focal primario (F = R/2)

      if (distToCenter < focalRadius) {
        // Incremento de presión sonora de +3 dB a +6 dB por reflexiones convergentes
        const focalBoost = (1 - (distToCenter / focalRadius)) * 5.5;
        splFromSpeaker += focalBoost;
      }
    }

    totalIntensity += Math.pow(10, splFromSpeaker / 10);
  });

  if (subwoofers && Array.isArray(subwoofers)) {
    subwoofers.forEach(sub => {
      if (!sub.active) return;

      const dist = Math.max(1, calculateDistance3D(sub.x, sub.y, sub.z || 0.5, listenerX, listenerY, listenerZ));
      let distanceLoss = 20 * Math.log10(dist);

      if (venueType === 'indoor' && dist > 6) {
        distanceLoss *= 0.85;
      }

      let splFromSub = (sub.maxSpl || 133) - distanceLoss;

      // Reflexión en graves acumulativa en geometría circular o abanico
      if ((venueShape === 'circle' || venueShape === 'fan') && venueType === 'indoor') {
        const centerX = venueWidth / 2;
        const centerY = venueLength / 2;
        const distToCenter = Math.sqrt(Math.pow(listenerX - centerX, 2) + Math.pow(listenerY - centerY, 2));
        if (distToCenter < venueWidth / 3) {
          splFromSub += 3.0; // Refuerzo de graves por concentración de frontera circular
        }
      }

      totalIntensity += Math.pow(10, splFromSub / 10);
    });
  }

  if (totalIntensity <= 0) return 0;

  const totalSpl = 10 * Math.log10(totalIntensity);
  return parseFloat(totalSpl.toFixed(1));
}

export function getRecommendedSpecs(venue, sourceProfile, rt60, speakers, subwoofers) {
  const volume = venue.length * venue.width * (venue.height || 5);
  const surfaceArea = 2 * (venue.width * venue.length + venue.width * (venue.height || 5) + venue.length * (venue.height || 5));
  const audience = venue.audienceCount || 100;

  const activeSubCount = subwoofers ? subwoofers.filter(s => s.active !== false).length : 0;
  const activeSpeakerCount = speakers ? speakers.filter(s => s.active !== false).length : 2;

  let powerDensityPerCubicMeter = 0.8; 
  let crestFactorNote = 'Headroom dinámico estándar de 3dB';

  if (sourceProfile === 'percussion' || sourceProfile === 'live_band') {
    powerDensityPerCubicMeter = 1.4;
    crestFactorNote = 'Headroom de 9dB para transitorios violentos (Evita clipping en bombo)';
  } else if (sourceProfile === 'edm' || sourceProfile === 'electronic') {
    powerDensityPerCubicMeter = 1.6;
    crestFactorNote = 'Headroom de 6dB para compresión de música electrónica';
  } else if (sourceProfile === 'speech') {
    powerDensityPerCubicMeter = 0.3;
    crestFactorNote = 'Headroom bajo optimizado para voz hablada';
  }

  const rawCalculatedRms = (volume * powerDensityPerCubicMeter) + (audience * 3.0);
  const multiplier = (sourceProfile === 'percussion' || sourceProfile === 'live_band') ? 2.5 : 1.8;
  const calculatedRequiredRms = Math.max(1200, Math.round(rawCalculatedRms * multiplier));

  const suggestedTilt = Math.min(15, Math.max(3, Math.round(venue.length / 3)));
  const needsDelays = venue.length > 25;

  let freqResponse = '55 Hz - 18,000 Hz (Full-Range estándar)';
  if (sourceProfile === 'edm' || sourceProfile === 'electronic') {
    freqResponse = '35 Hz - 20,000 Hz (Respuesta extendida en sub-graves)';
  } else if (sourceProfile === 'speech') {
    freqResponse = '80 Hz - 16,000 Hz (Corte de graves enfocado en inteligibilidad vocal)';
  } else if (sourceProfile === 'percussion' || sourceProfile === 'live_band') {
    freqResponse = '40 Hz - 18,000 Hz (Optimizado para pegada de transitorios)';
  }

  const dcDistance = parseFloat((0.14 * Math.sqrt(volume / Math.max(0.1, rt60))).toFixed(1));
  
  let c50Clarity = '+3 dB (Excelente inteligibilidad)';
  if (rt60 > 2.0) c50Clarity = '-3 dB / Pobre (Campo reverberante dominante)';
  else if (rt60 > 1.2) c50Clarity = '0 dB / Moderado (Aceptable para música)';

  // ADVERTENCIA FÍSICA DE GEOMETRÍA CÓNCAVA (EFECTO PALENQUE)
  let absorptionSuggestion = 'Superficies con coeficiente de absorción adecuado para el espacio';
  if (venue.shape === 'circle') {
    absorptionSuggestion = `⚠️ ALERTA DE GEOMETRÍA CÓNCAVA (Palenque): Focalización acústica severa en el centro geométrico (Punto Focal $F=${(venue.width/4).toFixed(1)}m$). Se exige la colocación de difusores poli-cilíndricos o paneles fonoabsorbentes trampa en el perímetro curvo para romper ondas estacionarias radiales.`;
  } else if (venue.shape === 'fan') {
    absorptionSuggestion = 'Geometría en abanico: Paredes laterales divergentes reducen ecos flotantes paralelos. Se recomienda tratamiento en el muro posterior para evitar reflexiones directas al escenario.';
  } else if (rt60 > 1.5) {
    const targetRt60 = sourceProfile === 'speech' ? 0.8 : 1.2;
    const currentSabins = (0.161 * volume) / rt60;
    const targetSabins = (0.161 * volume) / targetRt60;
    const missingSabins = Math.max(0, targetSabins - currentSabins);
    const percentageNeeded = Math.min(100, ((missingSabins / surfaceArea) * 100)).toFixed(1);
    
    absorptionSuggestion = `Déficit acústico crítico: Tratar al menos el ${percentageNeeded}% (${missingSabins.toFixed(1)} Sabins métricos) con paneles fonoabsorbentes (NRC 0.85+)`;
  }

  const electroacoustics = [
    { label: 'Topología Recomendada', value: venue.shape === 'circle' ? `${activeSpeakerCount}x Arreglos distribuidos en 360° (Anillo Central)` : `${activeSpeakerCount}x Sistemas Principales Activos Balanceados` }
  ];

  if (activeSubCount > 0) {
    electroacoustics.push({
      label: 'Subwoofers Sugeridos',
      value: venue.shape === 'circle' ? `${activeSubCount}x Subwoofers en Arreglo Cardano/Gradient Central (Evita acoplamiento en arena)` : `${activeSubCount}x Subwoofers de 18" configurados en fase`
    });
  }

  electroacoustics.push(
    { label: 'Refuerzos (Delays)', value: needsDelays ? `Requerido: 2x Cajas de retardo alineadas a los ${Math.round(venue.length * 0.6)}m` : 'No se requieren líneas de retardo' },
    { label: 'Down-tilt Recomendado', value: `${suggestedTilt}° de inclinación hacia abajo para minimizar primeras reflexiones en muros` },
    { label: 'Respuesta en Frecuencia', value: freqResponse }
  );

  return {
    electroacoustics,
    amplification: [
      { label: 'Potencia Real Sugerida (Física)', value: `${calculatedRequiredRms} W RMS Totales (${crestFactorNote})` },
      { label: 'Relación Señal/Ruido', value: '≥ 105 dB (SNR para operación limpia sin piso de ruido)' },
      { label: 'Distorsión Armónica (THD)', value: '< 0.05% THD a potencia nominal (Clase D de alta eficiencia)' },
      { label: 'Procesamiento Digital (DSP)', value: 'Limitadores Brickwall, Filtros FIR, Alineación temporal y ecualización de muesca para modulos focales' }
    ],
    acoustics: [
      { label: 'Distancia Crítica (Dc)', value: `${dcDistance}m desde la fuente principal` },
      { label: 'Índice de Claridad C50/C80', value: c50Clarity },
      { label: 'Comportamiento de Geometría', value: absorptionSuggestion }
    ]
  };
}