// models/invoice.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// --- INICIO MODIFICACIÓN itemSchema ---
const itemSchema = new Schema({
    product: {
        type: Schema.Types.ObjectId,
        ref: 'Product', // Referencia al modelo Product
        required: [true, 'El producto es requerido']
    },
    quantity: {
        type: Number,
        required: [true, 'La cantidad es requerida'],
        min: [0.01, 'La cantidad mínima debe ser mayor que 0']
    },
    price: {
        type: Number,
        required: [true, 'El precio es requerido'],
        min: [0, 'El precio no puede ser negativo']
    },
    subtotal: { // Este subtotal es por ítem: quantity * price
        type: Number,
        required: [true, 'El subtotal del ítem es requerido'],
        min: [0, 'El subtotal del ítem no puede ser negativo']
        // Este subtotal individual del ítem generalmente se envía desde el frontend
        // o se podría calcular aquí también si no se confía en el frontend.
        // El pre-save hook de invoiceSchema se enfoca en los totales generales.
    },
    taxType: { // NUEVO CAMPO
        type: String,
        enum: ['gravado', 'exento', 'no_gravado'],
        default: 'gravado'
    },
    taxExempt: { // Se mantiene por compatibilidad y se sincronizará en pre-save
        type: Boolean,
        default: false
    }
    // Podrías añadir campos como 'discountRate', 'discountAmount', 'taxRate', 'taxAmount' por ítem si necesitas más detalle
}, {_id: false}); // {_id: false} es opcional, evita que Mongoose cree un _id para cada subdocumento de item
// --- FIN MODIFICACIÓN itemSchema ---

const invoiceSchema = new Schema({
    // --- Campo NUEVO para Multiempresa ---
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company', // Referencia al modelo Company
        required: [true, 'La compañía es requerida'],
        index: true // Índice simple para búsquedas generales por compañía
    },
    // --- Fin Campo Multiempresa ---

    number: {
        type: String,
        required: [true, 'El número de factura es requerido'],
        trim: true
        // unique: true // <-- ELIMINADO: Se reemplaza por índice compuesto
    },
    client: {
        type: Schema.Types.ObjectId,
        ref: 'Client', // Referencia al modelo Client
        required: [true, 'El cliente es requerido']
    },
    date: {
        type: Date,
        required: [true, 'La fecha es requerida'],
        default: Date.now
    },
    dueDate: { // Fecha de vencimiento (importante para estado 'overdue')
        type: Date
        // Se podría calcular basado en 'date' y 'diasCredito'
    },
    items: {
        type: [itemSchema], // Usa el itemSchema modificado
        required: [true, 'Se requiere al menos un ítem en la factura'],
        validate: [items => items.length > 0, 'La factura debe contener al menos un ítem.']
    },
    
    // --- INICIO MODIFICACIÓN: Campos para el desglose fiscal ---
    subtotalGravado: {
        type: Number,
        default: 0,
        min: [0, 'El subtotal gravado no puede ser negativo']
    },
    subtotalExento: {
        type: Number,
        default: 0,
        min: [0, 'El subtotal exento no puede ser negativo']
    },
    subtotalNoGravado: {
        type: Number,
        default: 0,
        min: [0, 'El subtotal no gravado no puede ser negativo']
    },
    // --- FIN MODIFICACIÓN: Campos para el desglose fiscal ---

    subtotal: { // Suma de subtotales de ítems antes de impuestos/descuentos generales (calculado en pre-save)
        type: Number,
        required: [true, 'El subtotal general es requerido'],
        min: [0, 'El subtotal general no puede ser negativo']
    },
    tax: { // Impuesto total aplicado a la factura (ej. IVA) (calculado en pre-save)
        type: Number,
        required: [true, 'El monto del impuesto es requerido'],
        default: 0,
        min: [0, 'El impuesto no puede ser negativo']
    },
    // Podrías añadir 'discountTotal' si aplicas descuentos generales
    total: { // Monto final (subtotal - descuentos + impuestos) (calculado en pre-save)
        type: Number,
        required: [true, 'El total es requerido'],
        min: [0, 'El total no puede ser negativo']
    },
    status: {
        type: String,
        enum: {
            values: ['draft', 'pending', 'paid', 'partial', 'overdue', 'cancelled', 'void'],
            message: '{VALUE} no es un estado válido para la factura'
        },
        default: 'draft'
    },
    moneda: {
        type: String,
        required: [true, 'La moneda es requerida'],
        enum: ['USD', 'VES', 'EUR', 'COP'], // Ampliar si es necesario
        default: 'VES'
    },
    tasaCambio: { // Tasa de cambio usada si la moneda no es la base de la compañía
        type: Number,
        min: 0
    },
    condicionesPago: {
        type: String,
        default: 'Contado'
    },
    diasCredito: {
        type: Number,
        default: 0,
        min: [0, 'Los días de crédito no pueden ser negativos']
    },
    documentType: {
        type: String,
        enum: ['invoice', 'credit_note', 'debit_note', 'quote', 'proforma', 'draft'],
        default: 'invoice'
    },
    relatedDocument: {
        type: Schema.Types.ObjectId,
        ref: 'Invoice'
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    terms: {
        type: String,
        trim: true,
        default: ''
    }
    // Otros campos posibles: vendedor (ref: 'User'), metodoPago, referenciaPago, etc.

}, {
    timestamps: true // Añade createdAt y updatedAt
});

