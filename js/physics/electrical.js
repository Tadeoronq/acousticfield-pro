/**
 * Módulo de Cálculos Eléctricos, Termodinámica y Ley de Ohm
 */

export function calculateElectricalLoad(speakers = [], subwoofers = [], voltage = 120, efficiency = 0.85, venue = null, sourceProfile = 'live_band', rt60 = 1.0) {
    let totalRmsPower = 0;

    // 1. Sumar la potencia RMS de las bocinas y subwoofers activos en el inventario
    if (Array.isArray(speakers)) {
        speakers.forEach(s => {
            if (s.active !== false) {
                totalRmsPower += parseFloat(s.rmsWatts || 500);
            }
        });
    }

    if (Array.isArray(subwoofers)) {
        subwoofers.forEach(sub => {
            if (sub.active !== false) {
                totalRmsPower += parseFloat(sub.rmsWatts || 1000);
            }
        });
    }

    // 2. CORRELACIÓN FÍSICA AUTOMÁTICA: Si hay un recinto definido, evaluamos la demanda real por volumen y crest factor
    if (venue) {
        const volume = venue.length * venue.width * (venue.height || 5);
        const audience = venue.audienceCount || 100;

        let powerDensity = 0.8;
        let crestMultiplier = 1.8;

        if (sourceProfile === 'percussion' || sourceProfile === 'live_band') {
            powerDensity = 1.4; // Alta densidad para percusiones y transitorios
            crestMultiplier = 2.5; // Factor de cresta estricto de 9dB
        } else if (sourceProfile === 'edm' || sourceProfile === 'electronic') {
            powerDensity = 1.6;
            crestMultiplier = 2.0;
        } else if (sourceProfile === 'speech') {
            powerDensity = 0.3;
            crestMultiplier = 1.2;
        }

        const calculatedDemand = Math.max(1200, Math.round(((volume * powerDensity) + (audience * 3.0)) * crestMultiplier));
        
        // El sistema eléctrico toma el valor mayor entre el inventario manual y la exigencia física calculada del recinto
        totalRmsPower = Math.max(totalRmsPower, calculatedDemand);
    }

    const safeVoltage = voltage > 0 ? voltage : 120;
    const safeEfficiency = efficiency > 0 ? efficiency : 0.85;

    // 3. Conservación de la energía y Ley de Ohm (I = P_real / V)
    const realPower = totalRmsPower / safeEfficiency;
    const currentAmps = realPower / safeVoltage;

    // 4. Dimensionamiento de protecciones eléctricas e infraestructura
    const breakersNeeded = Math.max(1, Math.ceil(currentAmps / 16));
    
    let wireGauge = '12 AWG (Residencial estándar)';
    if (currentAmps >= 15 && currentAmps < 25) {
        wireGauge = '10 AWG (Circuito Dedicado Recomendado)';
    } else if (currentAmps >= 25) {
        wireGauge = '8 AWG o Alimentación Bifásica / Trifásica Requerida';
    }

    return {
        totalRmsPower: parseFloat(totalRmsPower.toFixed(2)),
        realPower: parseFloat(realPower.toFixed(2)),
        continuousAmps: parseFloat(currentAmps.toFixed(1)),
        breakersNeeded,
        wireGauge,
        requiresDedicatedCircuit: currentAmps >= 15
    };
}