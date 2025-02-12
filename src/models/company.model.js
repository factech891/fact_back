// models/company.model.js
const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    nombre: { 
      type: String, 
      required: true 
    },
    rif: { 
      type: String, 
      required: true, 
      unique: true 
    },
    direccion: { 
      type: String, 
      required: false 
    },
    ciudad: { 
      type: String, 
      required: false 
    },
    estado: { 
      type: String, 
      required: false 
    },
    telefono: { 
      type: String, 
      required: false 
    },
    email: { 
      type: String, 
      required: true 
    },
    logoUrl: { 
      type: String, 
      required: false 
    },
    logoId: { 
      type: String, 
      required: false 
    },
    // Configuración de facturas como campos simples
    temaFactura: { 
      type: String, 
      enum: ['classic', 'modern', 'minimal'],
      default: 'classic' 
    },
    colorPrimario: { 
      type: String, 
      default: '#1976d2' 
    },
    colorSecundario: { 
      type: String, 
      default: '#424242' 
    },
    tamanoFuente: { 
      type: String, 
      enum: ['small', 'medium', 'large'],
      default: 'medium' 
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);