// --- Índice Compuesto Único ---
// Asegura que el 'number' sea único DENTRO de cada 'companyId'
invoiceSchema.index({ companyId: 1, number: 1 }, { unique: true });

// --- INICIO MODIFICACIÓN: Middleware pre-save ---
invoiceSchema.pre('save', function(next) {
    // Inicializar acumuladores
    let calculatedSubtotalGravado = 0; // Usar nombres de variables diferentes para evitar confusión con this.
    let calculatedSubtotalExento = 0;
    let calculatedSubtotalNoGravado = 0;
    
    // Sumar por tipo fiscal
    this.items.forEach(item => {
        // Asegurarse de que quantity y price son números válidos para el cálculo
        const quantity = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        const itemTotal = quantity * price;
        
        // Si el subtotal del item no viene o es incorrecto, recalcularlo aquí.
        // Esto es opcional, si se confía en el frontend, el subtotal del item ya debería ser correcto.
        // item.subtotal = itemTotal; 

        // Determine tax type, with backwards compatibility
        const taxType = item.taxType || (item.taxExempt ? 'exento' : 'gravado');
        
        if (taxType === 'exento') {
            calculatedSubtotalExento += itemTotal;
        } else if (taxType === 'no_gravado') {
            calculatedSubtotalNoGravado += itemTotal;
        } else { // gravado por defecto
            calculatedSubtotalGravado += itemTotal;
        }
        
        // Ensure taxExempt boolean is in sync with taxType
        item.taxExempt = (taxType === 'exento');
        // Asegurar que taxType también se establezca si solo vino taxExempt
        if (!item.taxType && item.taxExempt) {
            item.taxType = 'exento';
        } else if (!item.taxType && !item.taxExempt) {
            item.taxType = 'gravado'; // O el default que corresponda
        }

    });
    
    // Asignar valores calculados a los campos del esquema
    this.subtotalGravado = Number(calculatedSubtotalGravado.toFixed(2));
    this.subtotalExento = Number(calculatedSubtotalExento.toFixed(2));
    this.subtotalNoGravado = Number(calculatedSubtotalNoGravado.toFixed(2));
    
    // Calcular el IVA (16% solo sobre el subtotal gravado)
    // Podría ser configurable la tasa de IVA en el futuro
    const taxRate = 0.16; 
    this.tax = Number((this.subtotalGravado * taxRate).toFixed(2));
    
    // Actualizar subtotal y total general
    this.subtotal = Number((this.subtotalGravado + this.subtotalExento + this.subtotalNoGravado).toFixed(2));
    this.total = Number((this.subtotal + this.tax).toFixed(2));
    
    next();
});
// --- FIN MODIFICACIÓN: Middleware pre-save ---

module.exports = mongoose.model('Invoice', invoiceSchema);