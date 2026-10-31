/**
 * Calcula la carga eléctrica, consumo real y corriente necesaria basada en la potencia RMS total.
 * @param {number} totalRmsPower - Potencia RMS combinada de bocinas y subwoofers (Watts)
 * @param {number} voltage - Voltaje de la red eléctrica (por defecto 120V)
 * @param {number} efficiency - Eficiencia del amplificador (ej. 0.85 para 85% Clase D)
 * @returns {Object} Resultados del cálculo eléctrico y alertas de seguridad
 */
export function calculateElectricalLoad(totalRmsPower, voltage = 120, efficiency = 0.85) {
    // Evitar división por cero o valores negativos
    if (!totalRmsPower || totalRmsPower <= 0) {
        return {
            realPower: 0,
            currentAmps: 0,
            requiresDedicatedCircuit: false,
            warning: null
        };
    }

    // 1. Potencia real tomada de la red eléctrica (considerando pérdidas térmicas del amplificador)
    const realPower = totalRmsPower / efficiency;

    // 2. Cálculo de corriente usando la Ley de Ohm / Potencia: I = P / (V * Eficiencia)
    const currentAmps = realPower / voltage;

    // 3. Validación de seguridad para la infraestructura eléctrica (Umbral estándar de 15A)
    let requiresDedicatedCircuit = false;
    let warning = null;

    if (currentAmps >= 15) {
        requiresDedicatedCircuit = true;
        warning = `Atención: El sistema demanda ${currentAmps.toFixed(1)} A, superando el límite seguro de un circuito residencial estándar (15A). Se requiere un circuito eléctrico dedicado o alimentación trifásica.`;
    }

    return {
        realPower: parseFloat(realPower.toFixed(2)),       // Watts consumidos de la red
        currentAmps: parseFloat(currentAmps.toFixed(2)),   // Amperios reales
        requiresDedicatedCircuit,
        warning
    };
}