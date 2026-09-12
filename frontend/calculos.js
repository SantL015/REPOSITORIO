//Mi hoja de calculos - ANTHROS MARKETPLACE v2.0
console.log(" Calculadora ANTHROS Marketplace v2.0 cargada");

/* ===================================================================
   CONFIGURACIÓN GLOBAL (CONSTANTES)
=================================================================== */
const CONFIG_TIENDA = Object.freeze({
    MONEDA: 'COP',
    LOCALE: 'es-CO',
    UMBRAL_BONO_100K: 100000,
    BONO_100K_PCT: 10,
    ENVIO_GRATIS_CANTIDAD: 5,
    IVA_COLOMBIA: 19,
    PRECIO_BASE_ENVIO: 5000,
    PRECIO_ENVIO_EXPRESS: 12000,
    UMBRAL_ENVIO_GRATIS_MONTO: 150000
});

const CODIGOS_PROMOCIONALES = Object.freeze({
    ANTHROS10: 10,
    BIENVENIDO: 15,
    VERANO20: 20,
    ANTIVERSARIO: 25,
    AMIGOANTHROS: 12,
    COLOMBIA: 18,
    BLACKFRIDAY: 30,
    CYBERMONDAY: 28,
    PRIMERACOMPRA: 10,
    ANIVERSARIO10: 10,
    ESPECIAL5: 5,
    CLIENTEFIEL: 20
});

const CONFIG_CUOTAS = Object.freeze({
    MAX_CUOTAS: 12,
    CUOTAS_SIN_INTERES: [1, 3, 6],
    INTERES_MENSUAL: 0.025
});

const TABLA_MAYORISTA = Object.freeze([
    { minCant: 10,  pct: 5 },
    { minCant: 25,  pct: 10 },
    { minCant: 50,  pct: 18 },
    { minCant: 100, pct: 25 },
    { minCant: 200, pct: 32 }
]);

/* ===================================================================
   FUNCIONES BASE (originales - mantenidas para compatibilidad)
=================================================================== */

/**
 * FUNCIÓN 1 - Calcula el precio con descuento aplicado
 * @param {number} precio - Precio original del producto
 * @param {number} procentajeDescuento - Porcentaje a descontar (0 a 100)
 * @returns {number} Precio final después del descuento
 */
function calcularPrecioConDescuento(precio, procentajeDescuento){
    if (precio <= 0) return 0;
    const valorDescuento = precio * (procentajeDescuento / 100);
    return Math.max(0, precio - valorDescuento);
}

/**
 * FUNCIÓN 2 - Calcula el precio agregando impuesto
 * @param {number} precio - Precio sin impuesto
 * @param {number} porcentajeImpuesto - Porcentaje a agregar
 * @returns {number} Precio con impuesto
 */
function calcularPrecioConImpuesto(precio, porcentajeImpuesto) {
    if (precio <= 0) return 0;
    const valorImpuesto = precio * (porcentajeImpuesto / 100);
    return precio + valorImpuesto;
}

/**
 * FUNCIÓN 3 - Calcula total del pedido: subtotal + envío + umbral 100k
 * @param {number} precioUnitario - Precio por unidad
 * @param {number} cantidad - Cantidad de unidades
 * @param {number} costoEnvio - Costo de envío inicial
 * @returns {number} Total del pedido final
 */
function calcularTotalPedido(precioUnitario, cantidad, costoEnvio) {
    if (cantidad > CONFIG_TIENDA.ENVIO_GRATIS_CANTIDAD) {
        costoEnvio = 0;
        console.log(" El envío es gratis por comprar más de 5 productos");
    }
    const subtotal = precioUnitario * cantidad;
    let totalPedido = subtotal + costoEnvio;
    if (totalPedido > CONFIG_TIENDA.UMBRAL_BONO_100K) {
        totalPedido = calcularPrecioConDescuento(totalPedido, CONFIG_TIENDA.BONO_100K_PCT);
        console.log(" ¡Felicidades! Has superado el umbral de $100,000. Descuento 10% aplicado.");
    }
    return Math.round(totalPedido);
}

/* ===================================================================
   FUNCIONES DE CÁLCULO EXTENDIDAS (v2)
   Complementan las 3 funciones originales
=================================================================== */

