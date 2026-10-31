/**
 * Motor de Cálculo Eléctrico y Carga (Electrical Engine)
 */

/**
 * Calcula la demanda de corriente en Amperes, breakers necesarios y calibre de cable
 */
export function calculateElectricalLoad(speakers, subwoofers, voltage = 120) {
  let totalRmsWatts = 0;

  // Suma de potencia RMS de cajas principales
  speakers.forEach(spk => {
    if (spk.active) totalRmsWatts += (spk.rmsWatts || 0);
  });

  // Suma de potencia RMS de subwoofers
  subwoofers.forEach(sub => {
    if (sub.active) totalRmsWatts += (sub.rmsWatts || 0);
  });

  // Factor de cresta para audio profesional en vivo (~1/8 de potencia nominal para amplificadores Clase D)
  const continuousWatts = totalRmsWatts * 0.125;

  // P = V * I  =>  I = P / V
  const currentAmps = continuousWatts / voltage;

  // Carga máxima recomendada por breaker (80% de seguridad en breakers de 20A = 16A continuos)
  const maxSafeAmpsPerBreaker = 16;
  const breakersNeeded = Math.max(1, Math.ceil(currentAmps / maxSafeAmpsPerBreaker));

  // Recomendación de calibre de cable AWG
  let wireGauge = 'Calibre 14 AWG';
  if (currentAmps > 20) wireGauge = 'Calibre 10 AWG (Uso Rudo Industriales)';
  else if (currentAmps > 12) wireGauge = 'Calibre 12 AWG (Uso Rudo Estándar)';

  // Generador sugerido en kVA (Con margen de pico de seguridad x2.5)
  const generatorKva = ((totalRmsWatts * 0.5) / 1000) * 1.25;

  return {
    totalRmsWatts,
    continuousAmps: parseFloat(currentAmps.toFixed(1)),
    breakersNeeded,
    wireGauge,
    generatorKva: parseFloat(generatorKva.toFixed(1))
  };
}