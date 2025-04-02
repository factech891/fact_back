// models/client.model.js
const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    // Datos básicos
    nombre: { 
      type: String, 
      required: [true, 'El nombre es requerido'],
      trim: true
    },
    rif: { 
      type: String, 
      required: [true, 'El RIF/Cédula es requerido'], 
      unique: true,
      trim: true
    },
    tipoPersona: {
      type: String,
      enum: ['natural', 'juridica'],
      default: 'natural'
    },
    tipoCliente: {
      type: String,
      enum: ['regular', 'mayorista', 'premium', 'ocasional'],
      default: 'regular'
    },
    
    // Contacto
    email: { 
      type: String, 
      required: [true, 'El email es requerido'], 
      unique: true,
      trim: true,
      lowercase: true
    },
    telefono: { 
      type: String, 
      trim: true
    },
    telefonoAlt: {
      type: String,
      trim: true
    },
    sitioWeb: {
      type: String,
      trim: true
    },
    
    // Ubicación
    direccion: { 
      type: String, 
      trim: true
    },
    ciudad: {
      type: String,
      trim: true
    },
    estado: {
      type: String,
      trim: true
    },
    codigoPostal: {
      type: String,
      trim: true
    },
    
    // Comercial
    condicionesPago: {
      type: String,
      enum: ['contado', 'credito15', 'credito30', 'credito60'],
      default: 'contado'
    },
    diasCredito: {
      type: Number,
      default: 0,
      min: 0
    },
    limiteCredito: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Adicional
    sector: {
      type: String,
      trim: true
    },
    notas: {
      type: String,
      trim: true
    },
    
    // Campo para control interno
    activo: {
      type: Boolean,
      default: true
    }
  },
  { 
    timestamps: true // Agrega createdAt y updatedAt automáticamente
  }
);

module.exports = mongoose.model('Client', clientSchema);