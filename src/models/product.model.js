// src/models/product.model.js (o como se llame tu archivo de modelo)
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    // --- Campo Tipo: Para diferenciar Producto de Servicio ---
    tipo: {
        type: String,
        required: [true, 'El tipo es requerido (producto o servicio)'],
        enum: {
            values: ['producto', 'servicio'], // Solo permitir estos valores
            message: '{VALUE} no es un tipo válido (debe ser producto o servicio)'
        },
        default: 'producto' // Por defecto, es un producto
    },
    // --- Fin Campo Tipo ---

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
        unique: true, // Asegura que no haya códigos duplicados
        trim: true,
        uppercase: true // Guarda el código en mayúsculas
    },

    // --- Campo Stock: Relevante solo para tipo 'producto' ---
    stock: {
        type: Number,
        // No es 'required' a nivel de schema, ya que los servicios no lo necesitan
        default: 0, // Valor por defecto si no se especifica
        min: [0, 'El stock no puede ser negativo'],
        // Validación para asegurar que sea entero (opcional, pero buena práctica)
        validate: {
            validator: Number.isInteger,
            message: '{VALUE} no es un número entero válido para el stock'
        }
    },
    // --- Fin Campo Stock ---
    
    // --- Campo Descripción (Ya lo tenías en el form, lo añado al modelo) ---
    descripcion: {
        type: String,
        trim: true,
        default: '' // Por defecto vacío si no se provee
    }
    // --- Fin Campo Descripción ---

}, {
    timestamps: true // Mantiene createdAt y updatedAt automáticamente
});

// Middleware (opcional): Asegurar stock 0 si es servicio antes de guardar
// productSchema.pre('save', function(next) {
//     if (this.tipo === 'servicio') {
//         this.stock = 0; // O podrías ponerlo a undefined/null si prefieres
//     }
//     next();
// });

module.exports = mongoose.model('Product', productSchema); // Asegúrate que el nombre 'Product' sea consistente