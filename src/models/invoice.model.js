// models/invoice.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const itemSchema = new Schema({
    product: {
        type: Schema.Types.ObjectId,
        ref: 'Product', // Referencia al modelo Product
        required: [true, 'El producto es requerido']
    },
    quantity: {
        type: Number,
        required: [true, 'La cantidad es requerida'],
        min: [0.01, 'La cantidad mínima debe ser mayor que 0'] // Ajustado para permitir decimales si es necesario, o mantener 1 si son unidades enteras
    },
    price: {
        type: Number,
        required: [true, 'El precio es requerido'],
        min: [0, 'El precio no puede ser negativo']
    },
    // Considerar si el subtotal debe calcularse automáticamente o si es ingresado
    subtotal: {
        type: Number,
        required: [true, 'El subtotal del ítem es requerido'],
        min: [0, 'El subtotal del ítem no puede ser negativo']
        // Se podría calcular con un virtual o pre-save hook: this.quantity * this.price
    },
    taxExempt: { // Indica si este ítem específico está exento de IVA
        type: Boolean,
        default: false
    }
    // Podrías añadir campos como 'discountRate', 'discountAmount', 'taxRate', 'taxAmount' por ítem si necesitas más detalle
}, {_id: false}); // {_id: false} es opcional, evita que Mongoose cree un _id para cada subdocumento de item

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
        type: [itemSchema],
        required: [true, 'Se requiere al menos un ítem en la factura'],
        validate: [items => items.length > 0, 'La factura debe contener al menos un ítem.']
    },
    subtotal: { // Suma de subtotales de ítems antes de impuestos/descuentos generales
        type: Number,
        required: [true, 'El subtotal general es requerido'],
        min: [0, 'El subtotal general no puede ser negativo']
    },
    tax: { // Impuesto total aplicado a la factura (ej. IVA)
        type: Number,
        required: [true, 'El monto del impuesto es requerido'],
        default: 0,
        min: [0, 'El impuesto no puede ser negativo']
    },
    // Podrías añadir 'discountTotal' si aplicas descuentos generales
    total: { // Monto final (subtotal - descuentos + impuestos)
        type: Number,
        required: [true, 'El total es requerido'],
        min: [0, 'El total no puede ser negativo']
    },
    status: {
        type: String,
        enum: {
            values: ['draft', 'pending', 'paid', 'partial', 'overdue', 'cancelled', 'void'], // Añadido 'void' para anuladas
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
        // Podría referenciar a las condiciones del cliente o ser específicas de la factura
        default: 'Contado'
    },
    diasCredito: { // Podría heredarse del cliente o definirse aquí
        type: Number,
        default: 0,
        min: [0, 'Los días de crédito no pueden ser negativos']
    },
    documentType: { // Para diferenciar Factura, Nota de Crédito, Nota de Débito, etc.
        type: String,
        enum: ['invoice', 'credit_note', 'debit_note', 'quote', 'proforma', 'draft'],
        default: 'invoice'
    },
    relatedDocument: { // Para vincular notas de crédito/débito a una factura original
        type: Schema.Types.ObjectId,
        ref: 'Invoice'
    },
    notes: { // Notas internas o para el cliente
        type: String,
        trim: true,
        default: ''
    },
    terms: { // Términos y condiciones
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

// Middleware pre-save para calcular totales o dueDate (ejemplo conceptual)
// invoiceSchema.pre('save', function(next) {
//     if (this.isModified('items') || this.isModified('taxRate')) { // Si cambian items o tasa de impuesto
//         let calculatedSubtotal = 0;
//         let calculatedTax = 0;
//         const taxRate = 0.16; // Ejemplo, obtener de configuración
//         this.items.forEach(item => {
//             item.subtotal = item.quantity * item.price; // Calcular subtotal del item
//             calculatedSubtotal += item.subtotal;
//             if (!item.taxExempt) {
//                 calculatedTax += item.subtotal * taxRate;
//             }
//         });
//         this.subtotal = calculatedSubtotal;
//         this.tax = calculatedTax;
//         this.total = this.subtotal + this.tax; // Añadir lógica de descuentos si existe
//     }
//     if (this.isModified('date') || this.isModified('diasCredito')) {
//         if (this.diasCredito > 0) {
//             const dueDate = new Date(this.date);
//             dueDate.setDate(dueDate.getDate() + this.diasCredito);
//             this.dueDate = dueDate;
//         } else {
//             this.dueDate = this.date; // Vence el mismo día si es de contado
//         }
//     }
//     next();
// });


module.exports = mongoose.model('Invoice', invoiceSchema);
