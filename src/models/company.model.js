// models/company.model.js (corregido default de trialEndDate)
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
        default: Date.now // Fecha/hora de creación del documento
      },
      trialEndDate: {
        type: Date,
        // CORRECCIÓN: Calcular el default basado en la fecha actual,
        // no depender de this.trialStartDate que puede no estar listo.
        default: function() {
          const trialDurationDays = 7; // Duración del trial en días
          const date = new Date(); // Fecha/hora actual
          date.setDate(date.getDate() + trialDurationDays);
          console.log(`Calculando trialEndDate default: ${date.toISOString()}`); // Log para verificar
          return date;
        }
      },
      subscriptionStartDate: Date, // Se establecerá cuando inicie una suscripción paga
      subscriptionEndDate: Date,   // Se establecerá cuando inicie una suscripción paga
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
      // Podrías añadir aquí campos como: lastPaymentDate, nextBillingDate, etc.
    },
    active: { // Para desactivar lógicamente una compañía si es necesario
      type: Boolean,
      default: true
    }
  },
  { timestamps: true } // Añade createdAt y updatedAt automáticamente
);

module.exports = mongoose.model('Company', companySchema);