/** Devuelve subtotal de todos los items del carrito */
function calcularSubtotalCarrito(items) {
    if (!Array.isArray(items)) return 0;
    return items.reduce((acum, item) => acum + (Number(item.price || 0) * Number(item.qty || 0)), 0);
}

/** Devuelve la cantidad total de productos (suma de cantidades por item) */
function calcularCantidadTotalProductos(items) {
    if (!Array.isArray(items)) return 0;
    return items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
}

/** Calcula el valor del IVA (incluido en el precio por defecto CO 19%) */
function calcularIVA(valor, incluyeEnPrecio = true, porcentaje = CONFIG_TIENDA.IVA_COLOMBIA) {
    if (valor <= 0) return 0;
    if (incluyeEnPrecio) return valor - (valor / (1 + (porcentaje / 100)));
    return valor * (porcentaje / 100);
}

/** Calcula el valor base (antes de IVA) a partir de un precio final con IVA incluido */
function calcularBaseGravable(valorConIVA, ivaPorc = CONFIG_TIENDA.IVA_COLOMBIA) {
    if (valorConIVA <= 0) return 0;
    return valorConIVA / (1 + (ivaPorc / 100));
}

/** Aplica IVA a un precio sin impuesto */
function calcularPrecioConIVA(precioSinIVA, ivaPorc = CONFIG_TIENDA.IVA_COLOMBIA) {
    return calcularPrecioConImpuesto(precioSinIVA, ivaPorc);
}

/** Determina costo de envío según cantidad, monto y tipo */
function calcularCostoEnvio(totalQty, subtotalMonto, tipo = 'estandar',
                             umbralCantGratis = CONFIG_TIENDA.ENVIO_GRATIS_CANTIDAD,
                             umbralMontoGratis = CONFIG_TIENDA.UMBRAL_ENVIO_GRATIS_MONTO) {
    if (totalQty > umbralCantGratis) return 0;
    if (subtotalMonto >= umbralMontoGratis) return 0;
    return tipo === 'express' ? CONFIG_TIENDA.PRECIO_ENVIO_EXPRESS : CONFIG_TIENDA.PRECIO_BASE_ENVIO;
}

/** Calcula CUÁNTO se ahorra en total (descuentos producto + códigos promo + umbral) */
function calcularAhorroTotal(items, promoPorcentaje = 0, precioOriginalCadaUno = null) {
    let ahorro = 0;
    if (Array.isArray(items)) {
        items.forEach(item => {
            if (item.originalPrice && item.originalPrice > item.price) {
                ahorro += (item.originalPrice - item.price) * (item.qty || 1);
            } else if (typeof precioOriginalCadaUno === 'number' && precioOriginalCadaUno > item.price) {
                ahorro += (precioOriginalCadaUno - item.price) * (item.qty || 1);
            }
        });
    }
    const subtotal = calcularSubtotalCarrito(items);
    const qty = calcularCantidadTotalProductos(items);
    if (promoPorcentaje) ahorro += subtotal * (promoPorcentaje / 100);
    const antesUmbral = subtotal + calcularCostoEnvio(qty, subtotal);
    if (antesUmbral > CONFIG_TIENDA.UMBRAL_BONO_100K) {
        ahorro += antesUmbral * (CONFIG_TIENDA.BONO_100K_PCT / 100);
    }
    return Math.round(ahorro);
}

/** Devuelve un objeto COMPLETO con TODO el desglose del pedido */
function calcularDesgloseCompletoPedido(items, promoPct = 0, envioAdicional = null) {
    const subtotal = calcularSubtotalCarrito(items);
    const totalQty = calcularCantidadTotalProductos(items);
    const shipping = envioAdicional ?? calcularCostoEnvio(totalQty, subtotal);
    const promoDiscount = promoPct ? (subtotal * (promoPct / 100)) : 0;
    const despuesPromo = subtotal - promoDiscount;
    const antesUmbral100k = despuesPromo + shipping;
    const bono100k = antesUmbral100k > CONFIG_TIENDA.UMBRAL_BONO_100K ? antesUmbral100k * 0.10 : 0;
    const total = antesUmbral100k - bono100k;
    return {
        subtotal: Math.round(subtotal),
        cantidadProductos: totalQty,
        envio: Math.round(shipping),
        descuentoPromo: Math.round(promoDiscount),
        promoAplicado: promoPct,
        bonoUmbral100k: Math.round(bono100k),
        totalFinal: Math.round(total),
        ahorroTotal: calcularAhorroTotal(items, promoPct),
        ivaIncluido: Math.round(calcularIVA(total)),
        baseGravable: Math.round(calcularBaseGravable(total)),
        subtotalDespuesPromo: Math.round(despuesPromo),
        antesUmbral: Math.round(antesUmbral100k),
        envioGratisAplicado: shipping === 0,
        bono100kAplicado: bono100k > 0
    };
}

