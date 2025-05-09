// controllers/auth.controller.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model'); // Asegúrate que la ruta sea correcta
const Company = require('../models/company.model'); // Asegúrate que la ruta sea correcta
const mongoose = require('mongoose'); // Necesario para validar ObjectId
const crypto = require('crypto');
const emailService = require('../services/email.service'); // Asegúrate que este servicio existe y está configurado
const authService = require('../services/auth.service'); // Importar el servicio de autenticación

const authController = {
    /**
     * Registrar una nueva compañía y su usuario administrador.
     */
    register: async (req, res) => {
        console.log("--- Entrando a authController.register ---");
        try {
            const { company, user } = req.body;

            // Validaciones básicas de entrada
            if (!company || !user || !company.rif || !company.email || !user.email || !user.password || !company.nombre || !user.nombre) {
                return res.status(400).json({ success: false, message: 'Faltan datos requeridos para el registro (empresa o usuario).' });
            }

            // Verificar si ya existe la compañía o el usuario
            const existingCompany = await Company.findOne({ rif: company.rif }).lean(); // lean para eficiencia
            if (existingCompany) {
                console.warn(`[Register] Intento de registro con RIF duplicado: ${company.rif}`);
                return res.status(400).json({ success: false, message: 'Ya existe una empresa registrada con este RIF.' });
            }
            const existingUser = await User.findOne({ email: user.email }).lean(); // lean para eficiencia
            if (existingUser) {
                console.warn(`[Register] Intento de registro con email duplicado: ${user.email}`);
                return res.status(400).json({ success: false, message: 'Ya existe un usuario registrado con este email.' });
            }

            // Crear nueva compañía (añadiendo timezone)
            const newCompany = new Company({
                nombre: company.nombre,
                rif: company.rif,
                direccion: company.direccion || '',
                ciudad: company.ciudad || '',
                estado: company.estado || '',
                telefono: company.telefono || '',
                email: company.email,
                timezone: company.timezone || 'UTC', // Usar la zona horaria proporcionada o UTC por defecto
                // La suscripción se inicializa con los defaults del modelo (trial, etc.)
            });
            const savedCompany = await newCompany.save();
            console.log(`[Register] Compañía creada con ID: ${savedCompany._id}`);

            // Crear usuario administrador asociado (añadiendo timezone)
            const adminUser = new User({
                nombre: user.nombre,
                email: user.email,
                password: user.password, // Hashing ocurre en pre-save hook
                companyId: savedCompany._id,
                role: 'admin', // Rol por defecto para el primer usuario
                active: true, // Activo por defecto (aunque el email no esté verificado, el usuario puede existir)
                timezone: company.timezone || 'UTC', // Heredar de la compañía
                // isEmailVerified default es false
            });
            const savedUser = await adminUser.save();
            console.log(`[Register] Usuario admin creado con ID: ${savedUser._id} para Compañía ${savedCompany._id}`);

            // Enviar correo de verificación de email
            await authService.requestEmailVerification(savedUser._id);
            console.log(`[Register] Correo de verificación enviado a: ${savedUser.email}`);

            // Generar token JWT (opcionalmente, se podría generar el token solo después de la verificación de email,
            // pero es común devolverlo para que el frontend pueda gestionar el estado "pendiente de verificación")
            const tokenPayload = {
                userId: savedUser._id,
                companyId: savedCompany._id,
                role: savedUser.role
            };
            const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });
            console.log("[Register] Token JWT generado.");

            // Preparar respuesta
            res.status(201).json({
                success: true,
                message: 'Registro exitoso. Se ha enviado un correo de verificación.',
                user: { id: savedUser._id, nombre: savedUser.nombre, email: savedUser.email, role: savedUser.role, isEmailVerified: savedUser.isEmailVerified },
                company: { id: savedCompany._id, nombre: savedCompany.nombre, rif: savedCompany.rif },
                subscription: {
                    plan: savedCompany.subscription.plan,
                    status: savedCompany.subscription.status,
                    endDate: savedCompany.subscription.trialEndDate
                },
                token
            });

        } catch (error) {
            console.error('[Register] Error en registro:', error);
            if (error.name === 'ValidationError') {
                 const errors = Object.values(error.errors).map(el => el.message);
                 return res.status(400).json({ success: false, message: `Error de validación: ${errors.join(', ')}` });
            }
            res.status(500).json({
                 success: false,
                 message: 'Error interno del servidor durante el registro.'
            });
        }
    },

    /**
     * Iniciar sesión de un usuario existente.
     */
    login: async (req, res) => {
        console.log("--- Entrando a authController.login ---");
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                 return res.status(400).json({ success: false, message: 'Email y contraseña son requeridos.' });
            }

            console.log(`[Login] Intentando login para email: ${email}`);
            const user = await User.findOne({ email }).select('+password');

            if (!user) {
                console.warn(`[Login] Fallido: Usuario no encontrado para ${email}`);
                return res.status(401).json({ success: false, message: 'Usuario no existe o credenciales incorrectas.' }); // Mensaje genérico
            }

            if (!(await user.comparePassword(password))) {
                console.warn(`[Login] Fallido: Contraseña incorrecta para ${email}`);
                return res.status(401).json({ success: false, message: 'Usuario no existe o credenciales incorrectas.' }); // Mensaje genérico
            }

            // Verificar si el email está verificado
            if (!user.isEmailVerified) {
                console.warn(`[Login] Fallido: Email no verificado para ${email}`);
                return res.status(401).json({ 
                    success: false, 
                    message: 'Por favor, verifica tu correo electrónico antes de iniciar sesión.',
                    needsVerification: true // Flag para el frontend
                });
            }

            if (!user.active) {
                 console.warn(`[Login] Fallido: Usuario ${email} está desactivado.`);
                 return res.status(403).json({ success: false, message: 'Usuario desactivado. Contacte al administrador.' });
            }

            const company = await Company.findById(user.companyId);
            if (!company) {
                console.error(`[Login] Error crítico: Empresa asociada no encontrada para usuario ${user._id} (CompanyID: ${user.companyId})`);
                return res.status(404).json({ success: false, message: 'Error: Empresa asociada no encontrada.' });
            }

            if (!company.active) {
                console.warn(`[Login] Fallido: Empresa ${company.nombre} (ID: ${company._id}) está desactivada.`);
                return res.status(403).json({ success: false, message: 'La empresa asociada a su cuenta está desactivada.' });
            }

            User.updateOne({ _id: user._id }, { lastLogin: new Date() }).catch(err => console.error("Error actualizando lastLogin:", err));

            const tokenPayload = {
                userId: user._id,
                companyId: company._id,
                role: user.role
            };
            const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });
            console.log("[Login] Token JWT generado.");

            res.json({
                success: true,
                message: 'Login exitoso',
                user: { id: user._id, nombre: user.nombre, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified, selectedAvatarUrl: user.selectedAvatarUrl },
                company: { id: company._id, nombre: company.nombre, rif: company.rif, logoUrl: company.logoUrl },
                subscription: company.subscription ? {
                    plan: company.subscription.plan,
                    status: company.subscription.status,
                    endDate: company.subscription.status === 'trial' ? company.subscription.trialEndDate : company.subscription.subscriptionEndDate
                } : null,
                token
            });

        } catch (error) {
            console.error('[Login] Error en login:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor durante el login.' });
        }
    },

    /**
     * Solicitar restablecimiento de contraseña.
     */
    forgotPassword: async (req, res) => {
        console.log("--- Entrando a authController.forgotPassword ---");
        try {
            const { email } = req.body;
            if (!email) {
                 return res.status(400).json({ success: false, message: 'El email es requerido.' });
            }

            console.log(`[ForgotPassword] Solicitud para email: ${email}`);
            const user = await User.findOne({ email });

            // Modificación: Verificar si el email está verificado antes de permitir el reseteo
            // Se usa un mensaje genérico para no revelar si el email existe o su estado de verificación.
            const genericMessage = 'Si existe una cuenta con ese email y está verificada, se ha enviado un enlace de recuperación.';

            if (!user) {
                console.log(`[ForgotPassword] Usuario no encontrado para email: ${email}. Respondiendo genéricamente.`);
                return res.json({ success: true, message: genericMessage });
            }

            // Verificar si el email está verificado
            if (!user.isEmailVerified) {
                console.log(`[ForgotPassword] Solicitud para email no verificado: ${email}. Respondiendo genéricamente sin enviar enlace de reseteo.`);
                // Opcionalmente, aquí se podría reenviar el correo de verificación si no ha pasado mucho tiempo desde el último.
                // await authService.requestEmailVerification(user._id); // Descomentar si se desea este comportamiento
                return res.json({ success: true, message: genericMessage }); // Devolver mensaje genérico
            }

            // Si el usuario existe Y su email está verificado, proceder.
            const resetToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

            user.resetPasswordToken = tokenHash;
            user.resetPasswordExpires = Date.now() + 3600000; // 1 hora de validez
            await user.save();
            console.log(`[ForgotPassword] Token de reseteo generado y guardado para usuario verificado: ${user.email}`);

            const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
            await emailService.sendPasswordResetEmail(user.email, resetLink);
            console.log(`[ForgotPassword] Email de reseteo enviado a: ${user.email}`);

            res.json({ success: true, message: genericMessage });

        } catch (error) {
            console.error('[ForgotPassword] Error en recuperación de contraseña:', error);
            res.status(500).json({ success: false, message: 'Error al procesar la solicitud de recuperación.' });
        }
    },

    /**
     * Restablecer contraseña usando el token.
     */
    resetPassword: async (req, res) => {
        console.log("--- Entrando a authController.resetPassword ---");
        try {
            const { token, newPassword } = req.body;
            if (!token || !newPassword) {
                 return res.status(400).json({ success: false, message: 'Token y nueva contraseña son requeridos.' });
            }
            if (newPassword.length < 6) {
                return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
            }

            const resetPasswordTokenHash = crypto.createHash('sha256').update(token).digest('hex');
            console.log(`[ResetPassword] Buscando usuario con hash de token y fecha válida.`);

            const user = await User.findOne({
                resetPasswordToken: resetPasswordTokenHash,
                resetPasswordExpires: { $gt: Date.now() }
            });

            if (!user) {
                console.warn(`[ResetPassword] Token inválido o expirado.`);
                return res.status(400).json({ success: false, message: 'El enlace de recuperación es inválido o ha expirado.' });
            }

            // Adicionalmente, asegurar que el email esté verificado (aunque forgotPassword ya lo hace, es una doble verificación)
            if (!user.isEmailVerified) {
                console.warn(`[ResetPassword] Intento de reseteo para email no verificado: ${user.email}. Token: ${token}`);
                return res.status(400).json({ success: false, message: 'Debes verificar tu correo electrónico antes de cambiar la contraseña.' });
            }

            user.password = newPassword;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
            console.log(`[ResetPassword] Contraseña actualizada para usuario: ${user.email}`);

            try {
                await emailService.sendPasswordChangedEmail(user.email);
                console.log(`[ResetPassword] Email de confirmación de cambio enviado a: ${user.email}`);
            } catch (emailError) {
                console.error("[ResetPassword] Error enviando email de confirmación:", emailError);
            }

            res.json({ success: true, message: 'Contraseña actualizada correctamente.' });

        } catch (error) {
            console.error('[ResetPassword] Error en reset de contraseña:', error);
             if (error.name === 'ValidationError') {
                 const errors = Object.values(error.errors).map(el => el.message);
                 return res.status(400).json({ success: false, message: `Error de validación: ${errors.join(', ')}` });
             }
            res.status(500).json({ success: false, message: 'Error interno al restablecer la contraseña.' });
        }
    },

    /**
     * Obtener la información del usuario actualmente autenticado.
     */
    getMe: async (req, res) => {
        console.log("--- Entrando a authController.getMe ---");
        try {
            const userId = req.user?.id;
            console.log(`[getMe] ID de usuario obtenido de req.user: ${userId}`);

            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                 console.log("[getMe] No se encontró un ID válido en req.user. Token inválido o middleware falló?");
                 return res.status(401).json({ success: false, message: 'No autenticado o información de sesión inválida.' });
            }

            const user = await User.findById(userId)
                                   .select('-password')
                                   .populate('companyId', 'nombre rif logoUrl subscription');
            console.log("[getMe] Resultado de User.findById:", user ? `Encontrado (${user.email})` : "NO Encontrado");

            if (!user) {
                console.log(`[getMe] Usuario con ID ${userId} no encontrado en BD. Devolviendo 404.`);
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }

            const company = user.companyId;
            console.log("[getMe] Compañía poblada:", company ? `Encontrada (${company.nombre})` : "NO Encontrada (o error de población)");

            if (!company) {
                 console.log(`[getMe] Compañía no poblada o no encontrada para usuario ${userId}. Devolviendo 404.`);
                return res.status(404).json({ success: false, message: 'Empresa asociada no encontrada o inconsistencia de datos' });
            }

            const subscriptionInfo = company.subscription;
            console.log("[getMe] Datos encontrados. Enviando respuesta 200 OK.");

            res.json({
                success: true,
                user: { id: user._id.toString(), nombre: user.nombre, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified, selectedAvatarUrl: user.selectedAvatarUrl, timezone: user.timezone },
                company: { id: company._id.toString(), nombre: company.nombre, rif: company.rif, logoUrl: company.logoUrl, timezone: company.timezone },
                subscription: subscriptionInfo ? {
                    plan: subscriptionInfo.plan,
                    status: subscriptionInfo.status,
                    endDate: subscriptionInfo.status === 'trial' ? subscriptionInfo.trialEndDate : subscriptionInfo.subscriptionEndDate
                } : null
            });
        } catch (error) {
            console.error('[getMe] Error al obtener información del usuario:', error);
            res.status(500).json({ success: false, message: 'Error interno al obtener información del usuario' });
        }
    },

    /**
     * Cambiar la contraseña del usuario autenticado.
     */
    changePassword: async (req, res) => {
        console.log("--- Entrando a authController.changePassword ---");
        try {
            const { currentPassword, newPassword } = req.body;
            if (!currentPassword || !newPassword) {
                 return res.status(400).json({ success: false, message: 'Contraseña actual y nueva son requeridas.' });
            }
            if (newPassword.length < 6) {
                return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
            }

            const userId = req.user?.id;
            console.log(`[ChangePassword] Solicitud para usuario ID: ${userId}`);

            if(!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                 console.log("[ChangePassword] No se encontró un ID válido en req.user.");
                 return res.status(401).json({ success: false, message: 'No autenticado o información de sesión inválida.' });
            }

            const user = await User.findById(userId).select('+password');
            if (!user) {
                 console.log(`[ChangePassword] Usuario no encontrado en BD con ID: ${userId}`);
                 return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }

            // Asegurar que el email esté verificado para cambiar la contraseña
            if (!user.isEmailVerified) {
                 console.warn(`[ChangePassword] Intento de cambio de contraseña para email no verificado: ${user.email}`);
                 return res.status(403).json({ success: false, message: 'Debes verificar tu correo electrónico para poder cambiar la contraseña.', needsVerification: true });
            }

            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) {
                 console.warn(`[ChangePassword] Contraseña actual incorrecta para usuario: ${user.email}`);
                 return res.status(400).json({ success: false, message: 'Contraseña actual incorrecta' });
            }

            user.password = newPassword;
            await user.save();
            console.log(`[ChangePassword] Contraseña actualizada para usuario: ${user.email}`);

             try {
                await emailService.sendPasswordChangedEmail(user.email);
                console.log(`[ChangePassword] Email de confirmación de cambio enviado a: ${user.email}`);
            } catch (emailError) {
                console.error("[ChangePassword] Error enviando email de confirmación:", emailError);
            }

            res.json({ success: true, message: 'Contraseña actualizada correctamente' });
        } catch (error) {
            console.error('[ChangePassword] Error al cambiar contraseña:', error);
             if (error.name === 'ValidationError') {
                 const errors = Object.values(error.errors).map(el => el.message);
                 return res.status(400).json({ success: false, message: `Error de validación: ${errors.join(', ')}` });
             }
            res.status(500).json({ success: false, message: 'Error interno al cambiar contraseña' });
        }
    },

    /**
     * Solicitar un nuevo correo de verificación.
     */
    requestEmailVerification: async (req, res) => {
        console.log("--- Entrando a authController.requestEmailVerification ---");
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ success: false, message: 'El email es requerido.' });
            }

            console.log(`[RequestEmailVerification] Solicitud para email: ${email}`);
            const user = await User.findOne({ email });

            // Mensaje genérico para no revelar existencia o estado de verificación del email
            const genericMessage = 'Si existe una cuenta con ese email y aún no ha sido verificada, se ha enviado un nuevo enlace de verificación.';

            if (!user) {
                console.log(`[RequestEmailVerification] Usuario no encontrado para email: ${email}. Respondiendo genéricamente.`);
                return res.json({ success: true, message: genericMessage });
            }

            if (user.isEmailVerified) {
                console.log(`[RequestEmailVerification] Email ya verificado para: ${email}`);
                return res.json({ success: true, message: 'Tu correo electrónico ya ha sido verificado.' });
            }

            // Usar el servicio de autenticación para generar y enviar el correo
            await authService.requestEmailVerification(user._id);
            console.log(`[RequestEmailVerification] Nuevo correo de verificación potencialmente enviado a: ${email}`);

            res.json({ success: true, message: genericMessage });
        } catch (error) {
            console.error('[RequestEmailVerification] Error:', error);
            res.status(500).json({ success: false, message: 'Error al procesar la solicitud de verificación.' });
        }
    },

    /**
     * Verificar email usando el token.
     */
    verifyEmail: async (req, res) => {
        console.log("--- Entrando a authController.verifyEmail ---");
        try {
            // Usualmente el token vendría en req.params si la ruta es ej: /verify-email/:token
            // o en req.query si es /verify-email?token=TOKEN
            // El prompt indica req.params
            const { token } = req.params; 
            if (!token) {
                return res.status(400).json({ success: false, message: 'Token de verificación es requerido.' });
            }

            console.log(`[VerifyEmail] Verificando token: ${token ? token.substring(0, 10) + '...' : 'TOKEN NO PROPORCIONADO'}`);
            try {
                const user = await authService.verifyEmail(token); // authService.verifyEmail debe manejar la lógica del token
                console.log(`[VerifyEmail] Email verificado con éxito para usuario: ${user.email}`);
                
                // Opcional: Enviar confirmación de email verificado
                // await emailService.sendEmailVerifiedConfirmation(user.email, { nombre: user.nombre });

                res.json({ 
                    success: true, 
                    message: 'Correo electrónico verificado correctamente. Ahora puedes iniciar sesión.'
                });
            } catch (verifyError) {
                // authService.verifyEmail debería lanzar un error específico si el token es inválido/expirado
                console.warn(`[VerifyEmail] Error al verificar token: ${verifyError.message}`);
                // El mensaje debe ser genérico para el cliente
                res.status(400).json({ success: false, message: 'El enlace de verificación es inválido o ha expirado.' });
            }
        } catch (error) {
            console.error('[VerifyEmail] Error:', error);
            res.status(500).json({ success: false, message: 'Error interno al verificar correo electrónico.' });
        }
    }
};

module.exports = authController;