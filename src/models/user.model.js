// models/user.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');

const userSchema = new Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true, // Esto ya crea un índice único en email
        trim: true,
        lowercase: true,
        match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Por favor, introduce un email válido']
    },
    password: {
        type: String,
        required: true
        // minlength: [6, 'La contraseña debe tener al menos 6 caracteres']
    },
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    role: {
        type: String,
        enum: {
            values: ['admin', 'manager', 'facturador', 'visor', 'platform_admin'],
            message: 'El rol {VALUE} no es válido. Roles permitidos: admin, manager, facturador, visor, platform_admin'
        },
        required: [true, 'El rol es requerido'],
        default: 'visor'
    },
    active: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date
}, { timestamps: true });

// Método pre-save para hash de contraseña
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        console.error("Error comparando contraseña:", error);
        return false;
    }
};

// Añadir índices para mejorar rendimiento de búsquedas comunes
// userSchema.index({ email: 1 }); // <-- ELIMINADO: Ya se crea por unique: true
userSchema.index({ companyId: 1 }); // Índice para buscar por compañía
userSchema.index({ companyId: 1, role: 1 }); // Índice compuesto para buscar usuarios de una compañía por rol


module.exports = mongoose.model('User', userSchema);