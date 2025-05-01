// models/document-numbering.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const documentNumberingSchema = new Schema({
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company', 
        required: [true, 'La compañía es requerida'],
        index: true
    },
    documentType: {
        type: String,
        enum: ['invoice', 'credit_note', 'debit_note', 'quote', 'proforma', 'draft'],
        required: [true, 'El tipo de documento es requerido'],
        default: 'invoice'
    },
    lastNumber: {
        type: Number,
        required: [true, 'El último número es requerido'],
        min: [0, 'El último número no puede ser negativo'],
        default: 0
    },
    prefix: {
        type: String,
        required: [true, 'El prefijo es requerido'],
        trim: true,
        default: 'FAC-'
    },
    padding: {
        type: Number,
        required: [true, 'El relleno es requerido'],
        min: [1, 'El relleno debe ser mayor a 0'],
        default: 5
    }
}, {
    timestamps: true
});

// Crear índice compuesto único para que cada tipo de documento en cada empresa tenga su propia numeración
documentNumberingSchema.index({ companyId: 1, documentType: 1 }, { unique: true });

module.exports = mongoose.model('DocumentNumbering', documentNumberingSchema);