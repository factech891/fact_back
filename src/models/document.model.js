// models/document.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Mantener itemSchema como está (no necesita companyId individualmente)
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
    subtotal: {
        type: Number,
        required: [true, 'El subtotal del ítem es requerido'],
        min: [0, 'El subtotal del ítem no puede ser negativo']
        // Podría calcularse automáticamente
    },
    taxExempt: { // Indica si este ítem específico está exento de IVA
        type: Boolean,
        default: false
    }
}, {_id: false});

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
        type: [itemSchema],
        required: [true, 'Se requiere al menos un ítem en el documento'],
        validate: [items => items.length > 0, 'El documento debe contener al menos un ítem.']
    },
    subtotal: {
        type: Number,
        required: [true, 'El subtotal general es requerido'],
        min: [0, 'El subtotal general no puede ser negativo']
    },
    taxAmount: { // Monto total de impuestos (ej. IVA)
        type: Number,
        required: [true, 'El monto del impuesto es requerido'],
        default: 0,
        min: [0, 'El impuesto no puede ser negativo']
    },
    total: { // Monto final (subtotal + impuestos - descuentos si los hubiera)
        type: Number,
        required: [true, 'El total es requerido'],
        min: [0, 'El total no puede ser negativo']
    },
    status: {
        type: String,
        required: [true, 'El estado es requerido'],
        enum: {
            // Estados posibles para documentos generales
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
    // No se suelen incluir condiciones de pago/días de crédito en todos los tipos de documentos,
    // pero se pueden añadir si son relevantes para tus tipos específicos (QUOTE, PROFORMA).
    // paymentTerms: { ... },
    // creditDays: { ... },
    notes: { // Notas internas o para el cliente
        type: String,
        trim: true,
        default: ''
    },
    terms: { // Términos y condiciones aplicables
        type: String,
        trim: true,
        default: ''
    },
    convertedInvoice: { // Referencia a la factura si este documento se convirtió
        type: Schema.Types.ObjectId,
        ref: 'Invoice',
        default: null
    }
    // Otros campos posibles: responsable (ref: 'User'), etc.

}, {
    timestamps: true // Añade createdAt y updatedAt
});

// --- Índice Compuesto Único ---
// Asegura que el 'documentNumber' sea único DENTRO de cada 'companyId' y 'type'
documentSchema.index({ companyId: 1, type: 1, documentNumber: 1 }, { unique: true });

// Middleware pre-save (opcional) para calcular totales, etc.
// documentSchema.pre('save', function(next) {
//    // Lógica de cálculo similar a la de Invoice si es necesario
//    next();
// });

documentSchema.pre('save', function(next) {

    next();
});

module.exports = mongoose.model('Document', documentSchema);