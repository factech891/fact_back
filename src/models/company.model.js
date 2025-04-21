// models/company.model.js (modificado)
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
    localFilePath: { 
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
    },
    // Campos nuevos para suscripción
    subscription: {
      plan: {
        type: String,
        enum: ['free', 'basic', 'premium'],
        default: 'free'
      },
      status: {
        type: String,
        enum: ['trial', 'active', 'expired', 'cancelled'],
        default: 'trial'
      },
      trialStartDate: {
        type: Date,
        default: Date.now
      },
      trialEndDate: {
        type: Date,
        default: function() {
          // Trial de 7 días
          const date = new Date(this.trialStartDate);
          date.setDate(date.getDate() + 7);
          return date;
        }
      },
      subscriptionStartDate: Date,
      subscriptionEndDate: Date,
      paymentMethod: {
        type: String,
        enum: ['credit_card', 'bank_transfer', 'none'],
        default: 'none'
      },
      paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'none'],
        default: 'none'
      }
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);