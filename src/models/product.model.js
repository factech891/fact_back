// models/product.model.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    precio: { type: Number, required: true },
    codigo: { type: String, required: true, unique: true } // Índice único
});

module.exports = mongoose.model('Product', productSchema);