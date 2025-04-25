// controllers/auth.controller.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model'); // Asegúrate que la ruta sea correcta
const Company = require('../models/company.model'); // Asegúrate que la ruta sea correcta
const mongoose = require('mongoose'); // Necesario para validar ObjectId
const crypto = require('crypto');
const emailService = require('../services/email.service'); // Asegúrate que este servicio existe y está configurado

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

            // Crear nueva compañía (asegurando valores por defecto si no vienen)
            const newCompany = new Company({
                nombre: company.nombre,
                rif: company.rif,
                direccion: company.direccion || '',
                ciudad: company.ciudad || '',
                estado: company.estado || '',
                telefono: company.telefono || '',
                email: company.email,
                // La suscripción se inicializa con los defaults del modelo (trial, etc.)
            });
            const savedCompany = await newCompany.save();
            console.log(`[Register] Compañía creada con ID: ${savedCompany._id}`);

            // Crear usuario administrador asociado
            const adminUser = new User({
                nombre: user.nombre,
                email: user.email,
                password: user.password, // Hashing ocurre en pre-save hook
                companyId: savedCompany._id,
                role: 'admin', // Rol por defecto para el primer usuario
                active: true // Activo por defecto
            });
            const savedUser = await adminUser.save();
            console.log(`[Register] Usuario admin creado con ID: ${savedUser._id} para Compañía ${savedCompany._id}`);

            // Generar token JWT
            const tokenPayload = {
                userId: savedUser._id, // Usar _id de Mongoose
                companyId: savedCompany._id,
                role: savedUser.role
            };
            const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });
            console.log("[Register] Token JWT generado.");

            // Preparar respuesta
            res.status(201).json({
                success: true,
                message: 'Registro exitoso',
                // Devolver solo información necesaria y segura
                user: { id: savedUser._id, nombre: savedUser.nombre, email: savedUser.email, role: savedUser.role },
                company: { id: savedCompany._id, nombre: savedCompany.nombre, rif: savedCompany.rif },
                subscription: { // Datos de la suscripción inicial (del modelo Company)
                    plan: savedCompany.subscription.plan,
                    status: savedCompany.subscription.status,
                    endDate: savedCompany.subscription.trialEndDate // Fecha fin del trial
                },
                token
            });

        } catch (error) {
            console.error('[Register] Error en registro:', error);
            // Manejar errores de validación de Mongoose
            if (error.name === 'ValidationError') {
                 const errors = Object.values(error.errors).map(el => el.message);
                 return res.status(400).json({ success: false, message: `Error de validación: ${errors.join(', ')}` });
            }
            res.status(500).json({
                 success: false,
                 message: 'Error interno del servidor durante el registro.'
                 // error: error.message // Opcional para depuración en desarrollo
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
            // Buscar usuario por email (incluir contraseña para comparar)
            const user = await User.findOne({ email }).select('+password'); // Incluir password explícitamente

            // Validar usuario y contraseña
            if (!user || !(await user.comparePassword(password))) {
                console.warn(`[Login] Fallido: Email o contraseña incorrectos para ${email}`);
                return res.status(401).json({ success: false, message: 'Email o contraseña incorrectos' });
            }

            // Verificar si el usuario está activo
            if (!user.active) {
                 console.warn(`[Login] Fallido: Usuario ${email} está desactivado.`);
                 return res.status(403).json({ success: false, message: 'Usuario desactivado. Contacte al administrador.' });
            }

            console.log(`[Login] Usuario encontrado: ${user.email}, ID: ${user._id}, CompanyID: ${user.companyId}`);
            // Buscar compañía asociada
            const company = await Company.findById(user.companyId);
            if (!company) {
                // Esto indica una inconsistencia de datos (usuario sin compañía válida)
                console.error(`[Login] Error crítico: Empresa asociada no encontrada para usuario ${user._id} (CompanyID: ${user.companyId})`);
                return res.status(404).json({ success: false, message: 'Error: Empresa asociada no encontrada.' });
            }

            // Verificar si la compañía está activa
            if (!company.active) {
                console.warn(`[Login] Fallido: Empresa ${company.nombre} (ID: ${company._id}) está desactivada.`);
                return res.status(403).json({ success: false, message: 'La empresa asociada a su cuenta está desactivada.' });
            }

            console.log(`[Login] Compañía encontrada: ${company.nombre}, ID: ${company._id}`);
            const subscriptionInfo = company.subscription; // Obtener info de suscripción embebida

            // Actualizar fecha de último login (sin esperar la operación)
            User.updateOne({ _id: user._id }, { lastLogin: new Date() }).catch(err => console.error("Error actualizando lastLogin:", err));


            // Generar token JWT
            const tokenPayload = {
                userId: user._id,
                companyId: company._id,
                role: user.role
            };
            const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });
            console.log("[Login] Token JWT generado.");

            // Enviar respuesta exitosa
            res.json({
                success: true,
                message: 'Login exitoso',
                user: { id: user._id, nombre: user.nombre, email: user.email, role: user.role },
                company: { id: company._id, nombre: company.nombre, rif: company.rif, logoUrl: company.logoUrl },
                subscription: subscriptionInfo ? {
                    plan: subscriptionInfo.plan,
                    status: subscriptionInfo.status,
                    // Determinar fecha de fin relevante (trial o suscripción)
                    endDate: subscriptionInfo.status === 'trial' ? subscriptionInfo.trialEndDate : subscriptionInfo.subscriptionEndDate
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

            // Siempre devolver éxito para no revelar si un email existe o no
            if (!user) {
                console.log(`[ForgotPassword] Usuario no encontrado para email: ${email}. Respondiendo genéricamente.`);
                return res.json({ success: true, message: 'Si existe una cuenta con ese email, se ha enviado un enlace de recuperación.' });
            }

            // Generar token de reseteo seguro
            const resetToken = crypto.randomBytes(32).toString('hex'); // Token más largo
            const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex'); // Guardar hash en BD

            user.resetPasswordToken = tokenHash;
            user.resetPasswordExpires = Date.now() + 3600000; // 1 hora de validez
            await user.save();
            console.log(`[ForgotPassword] Token de reseteo generado y guardado para usuario: ${user.email}`);

            // Enviar email con el token original (no el hash)
            // Asegúrate que FRONTEND_URL esté configurado en .env
            const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
            await emailService.sendPasswordResetEmail(user.email, resetLink);
            console.log(`[ForgotPassword] Email de reseteo enviado a: ${user.email}`);

            res.json({ success: true, message: 'Si existe una cuenta con ese email, se ha enviado un enlace de recuperación.' });

        } catch (error) {
            console.error('[ForgotPassword] Error en recuperación de contraseña:', error);
            // Evitar exponer detalles del error al cliente
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
            // Validar longitud mínima de contraseña (ejemplo)
            if (newPassword.length < 6) {
                return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
            }


            // Hashear el token recibido para buscar en la BD
            const resetPasswordTokenHash = crypto.createHash('sha256').update(token).digest('hex');
            console.log(`[ResetPassword] Buscando usuario con hash de token y fecha válida.`);

            // Buscar usuario con el hash del token y que no haya expirado
            const user = await User.findOne({
                resetPasswordToken: resetPasswordTokenHash,
                resetPasswordExpires: { $gt: Date.now() } // Verificar que la fecha de expiración sea mayor que ahora
            });

            if (!user) {
                console.warn(`[ResetPassword] Token inválido o expirado.`);
                return res.status(400).json({ success: false, message: 'El enlace de recuperación es inválido o ha expirado.' });
            }

            // Actualizar contraseña (el hash se hace en pre-save)
            user.password = newPassword;
            // Limpiar campos de reseteo
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
            console.log(`[ResetPassword] Contraseña actualizada para usuario: ${user.email}`);

            // Enviar email de confirmación (opcional pero recomendado)
            try {
                await emailService.sendPasswordChangedEmail(user.email);
                console.log(`[ResetPassword] Email de confirmación de cambio enviado a: ${user.email}`);
            } catch (emailError) {
                console.error("[ResetPassword] Error enviando email de confirmación:", emailError);
                // No fallar la operación principal si el email falla
            }


            res.json({ success: true, message: 'Contraseña actualizada correctamente.' });

        } catch (error) {
            console.error('[ResetPassword] Error en reset de contraseña:', error);
             if (error.name === 'ValidationError') { // Capturar errores de validación del modelo User
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
        console.log("--- Entrando a authController.getMe ---"); // Log 1
        try {
            // req.user es establecido por el middleware authenticateToken
            // CORRECCIÓN: Acceder a req.user.id (establecido por el middleware)
            const userId = req.user?.id; // <---- CORRECCIÓN APLICADA AQUÍ
            console.log(`[getMe] ID de usuario obtenido de req.user: ${userId}`); // Log 2

            // Validar que el ID exista y sea un ObjectId válido
            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                 console.log("[getMe] No se encontró un ID válido en req.user. Token inválido o middleware falló?");
                 return res.status(401).json({ success: false, message: 'No autenticado o información de sesión inválida.' });
            }

            // Buscar el usuario completo en la BD (excluyendo el password)
            const user = await User.findById(userId)
                                   .select('-password') // Excluir contraseña
                                   .populate('companyId', 'nombre rif logoUrl subscription'); // Poblar compañía y su suscripción
            console.log("[getMe] Resultado de User.findById:", user ? `Encontrado (${user.email})` : "NO Encontrado"); // Log 3

            if (!user) {
                console.log(`[getMe] Usuario con ID ${userId} no encontrado en BD. Devolviendo 404.`);
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }

            // La compañía ya viene poblada
            const company = user.companyId; // Acceder al objeto poblado
            console.log("[getMe] Compañía poblada:", company ? `Encontrada (${company.nombre})` : "NO Encontrada (o error de población)"); // Log 5

            if (!company) {
                 console.log(`[getMe] Compañía no poblada o no encontrada para usuario ${userId}. Devolviendo 404.`);
                 // Si la compañía fue borrada pero el usuario no, esto puede pasar
                return res.status(404).json({ success: false, message: 'Empresa asociada no encontrada o inconsistencia de datos' });
            }

            // Usar suscripción poblada desde la compañía
            const subscriptionInfo = company.subscription;
            console.log("[getMe] Datos encontrados. Enviando respuesta 200 OK."); // Log 6

            res.json({
                success: true,
                // Devolver ID como string
                user: { id: user._id.toString(), nombre: user.nombre, email: user.email, role: user.role },
                company: { id: company._id.toString(), nombre: company.nombre, rif: company.rif, logoUrl: company.logoUrl },
                subscription: subscriptionInfo ? {
                    plan: subscriptionInfo.plan,
                    status: subscriptionInfo.status,
                    endDate: subscriptionInfo.status === 'trial' ? subscriptionInfo.trialEndDate : subscriptionInfo.subscriptionEndDate
                } : null
            });
        } catch (error) {
            console.error('[getMe] Error al obtener información del usuario:', error); // Log 7
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
             // Validar longitud mínima de nueva contraseña
            if (newPassword.length < 6) {
                return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
            }

            // CORRECCIÓN: Usar req.user.id
            const userId = req.user?.id; // <---- CORRECCIÓN APLICADA AQUÍ
            console.log(`[ChangePassword] Solicitud para usuario ID: ${userId}`);

            if(!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                 console.log("[ChangePassword] No se encontró un ID válido en req.user.");
                 return res.status(401).json({ success: false, message: 'No autenticado o información de sesión inválida.' });
            }

            // Buscar usuario incluyendo la contraseña para comparar
            const user = await User.findById(userId).select('+password');
            if (!user) {
                 console.log(`[ChangePassword] Usuario no encontrado en BD con ID: ${userId}`);
                 return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }

            // Comparar contraseña actual
            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) {
                 console.warn(`[ChangePassword] Contraseña actual incorrecta para usuario: ${user.email}`);
                 return res.status(400).json({ success: false, message: 'Contraseña actual incorrecta' });
            }

            // Actualizar contraseña (el hash se hace en pre-save)
            user.password = newPassword;
            await user.save();
            console.log(`[ChangePassword] Contraseña actualizada para usuario: ${user.email}`);

            // Enviar email de confirmación (opcional)
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
    }
};

module.exports = authController;