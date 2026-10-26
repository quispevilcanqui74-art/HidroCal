/**
 * HidroCalc UNI — Núcleo de cálculo hidráulico
 * -------------------------------------------------------------
 * Criterios de diseño (referenciales, RNE IS.010 — Perú):
 *   Qprom = P · d / 86 400            [L/s]
 *   Qmd   = K1 · Qprom                [L/s]
 *   Qmh   = K2 · Qmd                  [L/s]
 *   Vd    = P · d / 1 000             [m³/día]
 *   Vt    = Vd · días de reserva      [m³]
 *   Vc    = %cisterna · Vt            [m³]
 *   Vte   = %tanque   · Vt            [m³]
 *   Qb    = Vc / (h · 3.6)            [L/s]
 *
 * Módulo puro: no toca el DOM. Se expone como window.HidroCalc.
 */
(function (global) {
  'use strict';

  var SEGUNDOS_POR_DIA = 86400;
  var M3_A_LITROS = 1000;

  /** Factores de conversión desde L/s. */
  var UNIDADES = {
    'L/s': { factor: 1, decimales: 3 },
    'm³/h': { factor: 3.6, decimales: 2 },
    'L/min': { factor: 60, decimales: 2 },
    'GPM': { factor: 15.8503231415, decimales: 2 }
  };

  var LIMITES = {
    poblacion: [1, 200000],
    dotacion: [5, 500],
    k1: [1, 3],
    k2: [1, 6],
    dias: [0.5, 7],
    horasBombeo: [1, 23],
    pctCisterna: [0, 100]
  };

  var ADVERTENCIAS = {
    dotacion: 'Dotación fuera del rango usual para universidades (25 – 50 L/persona/día).',
    qmh: 'Caudal máximo horario elevado: verifica el diámetro de la acometida y el medidor.',
    cisternaMin: 'El volumen de cisterna resulta menor a 1 m³, mínimo recomendado por el RNE IS.010.',
    tanqueMin: 'El volumen del tanque elevado resulta menor a 1 m³, mínimo recomendado por el RNE IS.010.',
    bombeo: 'Con más de 20 h de bombeo al día conviene evaluar un sistema hidroneumático.',
    sinTanque: 'No se considera tanque elevado: el sistema requiere equipo hidroneumático o abastecimiento directo.',
    reserva: 'Reserva mayor a 3 días: verifica el espacio disponible y la rotación del agua.'
  };

  /**
   * Convierte un valor del formulario a número (acepta coma decimal y espacios).
   * @returns {number} NaN si no es numérico.
   */
  function numero(valor) {
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : NaN;
    if (typeof valor !== 'string') return NaN;
    var limpio = valor.replace(/\s|%/g, '').replace(',', '.').trim();
    if (limpio === '') return NaN;
    var n = Number(limpio);
    return Number.isFinite(n) ? n : NaN;
  }

  function dentroDe(valor, rango) {
    return valor >= rango[0] && valor <= rango[1];
  }

  function formatear(valor, decimales) {
    if (!Number.isFinite(valor)) return '—';
    if (typeof decimales !== 'number') decimales = 2;
    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales
    }).format(valor);
  }

  function convertirCaudal(lps, unidad) {
    var u = UNIDADES[unidad] || UNIDADES['L/s'];
    return { valor: lps * u.factor, decimales: u.decimales };
  }

  /**
   * Valida el estado del formulario.
   * @returns {{ok: boolean, errores: Object, advertencias: string[]}}
   */
  function validar(entrada) {
    var errores = {};
    var advertencias = [];

    if (entrada.modo === 'detallado') {
      var filas = Array.isArray(entrada.desglose) ? entrada.desglose : [];
      var totalPersonas = 0;

      if (!filas.length) errores.desglose = 'Agrega al menos un tipo de usuario.';

      filas.forEach(function (fila, i) {
        var nombre = String(fila.tipo || '').trim() || 'Fila ' + (i + 1);
        var cantidad = numero(fila.cantidad);
        var dotacion = numero(fila.dotacion);

        if (!Number.isFinite(cantidad) || cantidad < 0 || cantidad > LIMITES.poblacion[1]) {
          errores['desglose-' + i + '-cantidad'] = nombre + ': cantidad inválida (0 – 200 000).';
        } else {
          totalPersonas += cantidad;
        }

        if (!Number.isFinite(dotacion) || !dentroDe(dotacion, LIMITES.dotacion)) {
          errores['desglose-' + i + '-dotacion'] =
            nombre + ': la dotación debe estar entre 5 y 500 L/persona/día.';
        }
      });

      if (filas.length && totalPersonas < 1) {
        errores.desglose = 'La población total debe ser mayor que cero.';
      }
    } else {
      var poblacion = numero(entrada.poblacion);
      var dot = numero(entrada.dotacion);

      if (!Number.isFinite(poblacion)) {
        errores.poblacion = 'Ingresa un número válido.';
      } else if (poblacion < LIMITES.poblacion[0]) {
        errores.poblacion = 'La población debe ser mayor que cero.';
      } else if (poblacion > LIMITES.poblacion[1]) {
        errores.poblacion = 'El máximo admitido es 200 000 personas.';
      }

      if (!Number.isFinite(dot)) {
        errores.dotacion = 'Ingresa un número válido.';
      } else if (!dentroDe(dot, LIMITES.dotacion)) {
        errores.dotacion = 'Usa una dotación entre 5 y 500 L/persona/día.';
      } else if (dot < 25 || dot > 50) {
        advertencias.push(ADVERTENCIAS.dotacion);
      }
    }

    var k1 = numero(entrada.k1);
    var k2 = numero(entrada.k2);
    var dias = numero(entrada.dias);
    var horas = numero(entrada.horasBombeo);
    var pct = numero(entrada.pctCisterna);

    if (!Number.isFinite(k1) || !dentroDe(k1, LIMITES.k1)) errores.k1 = 'K1 debe estar entre 1.0 y 3.0.';
    if (!Number.isFinite(k2) || !dentroDe(k2, LIMITES.k2)) errores.k2 = 'K2 debe estar entre 1.0 y 6.0.';
    if (!Number.isFinite(dias) || !dentroDe(dias, LIMITES.dias)) errores.dias = 'Usa entre 0.5 y 7 días.';
    if (!Number.isFinite(horas) || !dentroDe(horas, LIMITES.horasBombeo)) errores.horasBombeo = 'Usa entre 1 y 23 horas.';
    if (!Number.isFinite(pct) || !dentroDe(pct, LIMITES.pctCisterna)) errores.pctCisterna = 'Porcentaje inválido.';

    return { ok: Object.keys(errores).length === 0, errores: errores, advertencias: advertencias };
  }

  /** Dimensiones referenciales de cisterna (relación largo:ancho = 2:1). */
  function dimensionesCisterna(volumen) {
    if (!(volumen > 0)) return null;
    var altoUtil = 1.8;
    var relacion = 2;
    var area = volumen / altoUtil;
    var ancho = Math.sqrt(area / relacion);
    var largo = ancho * relacion;
    var redondear = function (x) { return Math.ceil(x * 20) / 20; };
    return {
      largo: redondear(largo),
      ancho: redondear(ancho),
      alto: altoUtil,
      bordeLibre: 0.30
    };
  }

  /** Redondeo comercial a múltiplos de 0.5 m³. */
  function volumenComercial(volumen) {
    if (!(volumen > 0)) return 0;
    return Math.max(1, Math.ceil(volumen * 2) / 2);
  }

  /**
   * Ejecuta el cálculo completo a partir del estado del formulario.
   * Devuelve siempre un objeto; `valido` indica si los datos son utilizables.
   */
  function calcular(entrada) {
    var validacion = validar(entrada);

    var filas = entrada.modo === 'detallado'
      ? (Array.isArray(entrada.desglose) ? entrada.desglose : []).map(function (f) {
        return {
          tipo: String(f.tipo || 'Sin nombre').trim(),
          cantidad: numero(f.cantidad) || 0,
          dotacion: numero(f.dotacion) || 0
        };
      })
      : [{
        tipo: 'Población total',
        cantidad: numero(entrada.poblacion) || 0,
        dotacion: numero(entrada.dotacion) || 0
      }];

    var poblacion = filas.reduce(function (suma, f) { return suma + f.cantidad; }, 0);
    var consumoL = filas.reduce(function (suma, f) { return suma + f.cantidad * f.dotacion; }, 0);
    var dotacion = poblacion > 0 ? consumoL / poblacion : 0;

    var k1 = numero(entrada.k1) || 0;
    var k2 = numero(entrada.k2) || 0;
    var dias = numero(entrada.dias) || 0;
    var horas = numero(entrada.horasBombeo) || 0;
    var pctCisterna = numero(entrada.pctCisterna);
    if (!Number.isFinite(pctCisterna)) pctCisterna = 75;
    var pctTanque = 100 - pctCisterna;

    var consumoM3 = consumoL / M3_A_LITROS;
    var qProm = consumoL / SEGUNDOS_POR_DIA;
    var qMd = qProm * k1;
    var qMh = qMd * k2;
    var volumenTotal = consumoM3 * dias;
    var volumenCisterna = volumenTotal * pctCisterna / 100;
    var volumenTanque = volumenTotal * pctTanque / 100;
    var qBombeo = horas > 0 && horas < 24 ? volumenCisterna / (horas * 3.6) : 0;

    var advertencias = validacion.advertencias.slice();
    if (validacion.ok) {
      if (qMh > 15) advertencias.push(ADVERTENCIAS.qmh);
      if (volumenCisterna > 0 && volumenCisterna < 1) advertencias.push(ADVERTENCIAS.cisternaMin);
      if (volumenTanque > 0 && volumenTanque < 1) advertencias.push(ADVERTENCIAS.tanqueMin);
      if (horas >= 20) advertencias.push(ADVERTENCIAS.bombeo);
      if (pctTanque === 0) advertencias.push(ADVERTENCIAS.sinTanque);
      if (dias > 3) advertencias.push(ADVERTENCIAS.reserva);
    }

    return {
      valido: validacion.ok,
      errores: validacion.errores,
      advertencias: advertencias,
      filas: filas,
      poblacion: poblacion,
      dotacion: dotacion,
      consumoL: consumoL,
      consumoM3: consumoM3,
      qProm: qProm,
      qMd: qMd,
      qMh: qMh,
      k1: k1,
      k2: k2,
      dias: dias,
      horasBombeo: horas,
      pctCisterna: pctCisterna,
      pctTanque: pctTanque,
      volumenTotal: volumenTotal,
      volumenCisterna: volumenCisterna,
      volumenTanque: volumenTanque,
      qBombeo: qBombeo,
      dimCisterna: dimensionesCisterna(volumenCisterna)
    };
  }

  global.HidroCalc = {
    UNIDADES: UNIDADES,
    LIMITES: LIMITES,
    numero: numero,
    formatear: formatear,
    convertirCaudal: convertirCaudal,
    validar: validar,
    calcular: calcular,
    volumenComercial: volumenComercial,
    dimensionesCisterna: dimensionesCisterna
  };
})(window);
