/**
 * Módulo de Cálculos Eléctricos, Termodinámica y Ley de Ohm
 */

export function calculateElectricalLoad(speakers = [], subwoofers = [], voltage = 120, efficiency = 0.85) {
    let totalRmsPower = 0;

    // 1. Sumar la potencia RMS de todas las bocinas activas
    if (Array.isArray(speakers)) {
        speakers.forEach(s => {
            if (s.active !== false) {
                totalRmsPower += parseFloat(s.rmsWatts || 500);
            }
        });
    }

    // 2. Sumar la potencia RMS de todos los subwoofers activos
    if (Array.isArray(subwoofers)) {
        subwoofers.forEach(sub => {
            if (sub.active !== false) {
                totalRmsPower += parseFloat(sub.rmsWatts || 1000);
            }
        });
    }

    // Valores seguros para evitar divisiones por cero o nulos
    const safeVoltage = voltage > 0 ? voltage : 120;
    const safeEfficiency = efficiency > 0 ? efficiency : 0.85;

    // 3. Conservación de la energía: Potencia real tomada de la red considerando eficiencia del amplificador
    const realPower = totalRmsPower / safeEfficiency;

    // 4. Aplicación de la Ley de Ohm / Potencia: I = P_real / Voltaje
    const currentAmps = realPower / safeVoltage;

    // 5. Cálculos de infraestructura y protecciones (Breakers y Calibre de cable)
    const breakersNeeded = Math.max(1, Math.ceil(currentAmps / 16));
    
    let wireGauge = '12 AWG (Residencial estándar)';
    if (currentAmps >= 15) {
        wireGauge = '10 AWG (Circuito Dedicado Requerido)';
    }
    if (currentAmps >= 30) {
        wireGauge = '8 AWG o Alimentación Trifásica';
    }

    return {
        totalRmsPower: parseFloat(totalRmsPower.toFixed(2)),
        realPower: parseFloat(realPower.toFixed(2)),
        continuousAmps: parseFloat(currentAmps.toFixed(1)), // Retorna un número limpio en Amperios (evita el undefined)
        breakersNeeded,
        wireGauge,
        requiresDedicatedCircuit: currentAmps >= 15
    };
}