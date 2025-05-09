// models/user.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');

// --- URLs de Avatares Disponibles (puedes ponerlas aquí o en un archivo de config) ---
const defaultAvatarUrl = 'https://pub-c37b7a23aa9c49239d088e3e0a3ba275.r2.dev/Disen%CC%83o%20sin%20ti%CC%81tulo/1.png';

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
    resetPasswordExpires: Date,
    selectedAvatarUrl: {
        type: String,
        required: false, // No es obligatorio que el usuario elija uno
        trim: true,
        default: defaultAvatarUrl // Por defecto, mostramos el primer avatar
    },
    timezone: {
        type: String,
        default: '', // Sin valor predeterminado fijo
        required: false // Opcional a nivel usuario
    },
    // --- INICIO: Campos para verificación de email ---
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: String,
    emailVerificationTokenExpires: Date,
    // --- FIN: Campos para verificación de email ---
}, { timestamps: true });

// Método pre-save para hash de contraseña
userSchema.pre('save', async function(next) {
    // Solo hashear la contraseña si ha sido modificada (o es nueva)
    if (!this.isModified('password')) return next();
    
    // Asegurarse de no hashear si la contraseña está vacía o es inválida (aunque required:true debería prevenirlo)
    if (!this.password) return next(new Error('La contraseña no puede estar vacía antes de hashear.'));

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        console.error("Error hasheando contraseña:", error);
        next(error); // Pasar el error al siguiente middleware/guardado
    }
});


// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
    // Asegurarse de que hay una contraseña candidata y una contraseña hasheada para comparar
    if (!candidatePassword || !this.password) {
        return false;
    }
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        console.error("Error comparando contraseña:", error);
        // En caso de error en bcrypt (poco común), retornar false para seguridad
        return false; 
    }
};

// Índices
userSchema.index({ companyId: 1 }); // Índice para buscar por compañía
userSchema.index({ companyId: 1, role: 1 }); // Índice compuesto para buscar usuarios de una compañía por rol

userSchema.index({ emailVerificationToken: 1 }); // Índice para buscar por token de verificación de email


module.exports = mongoose.model('User', userSchema);