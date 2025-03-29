// models/document.model.js
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

const documentSchema = new mongoose.Schema({
    documentNumber: { 
        type: String, 
        required: [true, 'El número de documento es requerido'],
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
    expiryDate: {
        type: Date,
        default: null
    },
    type: {
        type: String,
        enum: {
            values: ['QUOTE', 'PROFORMA', 'DELIVERY_NOTE'],
            message: '{VALUE} no es un tipo de documento válido'
        },
        default: 'QUOTE'
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
    taxAmount: { 
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
            values: ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONVERTED'],
            message: '{VALUE} no es un estado válido'
        },
        default: 'DRAFT'
    },
    currency: {
        type: String,
        enum: ['USD', 'VES', 'EUR'],
        default: 'USD'
    },
    paymentTerms: {
        type: String,
        enum: ['Contado', 'Crédito'],
        default: 'Contado'
    },
    creditDays: {
        type: Number,
        default: 0,
        min: [0, 'Los días de crédito no pueden ser negativos']
    },
    notes: {
        type: String,
        default: ''
    },
    terms: {
        type: String,
        default: ''
    },
    convertedInvoice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invoice',
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Document', documentSchema);