/** Calcula una cuota individual (simula tarjeta de crédito) */
function calcularValorCuota(valorTotal, numCuotas = 1,
                             cuotasSinInteres = CONFIG_CUOTAS.CUOTAS_SIN_INTERES,
                             interesMensual = CONFIG_CUOTAS.INTERES_MENSUAL,
                             maxCuotas = CONFIG_CUOTAS.MAX_CUOTAS) {
    if (numCuotas <= 0) return { error: 'Número de cuotas inválido', numCuotas: 1, valorCuota: valorTotal, valorFinal: valorTotal, sinInteres: true, texto: `1 cuota de $${formatearCOP(valorTotal)} SIN INTERÉS` };
    if (numCuotas > maxCuotas) numCuotas = maxCuotas;
    const sinInteres = cuotasSinInteres.includes(numCuotas);
    let total = valorTotal;
    if (!sinInteres) total = valorTotal * Math.pow(1 + interesMensual, numCuotas);
    const cuota = total / numCuotas;
    return {
        numCuotas,
        sinInteres,
        conInteres: !sinInteres,
        valorCuota: Math.round(cuota),
        valorFinal: Math.round(total),
        interesTotal: sinInteres ? 0 : Math.round(total - valorTotal),
        texto: `${numCuotas} cuotas de $${formatearCOP(cuota)} ${sinInteres ? 'SIN INTERÉS' : `c/interés (total $${formatearCOP(total)})`}`
    };
}

/** Devuelve un arreglo con TODAS las cuotas disponibles */
function calcularTodasLasCuotas(valor, maxCuotas = CONFIG_CUOTAS.MAX_CUOTAS) {
    return Array.from({ length: maxCuotas }, (_, i) => i + 1).map(n => calcularValorCuota(valor, n));
}

/** Devuelve solo las cuotas sin interés disponibles */
function calcularCuotasSinInteres(valor) {
    return CONFIG_CUOTAS.CUOTAS_SIN_INTERES.map(n => calcularValorCuota(valor, n));
}

/** Redondea un precio a múltiplos de 50 / 100 COP (precios "limpios") */
function redondearCOP(precio, multiplo = 50) {
    return Math.round(precio / multiplo) * multiplo;
}

/** Formatea un número como pesos colombianos */
function formatearCOP(valor, decimales = 0) {
    return Number(valor || 0).toLocaleString(CONFIG_TIENDA.LOCALE, {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales
    });
}

/** Formatea con símbolo $ incluido */
function formatearCOPConSimbolo(valor, decimales = 0) {
    return `$${formatearCOP(valor, decimales)}`;
}

/** Descuento MAYORISTA por volumen de compra */
function calcularPrecioMayorista(precioUnitario, cantidad, tablaUmbrales = TABLA_MAYORISTA) {
    const ordenado = [...tablaUmbrales].sort((a,b) => b.minCant - a.minCant);
    const aplicar = ordenado.find(t => cantidad >= t.minCant);
    const porcentaje = aplicar ? aplicar.pct : 0;
    const unitarioConDesc = calcularPrecioConDescuento(precioUnitario, porcentaje);
    return {
        porcentajeDescuento: porcentaje,
        precioUnitarioMayorista: Math.round(unitarioConDesc),
        totalMayorista: Math.round(unitarioConDesc * cantidad),
        ahorroTotal: Math.round((precioUnitario - unitarioConDesc) * cantidad),
        aplicaMayorista: porcentaje > 0,
        siguienteEscalon: ordenado.find(t => cantidad < t.minCant) || null
    };
}

/** Calcula qué porcentaje de descuento hay entre 2 precios */
function calcularPorcentajeDescuentoEntrePrecios(precioOferta, precioOriginal) {
    if (!precioOriginal || precioOriginal <= precioOferta) return 0;
    return Math.round(100 - ((precioOferta / precioOriginal) * 100));
}

