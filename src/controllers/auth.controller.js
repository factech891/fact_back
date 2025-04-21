// controllers/auth.controller.js (Ajustado para usar suscripción embebida en respuesta)
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const Company = require('../models/company.model');
// const Subscription = require('../models/subscription.model'); // Comentado temporalmente si no se usa aquí
const crypto = require('crypto');
const emailService = require('../services/email.service'); // Asegúrate que este servicio existe y está configurado

const authController = {
    // Registro de empresa y admin
    register: async (req, res) => {
        try {
            const { company, user } = req.body;

            // Verificar si ya existe una empresa con el mismo RIF
            const existingCompany = await Company.findOne({ rif: company.rif });
            if (existingCompany) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe una empresa registrada con este RIF.'
                });
            }

            // Verificar si ya existe un usuario con el mismo email
            const existingUser = await User.findOne({ email: user.email });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe un usuario registrado con este email.'
                });
            }

            // Crear la empresa (depende de los defaults del modelo para la suscripción)
            const newCompany = new Company({
                nombre: company.nombre,
                rif: company.rif,
                direccion: company.direccion || '',
                ciudad: company.ciudad || '',
                estado: company.estado || '',
                telefono: company.telefono || '',
                email: company.email,
                // La información de 'subscription' se establecerá por los defaults del modelo Company
            });

            // Guardar la empresa (aquí se aplican los defaults y validaciones)
            const savedCompany = await newCompany.save(); // El error de fecha debería estar resuelto por el fix en el modelo

            /* --- Creación de Suscripción Separada (Revisar si es necesaria) ---
               Si tu lógica principal de suscripción está en el objeto embebido
               dentro de Company, esta parte podría ser innecesaria o causar duplicidad.
               Comentada temporalmente para enfocarnos en el registro básico.
            */
            /*
            const subscription = new Subscription({
                companyId: savedCompany._id,
                plan: 'free', // O leer del default de Company?
                status: 'trial', // O leer del default de Company?
                startDate: new Date(), // O leer del default de Company?
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // O leer del default de Company?
            });
            await subscription.save();
            */
            // --- Fin Creación de Suscripción Separada ---


            // Crear usuario administrador
            const adminUser = new User({
                nombre: user.nombre,
                email: user.email,
                password: user.password, // Hashing se hace en el hook pre-save del modelo User (asumo)
                companyId: savedCompany._id,
                role: 'admin' // Rol por defecto para el primer usuario
            });

            const savedUser = await adminUser.save();

            // Generar token JWT
            const token = jwt.sign(
                { userId: savedUser._id, companyId: savedCompany._id, role: savedUser.role },
                process.env.JWT_SECRET, // Asegúrate que JWT_SECRET está en .env
                { expiresIn: '24h' } // O el tiempo que prefieras
            );

            // Enviar respuesta exitosa
            res.status(201).json({
                success: true,
                message: 'Registro exitoso',
                // Datos del usuario creado
                user: {
                    id: savedUser._id,
                    nombre: savedUser.nombre,
                    email: savedUser.email,
                    role: savedUser.role
                },
                // Datos de la compañía creada
                company: {
                    id: savedCompany._id,
                    nombre: savedCompany.nombre,
                    rif: savedCompany.rif
                },
                // Usar la información de suscripción embebida en la compañía guardada
                subscription: {
                    plan: savedCompany.subscription.plan,
                    status: savedCompany.subscription.status,
                    endDate: savedCompany.subscription.trialEndDate // Usar el campo con default corregido
                },
                token // Enviar el token para auto-login en frontend
            });
        } catch (error) {
            // Capturar cualquier error (validación, base de datos, etc.)
            console.error('Error en registro:', error); // Loguear el error completo en backend
            // Devolver un error genérico 500 al frontend
            res.status(500).json({
                 success: false,
                 message: 'Error interno del servidor durante el registro.',
                 // NO enviar error.message directamente en producción por seguridad,
                 // pero útil para depuración:
                 // error: error.message
                });
        }
    },

    // --- Resto de las funciones (login, forgotPassword, etc.) ---
    // (Asegúrate que estas funciones también manejen errores apropiadamente)

    // Login
    login: async (req, res) => {
        try {
            const { email, password } = req.body;
            const user = await User.findOne({ email });

            if (!user || !(await user.comparePassword(password))) {
                return res.status(401).json({ success: false, message: 'Email o contraseña incorrectos' });
            }
            if (!user.active) {
                return res.status(403).json({ success: false, message: 'Usuario desactivado.' });
            }

            const company = await Company.findById(user.companyId);
            if (!company) {
                // Should not happen if data is consistent, but handle it
                return res.status(404).json({ success: false, message: 'Empresa asociada no encontrada.' });
            }
            if (!company.active) {
                return res.status(403).json({ success: false, message: 'Empresa desactivada.' });
            }

            // Obtener la suscripción embebida
            const subscriptionInfo = company.subscription;

            user.lastLogin = new Date();
            await user.save();

            const token = jwt.sign(
                { userId: user._id, companyId: company._id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                success: true,
                message: 'Login exitoso',
                user: { id: user._id, nombre: user.nombre, email: user.email, role: user.role },
                company: { id: company._id, nombre: company.nombre, rif: company.rif, logoUrl: company.logoUrl },
                // Devolver la info de suscripción embebida
                subscription: subscriptionInfo ? {
                    plan: subscriptionInfo.plan,
                    status: subscriptionInfo.status,
                    endDate: subscriptionInfo.trialEndDate // O subscriptionEndDate si aplica
                } : null, // Manejar caso donde no exista por alguna razón
                token
            });
        } catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor durante el login.' });
        }
    },

    // Recuperar contraseña - Solicitud
    forgotPassword: async (req, res) => {
        try {
            const { email } = req.body;
            const user = await User.findOne({ email });

            if (!user) {
                // No revelar si el usuario existe o no por seguridad
                return res.json({
                    success: true, // Devolver éxito igualmente
                    message: 'Si existe una cuenta con ese email, se ha enviado un enlace de recuperación.'
                });
            }

            const resetToken = crypto.randomBytes(20).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

            user.resetPasswordToken = tokenHash;
            user.resetPasswordExpires = Date.now() + 3600000; // 1 hora
            await user.save();

            // Construir URL del frontend para el reseteo
            const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`; // Necesitas FRONTEND_URL en .env
            await emailService.sendPasswordResetEmail(user.email, resetLink);

            res.json({
                success: true,
                message: 'Si existe una cuenta con ese email, se ha enviado un enlace de recuperación.'
            });
        } catch (error) {
            console.error('Error en recuperación de contraseña:', error);
            res.status(500).json({ success: false, message: 'Error al procesar la solicitud' });
        }
    },

    // Recuperar contraseña - Reset
    resetPassword: async (req, res) => {
        try {
            const { token, newPassword } = req.body;
            const resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');

            const user = await User.findOne({
                resetPasswordToken,
                resetPasswordExpires: { $gt: Date.now() }
            });

            if (!user) {
                return res.status(400).json({
                    success: false,
                    message: 'Token inválido o expirado.'
                });
            }

            user.password = newPassword; // Hashing ocurre en pre-save hook
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();

            await emailService.sendPasswordChangedEmail(user.email); // Notificar al usuario

            res.json({
                success: true,
                message: 'Contraseña actualizada correctamente.'
            });
        } catch (error) {
            console.error('Error en reset de contraseña:', error);
            res.status(500).json({ success: false, message: 'Error al restablecer contraseña' });
        }
    },

    // Obtener información del usuario actual ('/api/auth/me')
    getMe: async (req, res) => {
        // El middleware authenticateToken ya puso req.user si el token es válido
        try {
            // El middleware ya valida el token, aquí solo buscamos datos frescos
            // req.user contiene { userId, companyId, role } del token
            const userId = req.user.userId;

            const user = await User.findById(userId).select('-password'); // Excluir password
            if (!user) {
                // Token válido pero usuario borrado?
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }

            const company = await Company.findById(user.companyId);
            if (!company) {
                 // Token válido pero compañía borrada?
                return res.status(404).json({ success: false, message: 'Empresa asociada no encontrada' });
            }

            // Usar suscripción embebida
            const subscriptionInfo = company.subscription;

            res.json({
                success: true,
                user: { id: user._id, nombre: user.nombre, email: user.email, role: user.role },
                company: { id: company._id, nombre: company.nombre, rif: company.rif, logoUrl: company.logoUrl },
                subscription: subscriptionInfo ? {
                    plan: subscriptionInfo.plan,
                    status: subscriptionInfo.status,
                    endDate: subscriptionInfo.trialEndDate // O subscriptionEndDate
                } : null
            });
        } catch (error) {
            console.error('Error al obtener información del usuario (getMe):', error);
            res.status(500).json({ success: false, message: 'Error interno al obtener información del usuario' });
        }
    },

    // Cambiar contraseña del usuario logueado
    changePassword: async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user.userId; // Del middleware authenticateToken

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }

            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(400).json({ success: false, message: 'Contraseña actual incorrecta' });
            }

            user.password = newPassword; // Hashing en pre-save hook
            await user.save();

            // Opcional: Notificar al usuario por email
            // await emailService.sendPasswordChangedEmail(user.email);

            res.json({ success: true, message: 'Contraseña actualizada correctamente' });
        } catch (error) {
            console.error('Error al cambiar contraseña:', error);
            res.status(500).json({ success: false, message: 'Error interno al cambiar contraseña' });
        }
    }
};

module.exports = authController;
