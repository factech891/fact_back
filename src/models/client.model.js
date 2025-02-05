// models/client.model.js
const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true },
    rif: { type: String, required: true, unique: true }, // Aseguramos que el RIF sea único
    direccion: { type: String, required: false },
    telefono: { type: String, required: false },
    email: { type: String, required: true, unique: true }, // Aseguramos que el email sea único
  },
  { timestamps: true } // Agrega createdAt y updatedAt automáticamente
);

module.exports = mongoose.model('Client', clientSchema);