/** Aplica un código promocional (devuelve el % o 0 si es inválido) */
function aplicarCodigoPromocional(codigo) {
    if (!codigo) return 0;
    return CODIGOS_PROMOCIONALES[String(codigo).toUpperCase().trim()] || 0;
}

/** Verifica si un código es válido */
function esCodigoPromocionalValido(codigo) {
    return aplicarCodigoPromocional(codigo) > 0;
}

/* ===================================================================
   FUNCIONES DE ANÁLISIS Y REPORTES (NUEVAS v2.0)
=================================================================== */

/** Devuelve estadísticas/resumen del carrito para dashboard */
function calcularResumenCarrito(items, promoPct = 0) {
    const desglose = calcularDesgloseCompletoPedido(items, promoPct);
    const productosUnicos = Array.isArray(items) ? items.length : 0;
    return {
        ...desglose,
        productosUnicos,
        ahorroPorcentaje: desglose.subtotal > 0
            ? Math.round((desglose.ahorroTotal / (desglose.subtotal + desglose.ahorroTotal)) * 100)
            : 0,
        ticketPromedio: productosUnicos > 0 ? Math.round(desglose.subtotal / productosUnicos) : 0,
        unidadesPorProducto: productosUnicos > 0 ? +(desglose.cantidadProductos / productosUnicos).toFixed(1) : 0
    };
}

/** Compara 2 escenarios: con vs sin código promocional */
function compararConSinPromo(items, promoPct = 0) {
    const sinPromo = calcularDesgloseCompletoPedido(items, 0);
    const conPromo = calcularDesgloseCompletoPedido(items, promoPct);
    return {
        sinPromocion: sinPromo,
        conPromocion: conPromo,
        diferencia: Math.round(sinPromo.totalFinal - conPromo.totalFinal),
        ahorroExtraPorPromo: promoPct > 0 ? Math.round((conPromo.subtotal * promoPct) / 100) : 0
    };
}

/** Calcula recomendación: cuánto falta para envío gratis y/o bono 100k */
function calcularProximosBeneficios(items, promoPct = 0) {
    const subtotal = calcularSubtotalCarrito(items);
    const qty = calcularCantidadTotalProductos(items);
    return {
        paraEnvioGratisCantidad: Math.max(0, CONFIG_TIENDA.ENVIO_GRATIS_CANTIDAD - qty + 1),
        paraEnvioGratisMonto: Math.max(0, CONFIG_TIENDA.UMBRAL_ENVIO_GRATIS_MONTO - subtotal),
        paraBono100k: Math.max(0, CONFIG_TIENDA.UMBRAL_BONO_100K + 1 - subtotal),
        tieneEnvioGratisPorCantidad: qty > CONFIG_TIENDA.ENVIO_GRATIS_CANTIDAD,
        tieneEnvioGratisPorMonto: subtotal >= CONFIG_TIENDA.UMBRAL_ENVIO_GRATIS_MONTO,
        tieneBono100k: subtotal > CONFIG_TIENDA.UMBRAL_BONO_100K
    };
}

/** Simula desglose completo de pago mostrando todos los métodos */
function calcularOpcionesPago(items, promoPct = 0) {
    const desglose = calcularDesgloseCompletoPedido(items, promoPct);
    const total = desglose.totalFinal;
    return {
        desglose,
        efectivo: total,
        pse: total,
        tarjeta: {
            cuotas: calcularTodasLasCuotas(total),
            sinInteres: calcularCuotasSinInteres(total)
        },
        recomendacion: total >= CONFIG_TIENDA.UMBRAL_BONO_100K ? 'Bono 100k aplicado ' : `Faltan $${formatearCOP(Math.max(0, CONFIG_TIENDA.UMBRAL_BONO_100K + 1 - total))} para bono 10%`
    };
}

/* ===================================================================
   FUNCIONES UTILITARIAS (NUEVAS)
=================================================================== */

/** Genera ID único alfanumérico */
function generarIdUnico(prefijo = '', longitud = 8) {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < longitud; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return prefijo ? `${prefijo}-${id}` : id;
}

/** Genera código promo aleatorio */
function generarCodigoPromoAleatorio(prefijo = 'ANTHROS', longitud = 8) {
    return generarIdUnico(prefijo, longitud);
}

