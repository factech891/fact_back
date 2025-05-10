// models/document.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// --- INICIO MODIFICACIÓN itemSchema ---
const itemSchema = new Schema({
    product: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'El producto es requerido']
    },
    quantity: {
        type: Number,
        required: [true, 'La cantidad es requerida'],
        min: [0.01, 'La cantidad mínima debe ser mayor que 0'] // O 1 si son unidades enteras
    },
    price: {
        type: Number,
        required: [true, 'El precio es requerido'],
        min: [0, 'El precio no puede ser negativo']
    },
    subtotal: { // Este es el subtotal del ítem (quantity * price)
        type: Number,
        required: [true, 'El subtotal del ítem es requerido'],
        min: [0, 'El subtotal del ítem no puede ser negativo']
        // Podría calcularse automáticamente
    },
    taxType: { // NUEVO CAMPO
        type: String,
        enum: ['gravado', 'exento', 'no_gravado'],
        default: 'gravado'
    },
    taxExempt: { // Indica si este ítem específico está exento de IVA (se sincronizará en pre-save)
        type: Boolean,
        default: false
    }
}, {_id: false});
// --- FIN MODIFICACIÓN itemSchema ---

const documentSchema = new Schema({
    // --- Campo NUEVO para Multiempresa ---
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company', // Referencia al modelo Company
        required: [true, 'La compañía es requerida'],
        index: true // Índice simple para búsquedas generales por compañía
    },
    // --- Fin Campo Multiempresa ---

    documentNumber: {
        type: String,
        required: [true, 'El número de documento es requerido'],
        trim: true
        // unique: true // <-- ELIMINADO: Se reemplaza por índice compuesto
    },
    client: {
        type: Schema.Types.ObjectId,
        ref: 'Client',
        required: [true, 'El cliente es requerido']
    },
    date: {
        type: Date,
        required: [true, 'La fecha es requerida'],
        default: Date.now
    },
    expiryDate: { // Fecha de expiración (para cotizaciones, etc.)
        type: Date,
        default: null
    },
    type: { // Tipo de documento (Cotización, Proforma, Nota de Entrega)
        type: String,
        required: [true, 'El tipo de documento es requerido'],
        enum: {
            values: ['QUOTE', 'PROFORMA', 'DELIVERY_NOTE', 'OTHER'], // Añadido OTHER
            message: '{VALUE} no es un tipo de documento válido'
        },
        default: 'QUOTE'
    },
    items: {
        type: [itemSchema], // Usa el itemSchema modificado
        required: [true, 'Se requiere al menos un ítem en el documento'],
        validate: [items => items.length > 0, 'El documento debe contener al menos un ítem.']
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

    subtotal: { // Calculado en pre-save
        type: Number,
        required: [true, 'El subtotal general es requerido'],
        min: [0, 'El subtotal general no puede ser negativo']
    },
    taxAmount: { // Monto total de impuestos (ej. IVA) (Calculado en pre-save)
        type: Number,
        required: [true, 'El monto del impuesto es requerido'],
        default: 0,
        min: [0, 'El impuesto no puede ser negativo']
    },
    total: { // Monto final (subtotal + impuestos - descuentos si los hubiera) (Calculado en pre-save)
        type: Number,
        required: [true, 'El total es requerido'],
        min: [0, 'El total no puede ser negativo']
    },
    status: {
        type: String,
        required: [true, 'El estado es requerido'],
        enum: {
            values: ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONVERTED', 'CANCELLED'],
            message: '{VALUE} no es un estado válido para el documento'
        },
        default: 'DRAFT'
    },
    currency: { // Moneda del documento
        type: String,
        required: [true, 'La moneda es requerida'],
        enum: ['USD', 'VES', 'EUR', 'COP'], // Ajustar según necesidad
        default: 'USD'
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
    },
    convertedInvoice: {
        type: Schema.Types.ObjectId,
        ref: 'Invoice',
        default: null
    }
}, {
    timestamps: true
});

documentSchema.index({ companyId: 1, type: 1, documentNumber: 1 }, { unique: true });

// --- INICIO MODIFICACIÓN: Middleware pre-save ---
documentSchema.pre('save', function(next) {
    // Inicializar acumuladores
    let calculatedSubtotalGravado = 0;
    let calculatedSubtotalExento = 0;
    let calculatedSubtotalNoGravado = 0;
    
    this.items.forEach(item => {
        const quantity = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        const itemTotal = quantity * price;

        // Opcional: Forzar recálculo del subtotal del ítem si no se confía en el valor entrante
        // item.subtotal = itemTotal;

        // Determinar taxType, con compatibilidad hacia atrás si solo viene taxExempt
        const taxType = item.taxType || (item.taxExempt ? 'exento' : 'gravado');
        
        if (taxType === 'exento') {
            calculatedSubtotalExento += itemTotal;
        } else if (taxType === 'no_gravado') {
            calculatedSubtotalNoGravado += itemTotal;
        } else { // 'gravado' o cualquier otro valor por defecto
            calculatedSubtotalGravado += itemTotal;
        }
        
        // Sincronizar item.taxExempt con el taxType determinado
        item.taxExempt = (taxType === 'exento');
        // Asegurar que taxType también se establezca si solo vino taxExempt o no vino ninguno
        if (!item.taxType && item.taxExempt) {
            item.taxType = 'exento';
        } else if (!item.taxType && !item.taxExempt && taxType !== 'no_gravado') { // Si no es exento ni no_gravado explícitamente, y no tiene taxType, es gravado
            item.taxType = 'gravado';
        } else if (!item.taxType) { // Si taxType sigue vacío (ej. era no_gravado por item.taxExempt=false y ausencia de item.taxType)
            item.taxType = taxType; // Asignar el taxType deducido
        }
    });
    
    // Asignar valores calculados a los campos del esquema
    this.subtotalGravado = Number(calculatedSubtotalGravado.toFixed(2));
    this.subtotalExento = Number(calculatedSubtotalExento.toFixed(2));
    this.subtotalNoGravado = Number(calculatedSubtotalNoGravado.toFixed(2));
    
    // Calcular el taxAmount (IVA 16% solo sobre el subtotal gravado)
    // Considerar si la tasa de impuesto podría variar o ser configurable
    const taxRate = 0.16; 
    this.taxAmount = Number((this.subtotalGravado * taxRate).toFixed(2));
    
    // Actualizar subtotal y total general del documento
    this.subtotal = Number((this.subtotalGravado + this.subtotalExento + this.subtotalNoGravado).toFixed(2));
    this.total = Number((this.subtotal + this.taxAmount).toFixed(2));
    
    next();
});
// --- FIN MODIFICACIÓN: Middleware pre-save ---

module.exports = mongoose.model('Document', documentSchema);