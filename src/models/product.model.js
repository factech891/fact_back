const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
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
        unique: true,
        trim: true,
        uppercase: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Product', productSchema);