/** Convierte rango de tallas a texto */
function textoRangoTallas(tallasArray) {
    if (!Array.isArray(tallasArray) || tallasArray.length === 0) return '';
    if (tallasArray.length === 1) return `Talla ${tallasArray[0]}`;
    if (tallasArray.length <= 3) return `Tallas ${tallasArray.join(', ')}`;
    return `De ${tallasArray[0]} a ${tallasArray[tallasArray.length - 1]}`;
}

/* ===================================================================
   EJEMPLOS DE EJECUCIÓN (consola)
=================================================================== */
console.log("----- EJEMPLOS calculos.js ANTHROS v2.0 -----");

const precioDescuento = calcularPrecioConDescuento(100000, 50);
console.log("1) 50% OFF sobre $100.000  $" + formatearCOP(precioDescuento));

const resultadoPedido = calcularTotalPedido(150000, 6, 5000);
console.log("2) Total pedido (6x $150.000, envío 5k)  $" + formatearCOP(resultadoPedido));

const precioImpuesto = calcularPrecioConImpuesto(100000, CONFIG_TIENDA.IVA_COLOMBIA);
console.log("3) Precio + IVA 19%  $" + formatearCOP(precioImpuesto));

const carritoPrueba = [
    { price: 63920, qty: 2, originalPrice: 79900 },
    { price: 125000, qty: 1 }
];
const desglose = calcularDesgloseCompletoPedido(carritoPrueba, 10);
console.log("4) Desglose carrito de prueba + 10% promo:", {
    Subtotal: "$" + formatearCOP(desglose.subtotal),
    Ahorro:   "$" + formatearCOP(desglose.ahorroTotal),
    Envío:    "$" + formatearCOP(desglose.envio),
    Bono100k: "$" + formatearCOP(desglose.bonoUmbral100k),
    Total:    "$" + formatearCOP(desglose.totalFinal)
});

const cuotasPrueba = calcularValorCuota(500000, 6);
console.log("5) Cuotas:", cuotasPrueba.texto);

const mayoristaPrueba = calcularPrecioMayorista(50000, 60);
console.log("6) Mayorista 60 unidades ($50k/unidad):",
    `${mayoristaPrueba.porcentajeDescuento}% OFF  Total $${formatearCOP(mayoristaPrueba.totalMayorista)}`);

const cod1 = aplicarCodigoPromocional('blackfriday');
const cod2 = aplicarCodigoPromocional('codigofalso');
console.log("7) Códigos promo  BLACKFRIDAY:", cod1 + "%, FALSO:", cod2 + "%");

const proximos = calcularProximosBeneficios(carritoPrueba, 10);
console.log("8) Próximos beneficios:", proximos);

const resumen = calcularResumenCarrito(carritoPrueba, 10);
console.log("9) Resumen carrito:", {
    ProductosUnicos: resumen.productosUnicos,
    TicketPromedio: "$" + formatearCOP(resumen.ticketPromedio),
    AhorroPct: resumen.ahorroPorcentaje + "%"
});

/* Exportar para navegador globalmente */
if (typeof window !== 'undefined') {
    window.CALCULOS_ANTHROS = {
        CONFIG_TIENDA,
        CODIGOS_PROMOCIONALES,
        CONFIG_CUOTAS,
        TABLA_MAYORISTA,
        calcularPrecioConDescuento,
        calcularPrecioConImpuesto,
        calcularTotalPedido,
        calcularSubtotalCarrito,
        calcularCantidadTotalProductos,
        calcularIVA,
        calcularBaseGravable,
        calcularPrecioConIVA,
        calcularCostoEnvio,
        calcularAhorroTotal,
        calcularDesgloseCompletoPedido,
        calcularValorCuota,
        calcularTodasLasCuotas,
        calcularCuotasSinInteres,
        redondearCOP,
        formatearCOP,
        formatearCOPConSimbolo,
        calcularPrecioMayorista,
        calcularPorcentajeDescuentoEntrePrecios,
        aplicarCodigoPromocional,
        esCodigoPromocionalValido,
        calcularResumenCarrito,
        compararConSinPromo,
        calcularProximosBeneficios,
        calcularOpcionesPago,
        generarIdUnico,
        generarCodigoPromoAleatorio,
        textoRangoTallas
    };
}





