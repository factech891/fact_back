// models/notification.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notificationSchema = new Schema({
    // Campo para Multiempresa
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: [true, 'La compañía es requerida'],
        index: true // Índice para búsquedas eficientes por compañía
    },
    
    // Tipo de notificación
    type: {
        type: String,
        required: [true, 'El tipo de notificación es requerido'],
        enum: {
            values: ['inventario_bajo', 'factura_vencida', 'pago_recibido', 'cotizacion_pendiente', 'sistema'],
            message: '{VALUE} no es un tipo válido de notificación'
        }
    },
    
    // Título de la notificación
    title: {
        type: String,
        required: [true, 'El título es requerido'],
        trim: true
    },
    
    // Descripción o detalle
    message: {
        type: String,
        required: [true, 'El mensaje es requerido'],
        trim: true
    },
    
    // Nivel de importancia
    severity: {
        type: String,
        enum: ['info', 'warning', 'error'],
        default: 'info'
    },
    
    // Estado de lectura
    read: {
        type: Boolean,
        default: false
    },
    
    // ID de referencia (producto, factura, etc.)
    referenceId: {
        type: Schema.Types.ObjectId,
        required: false
    },
    
    // Tipo de referencia
    referenceType: {
        type: String,
        enum: ['product', 'invoice', 'client', 'document', 'system'],
        required: false
    },
    
    // URL para navegación (opcional)
    link: {
        type: String,
        required: false,
        trim: true
    }
}, {
    timestamps: true // Agregar createdAt y updatedAt
});

// Índice compuesto para búsquedas eficientes
notificationSchema.index({ companyId: 1, read: 1 });
notificationSchema.index({ companyId: 1, type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);