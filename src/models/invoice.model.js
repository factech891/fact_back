// models/invoice.model.js
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    product: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product', 
        required: [true, 'El producto es requerido']
    },
    quantity: { 
        type: Number, 
        required: [true, 'La cantidad es requerida'],
        min: [1, 'La cantidad mínima es 1']
    },
    price: { 
        type: Number, 
        required: [true, 'El precio es requerido'],
        min: [0, 'El precio no puede ser negativo']
    },
    subtotal: { 
        type: Number, 
        required: [true, 'El subtotal es requerido'],
        min: [0, 'El subtotal no puede ser negativo']
    },
    taxExempt: {
        type: Boolean,
        default: false
    }
});

const invoiceSchema = new mongoose.Schema({
    number: { 
        type: String, 
        required: [true, 'El número de factura es requerido'],
        unique: true 
    },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: [true, 'El cliente es requerido']
    },
    date: { 
        type: Date, 
        default: Date.now 
    },
    items: {
        type: [itemSchema],
        required: [true, 'Los ítems son requeridos'],
        validate: [array => array.length > 0, 'Debe haber al menos un ítem']
    },
    subtotal: { 
        type: Number, 
        required: [true, 'El subtotal es requerido'],
        min: [0, 'El subtotal no puede ser negativo']
    },
    tax: { 
        type: Number, 
        required: [true, 'El impuesto es requerido'],
        min: [0, 'El impuesto no puede ser negativo']
    },
    total: { 
        type: Number, 
        required: [true, 'El total es requerido'],
        min: [0, 'El total no puede ser negativo']
    },
    status: {
        type: String,
        enum: {
            values: ['draft', 'pending', 'paid', 'partial', 'overdue', 'cancelled'],
            message: '{VALUE} no es un estado válido'
        },
        default: 'draft'
    },
    moneda: {
        type: String,
        enum: ['USD', 'VES'],
        default: 'VES'  // Cambiado a VES como moneda por defecto
    },
    condicionesPago: {
        type: String,
        enum: ['Contado', 'Crédito'],
        default: 'Contado'
    },
    diasCredito: {
        type: Number,
        default: 30,
        min: [0, 'Los días de crédito no pueden ser negativos']
    },
    documentType: {
        type: String,
        enum: ['invoice', 'quote', 'proforma', 'draft'],
        default: 'invoice'
    },
    // Nuevos campos para notas y términos
    notes: {
        type: String,
        default: ''
    },
    terms: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Invoice', invoiceSchema);