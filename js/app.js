/**
 * HidroCalc UNI — Interfaz de usuario
 * -------------------------------------------------------------
 * Responsabilidades:
 *  - Mantener el estado del formulario y persistirlo en localStorage.
 *  - Validar en tiempo real y pintar los mensajes de error.
 *  - Renderizar KPIs, gráficos, tarjetas de almacenamiento, tabla
 *    interactiva (orden, búsqueda, unidades, copiado) y memoria de cálculo.
 */
(function () {
  'use strict';

  var HC = window.HidroCalc;
  var PREFIJO = 'hidrocalc.';

  var POBLACION_MAX = 200000;

  var ESTADO_INICIAL = {
    modo: 'simple',
    poblacion: 1200,
    dotacion: 25,
    desglose: [
      { tipo: 'Estudiantes', cantidad: 9500, dotacion: 25 },
      { tipo: 'Docentes', cantidad: 700, dotacion: 50 },
      { tipo: 'Personal administrativo', cantidad: 300, dotacion: 50 }
    ],
    k1: 1.3,
    k2: 2,
    dias: 1,
    pctCisterna: 75,
    horasBombeo: 6,
    unidad: 'L/s',
    orden: { campo: null, dir: 1 },
    busqueda: ''
  };

  var estado = clonar(ESTADO_INICIAL);
  var resultado = null;
  var filas = [];
  var temporizadorGuardado = null;

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */

  function $(selector, contexto) {
    return (contexto || document).querySelector(selector);
  }

  function $$(selector, contexto) {
    return Array.prototype.slice.call((contexto || document).querySelectorAll(selector));
  }

  function clonar(objeto) {
    return JSON.parse(JSON.stringify(objeto));
  }

  function escaparHtml(texto) {
    return String(texto === undefined || texto === null ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatear(valor, decimales) {
    return HC.formatear(valor, decimales);
  }

  function unidadActual() {
    return HC.UNIDADES[estado.unidad] || HC.UNIDADES['L/s'];
  }

  function caudal(lps) {
    var u = unidadActual();
    return { valor: lps * u.factor, decimales: u.decimales };
  }

  function textoDias(valor) {
    var decimales = valor % 1 === 0 ? 0 : 1;
    return formatear(valor, decimales) + (valor === 1 ? ' día' : ' días');
  }

  function avisar(mensaje, tipo) {
    var contenedor = $('#toasts');
    if (!contenedor) return;

    var icono = tipo === 'error'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4 shrink-0"><path d="M12 8v4.5M12 16h.01" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="h-4 w-4 shrink-0"><path d="m5 12.5 4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    var elemento = document.createElement('div');
    elemento.className = 'toast pointer-events-auto flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold shadow-lg shadow-slate-900/20 ' +
      (tipo === 'error'
        ? 'bg-rose-600 text-white'
        : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900');
    elemento.innerHTML = icono + '<span>' + escaparHtml(mensaje) + '</span>';
    contenedor.appendChild(elemento);

    setTimeout(function () {
      elemento.classList.add('saliendo');
      setTimeout(function () {
        if (elemento.parentNode) elemento.parentNode.removeChild(elemento);
      }, 220);
    }, 2400);
  }

  function copiar(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texto).catch(function () {
        return copiarFallback(texto);
      });
    }
    return copiarFallback(texto);
  }

  function copiarFallback(texto) {
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = texto;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '-1000px';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy') ? resolve() : reject(new Error('No se pudo copiar'));
      } catch (error) {
        reject(error);
      } finally {
        document.body.removeChild(area);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Persistencia                                                        */
  /* ------------------------------------------------------------------ */

  function cargarEstado() {
    try {
      var guardado = JSON.parse(localStorage.getItem(PREFIJO + 'estado') || 'null');
      if (!guardado || typeof guardado !== 'object') return;

      estado = Object.assign(clonar(ESTADO_INICIAL), guardado);
      estado.orden = Object.assign({ campo: null, dir: 1 }, guardado.orden || {});
      if (!Array.isArray(estado.desglose) || !estado.desglose.length) {
        estado.desglose = clonar(ESTADO_INICIAL.desglose);
      }
      if (estado.modo !== 'detallado') estado.modo = 'simple';
      if (!HC.UNIDADES[estado.unidad]) estado.unidad = 'L/s';
      if (typeof estado.busqueda !== 'string') estado.busqueda = '';
    } catch (error) {
      estado = clonar(ESTADO_INICIAL);
    }
  }

  function guardarEstado() {
    clearTimeout(temporizadorGuardado);
    temporizadorGuardado = setTimeout(function () {
      try {
        localStorage.setItem(PREFIJO + 'estado', JSON.stringify(estado));
      } catch (error) { /* almacenamiento no disponible */ }
    }, 400);
  }

  /* ------------------------------------------------------------------ */
  /* Sincronización estado <-> formulario                                */
  /* ------------------------------------------------------------------ */

  function asignarValor(id, valor) {
    var campo = document.getElementById(id);
    if (campo) campo.value = valor;
  }

  function aplicarEstado() {
    asignarValor('poblacion', estado.poblacion);
    asignarValor('dotacion', estado.dotacion);
    asignarValor('k1', estado.k1);
    asignarValor('k2', estado.k2);
    asignarValor('dias', estado.dias);
    asignarValor('horasBombeo', estado.horasBombeo);
    asignarValor('pctCisterna', estado.pctCisterna);
    asignarValor('unidad', estado.unidad);
    asignarValor('buscar', estado.busqueda);

    pintarModo();
    pintarDesglose();
    pintarControles();
  }

  function leerFormulario() {
    estado.poblacion = $('#poblacion').value;
    estado.dotacion = $('#dotacion').value;
    estado.k1 = $('#k1').value;
    estado.k2 = $('#k2').value;
    estado.dias = $('#dias').value;
    estado.horasBombeo = $('#horasBombeo').value;
    estado.pctCisterna = $('#pctCisterna').value;
  }

  function pintarModo() {
    $$('[data-modo]').forEach(function (boton) {
      boton.setAttribute('aria-selected', String(boton.getAttribute('data-modo') === estado.modo));
    });
    $('#panel-simple').classList.toggle('hidden', estado.modo !== 'simple');
    $('#panel-detallado').classList.toggle('hidden', estado.modo !== 'detallado');
  }

  function pintarControles() {
    var k1 = $('#k1');
    var k2 = $('#k2');
    var pct = $('#pctCisterna');

    $('#k1-out').textContent = formatear(Number(k1.value), 2);
    $('#k2-out').textContent = formatear(Number(k2.value), 2);

    pintarPista(k1);
    pintarPista(k2);
    pintarPista(pct);

    var valorPct = Number(pct.value);
    $('#pct-cis-out').textContent = valorPct + '%';
    $('#pct-tan-out').textContent = (100 - valorPct) + '%';
  }

  function pintarPista(input) {
    var minimo = Number(input.min);
    var maximo = Number(input.max);
    var valor = Number(input.value);
    var porcentaje = maximo > minimo ? ((valor - minimo) / (maximo - minimo)) * 100 : 0;
    input.style.setProperty('--pct', porcentaje + '%');
  }

  function pintarDesglose() {
    var cuerpo = $('#tbody-desglose');
    if (!cuerpo) return;

    cuerpo.innerHTML = estado.desglose.map(function (fila, indice) {
      var unicaFila = estado.desglose.length <= 1;
      return '' +
        '<tr data-idx="' + indice + '" class="border-b border-slate-100 last:border-0 dark:border-slate-800">' +
          '<td class="px-2 py-1.5"><input data-campo="tipo" type="text" maxlength="32" class="field-tabla" value="' + escaparHtml(fila.tipo) + '" aria-label="Tipo de usuario" /></td>' +
          '<td class="px-2 py-1.5"><input data-campo="cantidad" type="number" inputmode="numeric" min="0" max="' + POBLACION_MAX + '" step="10" class="field-tabla text-right" value="' + escaparHtml(fila.cantidad) + '" aria-label="Cantidad de personas" /></td>' +
          '<td class="px-2 py-1.5"><input data-campo="dotacion" type="number" inputmode="decimal" min="5" max="500" step="5" class="field-tabla text-right" value="' + escaparHtml(fila.dotacion) + '" aria-label="Dotación en litros por persona por día" /></td>' +
          '<td class="px-1 py-1.5 text-right">' +
            '<button type="button" data-accion="eliminar" class="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-rose-500/10" title="Eliminar fila"' + (unicaFila ? ' disabled' : '') + '>' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5"><path d="M5 7h14M9.5 7V5.5h5V7M7 7l.8 12h8.4L17 7" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</button>' +
          '</td>' +
        '</tr>';
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Render de resultados                                                */
  /* ------------------------------------------------------------------ */

  function recalcular() {
    resultado = HC.calcular(estado);
    pintarControles();
    pintarValidacion();
    pintarEstadoCalculo();
    pintarKPIs();
    pintarCaudales();
    pintarDonut();
    pintarAlmacenamiento();
    pintarTabla();
    pintarMemoria();
    pintarAdvertencias();
    pintarTotalesDesglose();
    guardarEstado();
  }

  function pintarValidacion() {
    $$('[data-error]').forEach(function (parrafo) {
      parrafo.textContent = '';
      parrafo.classList.add('hidden');
    });
    $$('[aria-invalid]').forEach(function (campo) {
      campo.removeAttribute('aria-invalid');
    });

    Object.keys(resultado.errores).forEach(function (clave) {
      var mensaje = resultado.errores[clave];

      var parrafo = document.querySelector('[data-error="' + clave + '"]');
      if (parrafo) {
        parrafo.textContent = mensaje;
        parrafo.classList.remove('hidden');
      }

      var campo = document.getElementById(clave);
      if (!campo && clave.indexOf('desglose-') === 0) {
        var partes = clave.split('-');
        campo = document.querySelector('#tbody-desglose tr[data-idx="' + partes[1] + '"] [data-campo="' + partes[2] + '"]');
      }
      if (campo) campo.setAttribute('aria-invalid', 'true');
    });

    $('#aviso-invalido').classList.toggle('hidden', resultado.valido);
  }

  function pintarEstadoCalculo() {
    var chip = $('#estado-calculo');
    chip.classList.remove('estado-ok', 'estado-alerta');
    chip.classList.add(resultado.valido ? 'estado-ok' : 'estado-alerta');
    chip.innerHTML = '<span class="h-1.5 w-1.5 rounded-full bg-current"></span> ' +
      (resultado.valido ? 'Cálculo actualizado' : 'Revisar datos');
  }

  function pintarKPIs() {
    var u = unidadActual();
    var valores = [resultado.qProm, resultado.qMd, resultado.qMh];
    var ids = ['kpi-qprom', 'kpi-qmd', 'kpi-qmh'];

    ids.forEach(function (id, i) {
      document.getElementById(id).textContent = resultado.valido ? formatear(valores[i] * u.factor, u.decimales) : '—';
      document.getElementById(id + '-u').textContent = estado.unidad;
    });

    $('#kpi-vtotal').textContent = resultado.valido ? formatear(resultado.volumenTotal, 2) : '—';
    $('#kpi-vtotal-u').textContent = 'm³';
  }

  function pintarCaudales() {
    var contenedor = $('#chart-caudales');
    if (!resultado.valido) {
      contenedor.innerHTML = '<p class="py-6 text-center text-[11.5px] text-slate-400 dark:text-slate-500">Sin datos válidos para graficar</p>';
      return;
    }

    var u = unidadActual();
    var series = [
      { nombre: 'Qprom', valor: resultado.qProm, color: 'linear-gradient(90deg,#a5f3fc,#06b6d4)' },
      { nombre: 'Qmd', valor: resultado.qMd, color: 'linear-gradient(90deg,#22d3ee,#0891b2)' },
      { nombre: 'Qmh', valor: resultado.qMh, color: 'linear-gradient(90deg,#0e7490,#155e75)' }
    ];
    var maximo = Math.max(series[0].valor, series[1].valor, series[2].valor) || 1;

    contenedor.innerHTML = series.map(function (serie) {
      var ancho = Math.max(4, (serie.valor / maximo) * 100);
      return '' +
        '<div>' +
          '<div class="mb-1.5 flex items-baseline justify-between gap-2 text-[11.5px]">' +
            '<span class="font-semibold text-slate-600 dark:text-slate-300">' + serie.nombre + '</span>' +
            '<span class="font-mono font-bold tabular-nums text-slate-900 dark:text-white">' + formatear(serie.valor * u.factor, u.decimales) +
              ' <span class="font-sans text-[10px] font-medium text-slate-400">' + estado.unidad + '</span></span>' +
          '</div>' +
          '<div class="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">' +
            '<div class="h-full rounded-full transition-all duration-500" style="width:' + ancho + '%;background:' + serie.color + '"></div>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  function pintarDonut() {
    var donut = $('#donut');
    if (!resultado.valido) {
      donut.style.background = 'conic-gradient(#e2e8f0 0 100%)';
      $('#donut-centro').textContent = '—';
      $('#legend-cisterna').textContent = '—';
      $('#legend-tanque').textContent = '—';
      $('#legend-nota').textContent = 'Sin datos válidos';
      return;
    }

    var pct = resultado.pctCisterna;
    donut.style.background = 'conic-gradient(#0891b2 0 ' + pct + '%, #f59e0b ' + pct + '% 100%)';
    $('#donut-centro').textContent = formatear(resultado.volumenTotal, 1);
    $('#legend-cisterna').textContent = formatear(resultado.volumenCisterna, 2) + ' m³';
    $('#legend-tanque').textContent = formatear(resultado.volumenTanque, 2) + ' m³';
    $('#legend-nota').textContent = 'Reserva de ' + textoDias(resultado.dias) + ' · reparto ' + pct + '/' + (100 - pct);
  }

  function pintarAlmacenamiento() {
    var u = unidadActual();
    var valido = resultado.valido;

    $('#res-cisterna').textContent = valido ? formatear(resultado.volumenCisterna, 2) : '—';
    $('#res-cisterna-pct').textContent = '(' + resultado.pctCisterna + '% del volumen total)';
    $('#res-cisterna-com').textContent = valido ? formatear(HC.volumenComercial(resultado.volumenCisterna), 1) + ' m³' : '—';

    var dim = resultado.dimCisterna;
    $('#res-cisterna-dim').textContent = valido && dim
      ? 'Referencial: ' + formatear(dim.largo, 2) + ' × ' + formatear(dim.ancho, 2) + ' × ' + formatear(dim.alto, 2) +
        ' m (largo × ancho × alto útil) + ' + formatear(dim.bordeLibre, 2) + ' m de borde libre.'
      : 'Ingresa los datos para estimar las dimensiones.';

    $('#res-tanque').textContent = valido ? formatear(resultado.volumenTanque, 2) : '—';
    $('#res-tanque-pct').textContent = '(' + resultado.pctTanque + '% del volumen total)';
    $('#res-tanque-com').textContent = valido ? formatear(HC.volumenComercial(resultado.volumenTanque), 1) + ' m³' : '—';
    $('#res-bombeo').textContent = valido
      ? formatear(resultado.qBombeo * u.factor, u.decimales) + ' ' + estado.unidad
      : '—';
  }

  function construirFilas() {
    var u = unidadActual();
    var r = resultado;
    var convertir = function (lps) { return lps * u.factor; };
    var decimales = u.decimales;

    return [
      { id: 'poblacion', concepto: 'Población total', simbolo: 'P', expresion: 'Σ población', valor: r.poblacion, decimales: 0, unidad: 'personas' },
      { id: 'dotacion', concepto: 'Dotación equivalente', simbolo: 'd', expresion: 'Σ(Pᵢ · dᵢ) / P', valor: r.dotacion, decimales: 2, unidad: 'L/persona·día' },
      { id: 'consumo', concepto: 'Consumo diario', simbolo: 'Vd', expresion: 'P · d / 1 000', valor: r.consumoM3, decimales: 2, unidad: 'm³/día' },
      { id: 'qprom', concepto: 'Caudal promedio', simbolo: 'Qprom', expresion: 'P · d / 86 400', valor: convertir(r.qProm), decimales: decimales, unidad: estado.unidad },
      { id: 'qmd', concepto: 'Caudal máximo diario', simbolo: 'Qmd', expresion: 'K1 · Qprom (K1 = ' + formatear(r.k1, 2) + ')', valor: convertir(r.qMd), decimales: decimales, unidad: estado.unidad },
      { id: 'qmh', concepto: 'Caudal máximo horario', simbolo: 'Qmh', expresion: 'K2 · Qmd (K2 = ' + formatear(r.k2, 2) + ')', valor: convertir(r.qMh), decimales: decimales, unidad: estado.unidad },
      { id: 'qbombeo', concepto: 'Caudal de bombeo', simbolo: 'Qb', expresion: 'Vc / (' + formatear(r.horasBombeo, 0) + ' h × 3.6)', valor: convertir(r.qBombeo), decimales: decimales, unidad: estado.unidad },
      { id: 'vcisterna', concepto: 'Volumen de cisterna', simbolo: 'Vc', expresion: formatear(r.pctCisterna, 0) + '% · Vt', valor: r.volumenCisterna, decimales: 2, unidad: 'm³' },
      { id: 'vtanque', concepto: 'Volumen de tanque elevado', simbolo: 'Vte', expresion: formatear(r.pctTanque, 0) + '% · Vt', valor: r.volumenTanque, decimales: 2, unidad: 'm³' },
      { id: 'vtotal', concepto: 'Volumen total de almacenamiento', simbolo: 'Vt', expresion: 'Vd × ' + textoDias(r.dias), valor: r.volumenTotal, decimales: 2, unidad: 'm³' }
    ];
  }

  function filtrarYOrdenar(lista) {
    var busqueda = String(estado.busqueda || '').trim().toLowerCase();
    var salida = lista.slice();

    if (busqueda) {
      salida = salida.filter(function (fila) {
        var texto = (fila.concepto + ' ' + fila.simbolo + ' ' + fila.expresion + ' ' + fila.unidad).toLowerCase();
        return texto.indexOf(busqueda) !== -1;
      });
    }

    var campo = estado.orden.campo;
    if (campo) {
      salida.sort(function (a, b) {
        var comparacion = campo === 'valor'
          ? a.valor - b.valor
          : String(a[campo]).localeCompare(String(b[campo]), 'es');
        return comparacion * estado.orden.dir;
      });
    }

    return salida;
  }

  function pintarTabla() {
    var cuerpo = $('#tbody-resumen');
    filas = resultado.valido ? construirFilas() : [];

    var visibles = filtrarYOrdenar(filas);
    if (!visibles.length) {
      cuerpo.innerHTML = '<tr><td colspan="5" class="px-4 py-10 text-center text-[12.5px] text-slate-400 dark:text-slate-500">' +
        (resultado.valido ? 'Ninguna fila coincide con la búsqueda.' : 'Completa los datos para generar el resumen.') +
        '</td></tr>';
    } else {
      cuerpo.innerHTML = visibles.map(function (fila) {
        return '' +
          '<tr class="table-row" data-fila="' + fila.id + '" tabindex="0" role="button" aria-label="Copiar ' + escaparHtml(fila.concepto) + '">' +
            '<td class="td pl-4 font-medium text-slate-800 dark:text-slate-100">' + fila.concepto + '</td>' +
            '<td class="td"><span class="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-brand-700 dark:bg-slate-800 dark:text-brand-300">' + fila.simbolo + '</span></td>' +
            '<td class="td font-mono text-[11px] text-slate-500 dark:text-slate-400">' + fila.expresion + '</td>' +
            '<td class="td text-right font-mono text-[13px] font-bold tabular-nums text-slate-900 dark:text-white">' + formatear(fila.valor, fila.decimales) + '</td>' +
            '<td class="td pr-4 text-[11px] text-slate-500 dark:text-slate-400">' + fila.unidad + '</td>' +
          '</tr>';
      }).join('');
    }

    pintarFlechas();
  }

  function pintarFlechas() {
    $$('.th-orden').forEach(function (th) {
      var campo = th.getAttribute('data-orden');
      var activo = estado.orden.campo === campo;
      var flecha = th.querySelector('[data-flecha]');
      if (flecha) {
        flecha.textContent = activo ? (estado.orden.dir === 1 ? '▲' : '▼') : '';
        flecha.className = 'ml-1 text-[9px] ' + (activo ? 'text-brand-600 dark:text-brand-400' : 'text-slate-300 dark:text-slate-600');
      }
      if (activo) {
        th.setAttribute('aria-sort', estado.orden.dir === 1 ? 'ascending' : 'descending');
      } else {
        th.removeAttribute('aria-sort');
      }
    });
  }

  function pintarMemoria() {
    var contenedor = $('#memoria');
    if (!resultado.valido) {
      contenedor.innerHTML = '<p class="text-[11.5px] text-slate-400 dark:text-slate-500">Completa los datos para ver la memoria de cálculo.</p>';
      return;
    }

    var r = resultado;
    var f = formatear;
    var resaltado = 'text-brand-700 dark:text-brand-300';

    var lineas = [
      ['Qprom', 'Q<sub>prom</sub> = (P × d) / 86 400 = (' + f(r.poblacion, 0) + ' × ' + f(r.dotacion, 2) + ') / 86 400 = <b class="' + resaltado + '">' + f(r.qProm, 3) + ' L/s</b>'],
      ['Qmd', 'Q<sub>md</sub> = K1 × Q<sub>prom</sub> = ' + f(r.k1, 2) + ' × ' + f(r.qProm, 3) + ' = <b class="' + resaltado + '">' + f(r.qMd, 3) + ' L/s</b>'],
      ['Qmh', 'Q<sub>mh</sub> = K2 × Q<sub>md</sub> = ' + f(r.k2, 2) + ' × ' + f(r.qMd, 3) + ' = <b class="' + resaltado + '">' + f(r.qMh, 3) + ' L/s</b>'],
      ['Vd', 'V<sub>d</sub> = P × d / 1 000 = (' + f(r.poblacion, 0) + ' × ' + f(r.dotacion, 2) + ') / 1 000 = <b class="' + resaltado + '">' + f(r.consumoM3, 2) + ' m³/día</b>'],
      ['Vt', 'V<sub>t</sub> = V<sub>d</sub> × días = ' + f(r.consumoM3, 2) + ' × ' + f(r.dias, 2) + ' = <b class="' + resaltado + '">' + f(r.volumenTotal, 2) + ' m³</b>'],
      ['Vc', 'V<sub>c</sub> = ' + f(r.pctCisterna, 0) + '% × V<sub>t</sub> = <b class="' + resaltado + '">' + f(r.volumenCisterna, 2) + ' m³</b>'],
      ['Vte', 'V<sub>te</sub> = ' + f(r.pctTanque, 0) + '% × V<sub>t</sub> = <b class="' + resaltado + '">' + f(r.volumenTanque, 2) + ' m³</b>'],
      ['Qb', 'Q<sub>b</sub> = V<sub>c</sub> / (h × 3.6) = ' + f(r.volumenCisterna, 2) + ' / (' + f(r.horasBombeo, 0) + ' × 3.6) = <b class="' + resaltado + '">' + f(r.qBombeo, 3) + ' L/s</b>']
    ];

    contenedor.innerHTML = lineas.map(function (linea) {
      return '<div class="flex gap-2"><span class="w-12 shrink-0 font-semibold text-slate-400 dark:text-slate-500">' + linea[0] + '</span><span class="min-w-0">' + linea[1] + '</span></div>';
    }).join('') +
      '<p class="border-t border-dashed border-slate-200 pt-2.5 text-[11px] text-slate-400 dark:border-slate-800">Los caudales se expresan en L/s; la tabla permite cambiar de unidad al instante.</p>';
  }

  function pintarAdvertencias() {
    var contenedor = $('#advertencias');
    var lista = $('#lista-advertencias');

    if (!resultado.valido || !resultado.advertencias.length) {
      contenedor.classList.add('hidden');
      lista.innerHTML = '';
      return;
    }

    contenedor.classList.remove('hidden');
    lista.innerHTML = resultado.advertencias.map(function (texto) {
      return '<li>' + escaparHtml(texto) + '</li>';
    }).join('');
  }

  function pintarTotalesDesglose() {
    $('#desglose-poblacion').textContent = resultado.poblacion > 0
      ? formatear(resultado.poblacion, 0) + ' pers.'
      : '—';
    $('#desglose-dotacion').textContent = resultado.dotacion > 0
      ? formatear(resultado.dotacion, 2) + ' L/persona·día'
      : '—';
  }

  /* ------------------------------------------------------------------ */
  /* Acciones                                                            */
  /* ------------------------------------------------------------------ */

  function copiarFila(id) {
    var fila = filas.filter(function (f) { return f.id === id; })[0];
    if (!fila) return;

    var texto = fila.concepto + ': ' + formatear(fila.valor, fila.decimales) + ' ' + fila.unidad;
    copiar(texto).then(function () {
      avisar('Copiado: ' + texto);
    }).catch(function () {
      avisar('No se pudo copiar al portapapeles', 'error');
    });
  }

  function exportarCSV() {
    if (!resultado.valido) {
      avisar('Completa los datos antes de exportar', 'error');
      return;
    }

    var visibles = filtrarYOrdenar(filas);
    var lineas = [['Concepto', 'Simbolo', 'Expresion', 'Valor', 'Unidad']];

    visibles.forEach(function (fila) {
      lineas.push([fila.concepto, fila.simbolo, fila.expresion, formatear(fila.valor, fila.decimales), fila.unidad]);
    });

    var csv = '\uFEFF' + lineas.map(function (linea) {
      return linea.map(function (celda) {
        return '"' + String(celda).replace(/"/g, '""') + '"';
      }).join(';');
    }).join('\r\n');

    var enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    enlace.download = 'hidrocalc-resumen.csv';
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    setTimeout(function () { URL.revokeObjectURL(enlace.href); }, 1500);

    avisar('Resumen exportado (' + visibles.length + ' filas)');
  }

  function cargarEjemplo() {
    estado = Object.assign(clonar(ESTADO_INICIAL), {
      modo: 'detallado',
      desglose: [
        { tipo: 'Estudiantes', cantidad: 9500, dotacion: 25 },
        { tipo: 'Docentes', cantidad: 700, dotacion: 50 },
        { tipo: 'Personal administrativo', cantidad: 300, dotacion: 50 }
      ],
      k1: 1.3,
      k2: 2,
      dias: 1,
      pctCisterna: 75,
      horasBombeo: 6
    });
    estado.orden = { campo: null, dir: 1 };
    estado.busqueda = '';
    aplicarEstado();
    recalcular();
    avisar('Caso de ejemplo cargado');
  }

  function reiniciar() {
    estado = clonar(ESTADO_INICIAL);
    estado.orden = { campo: null, dir: 1 };
    estado.busqueda = '';
    aplicarEstado();
    recalcular();
    avisar('Datos restablecidos');
  }

  function imprimir() {
    // En el APK se delega en el servicio de impresión de Android (permite "Guardar como PDF").
    var puente = window.HidroCalcAndroid;
    if (puente && typeof puente.imprimir === 'function') {
      try {
        puente.imprimir();
        return;
      } catch (error) { /* continúa con la impresión del navegador */ }
    }

    var teniaOscuro = document.documentElement.classList.contains('dark');
    if (teniaOscuro) document.documentElement.classList.remove('dark');

    var restaurar = function () {
      if (teniaOscuro) document.documentElement.classList.add('dark');
      window.removeEventListener('afterprint', restaurar);
    };
    window.addEventListener('afterprint', restaurar);
    window.print();
  }

  function alternarTema() {
    var oscuro = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem(PREFIJO + 'tema', oscuro ? 'dark' : 'light');
    } catch (error) { /* sin almacenamiento */ }
    $('#btn-tema').setAttribute('aria-pressed', String(oscuro));
  }

  /* ------------------------------------------------------------------ */
  /* Eventos                                                             */
  /* ------------------------------------------------------------------ */

  function enlazarEventos() {
    ['poblacion', 'dotacion', 'dias', 'horasBombeo', 'k1', 'k2', 'pctCisterna'].forEach(function (id) {
      var campo = document.getElementById(id);
      if (!campo) return;
      campo.addEventListener('input', function () {
        leerFormulario();
        pintarControles();
        recalcular();
      });
    });

    $('#chips-dotacion').addEventListener('click', function (evento) {
      var boton = evento.target.closest('[data-dotacion]');
      if (!boton) return;
      var dotacion = $('#dotacion');
      dotacion.value = boton.getAttribute('data-dotacion');
      dotacion.dispatchEvent(new Event('input', { bubbles: true }));
    });

    $$('[data-modo]').forEach(function (boton) {
      boton.addEventListener('click', function () {
        estado.modo = boton.getAttribute('data-modo');
        pintarModo();
        recalcular();
      });
    });

    $('#tbody-desglose').addEventListener('input', function (evento) {
      var campo = evento.target.closest('[data-campo]');
      if (!campo) return;
      var indice = Number(campo.closest('tr').getAttribute('data-idx'));
      estado.desglose[indice][campo.getAttribute('data-campo')] = campo.value;
      recalcular();
    });

    $('#tbody-desglose').addEventListener('click', function (evento) {
      var boton = evento.target.closest('[data-accion="eliminar"]');
      if (!boton || estado.desglose.length <= 1) return;
      var indice = Number(boton.closest('tr').getAttribute('data-idx'));
      estado.desglose.splice(indice, 1);
      pintarDesglose();
      recalcular();
    });

    $('#btn-agregar-fila').addEventListener('click', function () {
      estado.desglose.push({ tipo: 'Otro usuario', cantidad: 0, dotacion: 25 });
      pintarDesglose();
      recalcular();
    });

    $('#buscar').addEventListener('input', function (evento) {
      estado.busqueda = evento.target.value;
      pintarTabla();
      guardarEstado();
    });

    $('#unidad').addEventListener('change', function (evento) {
      estado.unidad = evento.target.value;
      recalcular();
    });

    $$('.th-orden').forEach(function (th) {
      th.addEventListener('click', function () {
        var campo = th.getAttribute('data-orden');
        if (estado.orden.campo === campo) {
          estado.orden.dir = estado.orden.dir === 1 ? -1 : 1;
        } else {
          estado.orden.campo = campo;
          estado.orden.dir = 1;
        }
        pintarTabla();
        guardarEstado();
      });
    });

    $('#tbody-resumen').addEventListener('click', function (evento) {
      var fila = evento.target.closest('tr[data-fila]');
      if (fila) copiarFila(fila.getAttribute('data-fila'));
    });

    $('#tbody-resumen').addEventListener('keydown', function (evento) {
      if (evento.key !== 'Enter' && evento.key !== ' ') return;
      var fila = evento.target.closest('tr[data-fila]');
      if (!fila) return;
      evento.preventDefault();
      copiarFila(fila.getAttribute('data-fila'));
    });

    $('#btn-csv').addEventListener('click', exportarCSV);
    $('#btn-ejemplo').addEventListener('click', cargarEjemplo);
    $('#btn-reiniciar').addEventListener('click', reiniciar);
    $('#btn-imprimir').addEventListener('click', imprimir);
    $('#btn-tema').addEventListener('click', alternarTema);
  }

  /* ------------------------------------------------------------------ */
  /* Arranque                                                            */
  /* ------------------------------------------------------------------ */

  function iniciar() {
    if (!HC) {
      console.error('No se pudo cargar el módulo de cálculo (js/calculos.js).');
      return;
    }

    cargarEstado();
    aplicarEstado();
    enlazarEventos();
    recalcular();

    $('#btn-tema').setAttribute('aria-pressed', String(document.documentElement.classList.contains('dark')));

    // Refresca los acentos del tema si el sistema cambia mientras la app está abierta.
    if (window.matchMedia) {
      var consulta = window.matchMedia('(prefers-color-scheme: dark)');
      var alCambiar = function (evento) {
        try {
          if (localStorage.getItem(PREFIJO + 'tema')) return;
        } catch (error) { /* sin almacenamiento */ }
        document.documentElement.classList.toggle('dark', evento.matches);
        $('#btn-tema').setAttribute('aria-pressed', String(evento.matches));
      };
      if (consulta.addEventListener) consulta.addEventListener('change', alCambiar);
      else if (consulta.addListener) consulta.addListener(alCambiar);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
