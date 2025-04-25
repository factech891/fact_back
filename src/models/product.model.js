// models/product.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const productSchema = new Schema({
    // --- Campo NUEVO para Multiempresa ---
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company', // Referencia al modelo Company
        required: [true, 'La compañía es requerida'],
        index: true // Añadir índice simple para búsquedas por compañía
    },
    // --- Fin Campo Multiempresa ---

    tipo: {
        type: String,
        required: [true, 'El tipo es requerido (producto o servicio)'],
        enum: {
            values: ['producto', 'servicio'],
            message: '{VALUE} no es un tipo válido (debe ser producto o servicio)'
        },
        default: 'producto'
    },
    nombre: {
        type: String,
        required: [true, 'El nombre es requerido'],
        trim: true
    },
    precio: {
        type: Number,
        required: [true, 'El precio es requerido'],
        min: [0, 'El precio no puede ser negativo']
    },
    codigo: {
        type: String,
        required: [true, 'El código es requerido'],
        // unique: true, // <-- ELIMINADO: Se reemplaza por índice compuesto
        trim: true,
        uppercase: true // Guarda el código en mayúsculas
    },
    stock: {
        type: Number,
        default: 0,
        min: [0, 'El stock no puede ser negativo'],
        validate: {
            validator: Number.isInteger,
            message: '{VALUE} no es un número entero válido para el stock'
        }
        // Considerar si el stock debe ser requerido solo para tipo 'producto'
        // required: function() { return this.tipo === 'producto'; } // Validación condicional
    },
    descripcion: {
        type: String,
        trim: true,
        default: ''
    }
    // Puedes añadir más campos aquí si son necesarios (ej. categoría, unidad de medida, impuestos aplicables, etc.)

}, {
    timestamps: true
});

// --- Índice Compuesto Único ---
// Asegura que el 'codigo' sea único DENTRO de cada 'companyId'
productSchema.index({ companyId: 1, codigo: 1 }, { unique: true });

// Middleware (opcional): Asegurar stock 0 si es servicio antes de guardar
// productSchema.pre('save', function(next) {
//     if (this.isModified('tipo') && this.tipo === 'servicio') {
//         this.stock = 0;
//     }
//     next();
// });

module.exports = mongoose.model('Product', productSchema);
