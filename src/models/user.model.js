// models/user.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');

const userSchema = new Schema({
    nombre: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'facturador', 'visor'],
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
    // Solo hacer hash de la contraseña si es nueva o fue modificada
    if (!this.isModified('password')) return next();
    
    try {
        // Generar un salt
        const salt = await bcrypt.genSalt(10);
        // Hash contraseña con salt
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);