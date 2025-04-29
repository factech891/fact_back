// models/notification.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notificationSchema = new Schema({
    // Campo para Multiempresa
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: [true, 'La compañía es requerida'],
        index: true
    },

    // Tipo de notificación (Enum actualizado)
    type: {
        type: String,
        required: [true, 'El tipo de notificación es requerido'],
        enum: {
            // Añadidos tipos genéricos + tipo específico para admin
            values: [
                'inventario_bajo', 'factura_vencida', 'pago_recibido',
                'cotizacion_pendiente', 'sistema', 'admin_message', // Tipo específico para admin
                'info', 'warning', 'error', 'success' // Tipos genéricos
            ],
            message: '{VALUE} no es un tipo válido de notificación'
        },
        default: 'info' // Mantener 'info' como default general
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

    // Nivel de importancia (opcional, puede coincidir con 'type' a veces)
    severity: {
        type: String,
        enum: ['info', 'warning', 'error', 'success'], // Añadir success aquí también
        default: 'info'
    },

    // Estado de lectura
    read: {
        type: Boolean,
        default: false
    },

    // --- NUEVO: Quién creó la notificación ---
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User', // Referencia al modelo User
        required: false // Puede ser opcional si el sistema también crea notificaciones
    },

    // --- NUEVO: Identificador de notificación de admin ---
    isPlatformAdminNotification: {
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
        // Añadir 'user' o 'company' si es necesario referenciar eso
        enum: ['product', 'invoice', 'client', 'document', 'system', 'user', 'company'],
        required: false
    },

    // URL para navegación (opcional)
    link: {
        type: String,
        required: false,
        trim: true
    },

    // Fecha de lectura y quién leyó (NUEVO/MEJORADO)
    readAt: {
        type: Date,
        required: false
    },
    readBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },


    // Campo expira automáticamente
    expiresAt: {
        type: Date,
        default: function() {
            const date = new Date();
            date.setDate(date.getDate() + 60); // 60 días por defecto
            return date;
        },
        index: { expires: 0 }
    }
}, {
    timestamps: true // Agregar createdAt y updatedAt
});

// Índices compuestos
notificationSchema.index({ companyId: 1, read: 1 });
notificationSchema.index({ companyId: 1, type: 1 });

// Middleware para ajustar expiración (sin cambios necesarios aquí)
notificationSchema.pre('save', function(next) {
    const now = new Date();
    if (this.isNew || this.isModified('read')) {
        if (this.read) {
            this.expiresAt = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 días leídas
        } else {
            this.expiresAt = new Date(now.getTime() + (60 * 24 * 60 * 60 * 1000)); // 60 días no leídas
        }
    }
    // Asegurar que la severidad coincida con el tipo si es uno de los genéricos
    if (['info', 'warning', 'error', 'success'].includes(this.type)) {
        this.severity = this.type;
    } else if (this.type === 'admin_message' && !this.severity) {
        // Si es mensaje de admin y no se especificó severidad, usar 'info'
        this.severity = 'info';
    }

    next();
});

module.exports = mongoose.model('Notification', notificationSchema);