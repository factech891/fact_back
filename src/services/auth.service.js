// services/auth.service.js
const crypto = require('crypto');
const User = require('../models/user.model');
const emailService = require('./email.service');

const authService = {
    // Función para generar un token aleatorio
    generateToken: () => {
        return crypto.randomBytes(32).toString('hex');
    },

    // Solicitar verificación de email
    requestEmailVerification: async (userId) => {
        try {
            const user = await User.findById(userId);
            if (!user) {
                // Considerar no lanzar error directamente si el controlador va a dar respuesta genérica
                // o lanzar un error específico que el controlador pueda manejar.
                throw new Error('Usuario no encontrado'); 
            }

            // Generar token y establecer tiempo de expiración (24 horas)
            const token = authService.generateToken();
            // En el modelo User, los campos son emailVerificationToken y emailVerificationTokenExpires
            user.emailVerificationToken = token; 
            user.emailVerificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 horas
            await user.save();

            // Crear enlace de verificación
            // Esta es la línea que se pide verificar y ya está correctamente configurada
            const verificationLink = `${process.env.FRONTEND_URL}/auth/verify-email/${token}`;

            // Enviar email de verificación
            await emailService.sendEmailVerificationEmail(user.email, {
                nombre: user.nombre,
                verificationLink
            });

            return true;
        } catch (error) {
            console.error('Error al solicitar verificación de email en authService:', error);
            // Propagar el error para que el controlador lo maneje
            throw error;
        }
    },

    // Verificar email con el token proporcionado
    verifyEmail: async (token) => {
        try {
            // Buscar usuario con token válido y no expirado
            // En el modelo User, los campos son emailVerificationToken y emailVerificationTokenExpires
            const user = await User.findOne({
                emailVerificationToken: token,
                emailVerificationTokenExpires: { $gt: Date.now() }
            });

            if (!user) {
                throw new Error('Token de verificación inválido o expirado');
            }

            // Marcar email como verificado y limpiar el token
            user.isEmailVerified = true;
            user.emailVerificationToken = undefined;
            user.emailVerificationTokenExpires = undefined;
            await user.save();

            // Enviar confirmación de email verificado
            await emailService.sendEmailVerifiedConfirmation(user.email, {
                nombre: user.nombre
            });

            return user; // Devolver el usuario verificado
        } catch (error) {
            console.error('Error al verificar email en authService:', error);
            throw error;
        }
    },

    // Solicitar reseteo de contraseña
    requestPasswordReset: async (email) => {
        try {
            const user = await User.findOne({ email });
            if (!user) {
                // Por seguridad, no revelar si el usuario existe o no directamente en el servicio.
                // El controlador maneja la respuesta genérica.
                // Si se lanza error aquí, el controlador debe saber cómo manejarlo para dar respuesta genérica.
                // console.log(`[AuthService-RequestPassReset] Usuario no encontrado para email: ${email}. No se enviará correo.`);
                return true; // Indicar éxito para que el controlador envíe respuesta genérica
            }
            
            // Adicional: Considerar si solo usuarios con email verificado pueden resetear contraseña
            if (!user.isEmailVerified) {
                // console.log(`[AuthService-RequestPassReset] Intento de reseteo para email no verificado: ${email}.`);
                // Podría reenviarse el correo de verificación o simplemente no proceder con el reseteo.
                // Por ahora, se procede igual que si el usuario no existiera para mantener la respuesta genérica del controller.
                return true;
            }

            // Generar token y establecer tiempo de expiración (1 hora)
            const token = authService.generateToken(); 
            // En el modelo User, los campos son resetPasswordToken y resetPasswordExpires
            user.resetPasswordToken = token;
            user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hora
            await user.save();

            // Crear enlace de reseteo
            const resetLink = `${process.env.FRONTEND_URL}/auth/reset-password/${token}`;

            // Enviar email con enlace de reseteo
            await emailService.sendPasswordResetEmail(user.email, resetLink);

            return true;
        } catch (error)
        {
            console.error('Error al solicitar reseteo de contraseña en authService:', error);
            throw error;
        }
    },

    // Resetear contraseña con el token proporcionado
    resetPassword: async (token, newPassword) => {
        try {
            // Buscar usuario con token válido y no expirado
            // En el modelo User, los campos son resetPasswordToken y resetPasswordExpires
            const user = await User.findOne({
                resetPasswordToken: token,
                resetPasswordExpires: { $gt: Date.now() }
            });

            if (!user) {
                throw new Error('Token de reseteo de contraseña inválido o expirado');
            }
            
            // Adicional: Verificar si el email está verificado (doble chequeo, aunque requestPasswordReset ya podría filtrarlo)
            if (!user.isEmailVerified) {
                 throw new Error('El correo electrónico debe estar verificado para restablecer la contraseña.');
            }

            // Actualizar contraseña y limpiar el token
            user.password = newPassword; // El pre-save hook en el modelo User se encargará del hashing
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();

            // Enviar confirmación de cambio de contraseña
            await emailService.sendPasswordChangedEmail(user.email);

            return true; // Indicar éxito
        } catch (error) {
            console.error('Error al resetear contraseña en authService:', error);
            // Si es un error de validación de Mongoose (ej. contraseña muy corta si se valida en el modelo)
            if (error.name === 'ValidationError') {
                // Re-lanzar para que el controlador pueda dar un mensaje más específico.
                throw error; 
            }
            throw error; // Propagar otros errores
        }
    }
};

module.exports = authService;