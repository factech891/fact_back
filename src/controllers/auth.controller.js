// controllers/auth.controller.js (Corregido req.user._id y Logs en getMe)
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const Company = require('../models/company.model');
// const Subscription = require('../models/subscription.model'); // Comentado temporalmente si no se usa aquí
const crypto = require('crypto');
const emailService = require('../services/email.service'); // Asegúrate que este servicio existe y está configurado

const authController = {
    // --- register, login, forgotPassword, resetPassword, changePassword (sin cambios) ---
    register: async (req, res) => {
        try {
            const { company, user } = req.body;
            const existingCompany = await Company.findOne({ rif: company.rif });
            if (existingCompany) {
                return res.status(400).json({ success: false, message: 'Ya existe una empresa registrada con este RIF.' });
            }
            const existingUser = await User.findOne({ email: user.email });
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Ya existe un usuario registrado con este email.' });
            }
            const newCompany = new Company({
                nombre: company.nombre,
                rif: company.rif,
                direccion: company.direccion || '',
                ciudad: company.ciudad || '',
                estado: company.estado || '',
                telefono: company.telefono || '',
                email: company.email,
            });
            const savedCompany = await newCompany.save();
            /* --- Creación de Suscripción Separada (Comentada) --- */
            const adminUser = new User({
                nombre: user.nombre,
                email: user.email,
                password: user.password,
                companyId: savedCompany._id,
                role: 'admin'
            });
            const savedUser = await adminUser.save();
            const token = jwt.sign(
                // Asegúrate que el payload incluye lo que necesitas, Mongoose usa _id
                { userId: savedUser._id, companyId: savedCompany._id, role: savedUser.role },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
            res.status(201).json({
                success: true,
                message: 'Registro exitoso',
                user: { id: savedUser._id, nombre: savedUser.nombre, email: savedUser.email, role: savedUser.role },
                company: { id: savedCompany._id, nombre: savedCompany.nombre, rif: savedCompany.rif },
                subscription: {
                    plan: savedCompany.subscription.plan,
                    status: savedCompany.subscription.status,
                    endDate: savedCompany.subscription.trialEndDate
                },
                token
            });
        } catch (error) {
            console.error('Error en registro:', error);
            res.status(500).json({
                 success: false,
                 message: 'Error interno del servidor durante el registro.',
                 // error: error.message // Opcional para depuración
                });
        }
    },
    login: async (req, res) => {
        try {
            const { email, password } = req.body;
            const user = await User.findOne({ email });
            if (!user || !(await user.comparePassword(password))) {
                return res.status(401).json({ success: false, message: 'Email o contraseña incorrectos' });
            }
            if (!user.active) { return res.status(403).json({ success: false, message: 'Usuario desactivado.' }); }
            const company = await Company.findById(user.companyId);
            if (!company) { return res.status(404).json({ success: false, message: 'Empresa asociada no encontrada.' });}
            if (!company.active) { return res.status(403).json({ success: false, message: 'Empresa desactivada.' }); }
            const subscriptionInfo = company.subscription;
            user.lastLogin = new Date();
            await user.save();
            const token = jwt.sign(
                 // Asegúrate que el payload incluye lo que necesitas, Mongoose usa _id
                { userId: user._id, companyId: company._id, role: user.role },
                process.env.JWT_SECRET, { expiresIn: '24h' }
            );
            res.json({
                success: true, message: 'Login exitoso',
                user: { id: user._id, nombre: user.nombre, email: user.email, role: user.role },
                company: { id: company._id, nombre: company.nombre, rif: company.rif, logoUrl: company.logoUrl },
                subscription: subscriptionInfo ? { plan: subscriptionInfo.plan, status: subscriptionInfo.status, endDate: subscriptionInfo.trialEndDate } : null,
                token
            });
        } catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor durante el login.' });
        }
    },
    forgotPassword: async (req, res) => {
        try {
            const { email } = req.body;
            const user = await User.findOne({ email });
            if (!user) {
                return res.json({ success: true, message: 'Si existe una cuenta con ese email, se ha enviado un enlace de recuperación.' });
            }
            const resetToken = crypto.randomBytes(20).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
            user.resetPasswordToken = tokenHash;
            user.resetPasswordExpires = Date.now() + 3600000; // 1 hora
            await user.save();
            const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
            await emailService.sendPasswordResetEmail(user.email, resetLink);
            res.json({ success: true, message: 'Si existe una cuenta con ese email, se ha enviado un enlace de recuperación.' });
        } catch (error) {
            console.error('Error en recuperación de contraseña:', error);
            res.status(500).json({ success: false, message: 'Error al procesar la solicitud' });
        }
    },
    resetPassword: async (req, res) => {
        try {
            const { token, newPassword } = req.body;
            const resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
            const user = await User.findOne({ resetPasswordToken, resetPasswordExpires: { $gt: Date.now() } });
            if (!user) { return res.status(400).json({ success: false, message: 'Token inválido o expirado.' }); }
            user.password = newPassword;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
            await emailService.sendPasswordChangedEmail(user.email);
            res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
        } catch (error) {
            console.error('Error en reset de contraseña:', error);
            res.status(500).json({ success: false, message: 'Error al restablecer contraseña' });
        }
    },

    // Obtener información del usuario actual ('/api/auth/me') - CORREGIDO Y CON LOGS
    getMe: async (req, res) => {
        console.log("--- Entrando a authController.getMe ---"); // Log 1
        try {
            // req.user es establecido por el middleware authenticateToken
            // CORRECCIÓN: Acceder a req.user._id en lugar de req.user.userId
            const userId = req.user?._id; // Usar optional chaining y _id
            console.log(`[getMe] Buscando usuario con ID: ${userId}`); // Log 2

            if (!userId) {
                 console.log("[getMe] No se encontró _id en req.user. Token inválido o middleware falló?");
                 // El middleware debería haber respondido antes si no había token/usuario
                 return res.status(401).json({ success: false, message: 'No autenticado (falta _id).' });
            }

            // Usar el userId (que ahora es un ObjectId válido) para buscar
            const user = await User.findById(userId).select('-password'); // Excluir password
            console.log("[getMe] Resultado de User.findById:", user ? `Encontrado (${user.email})` : "NO Encontrado"); // Log 3

            if (!user) {
                console.log(`[getMe] Usuario con ID ${userId} no encontrado en BD. Devolviendo 404.`);
                // Devolver 404 es correcto si el usuario fue borrado después de emitir el token
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }

            const companyId = user.companyId;
            console.log(`[getMe] Buscando compañía con ID: ${companyId}`); // Log 4
            const company = await Company.findById(companyId);
            console.log("[getMe] Resultado de Company.findById:", company ? `Encontrada (${company.nombre})` : "NO Encontrada"); // Log 5

            if (!company) {
                 console.log(`[getMe] Compañía con ID ${companyId} no encontrada en BD. Devolviendo 404.`);
                 // Devolver 404 es correcto si la compañía fue borrada
                return res.status(404).json({ success: false, message: 'Empresa asociada no encontrada' });
            }

            // Usar suscripción embebida
            const subscriptionInfo = company.subscription;
            console.log("[getMe] Datos encontrados. Enviando respuesta 200 OK."); // Log 6

            res.json({
                success: true,
                user: { id: user._id, nombre: user.nombre, email: user.email, role: user.role },
                company: { id: company._id, nombre: company.nombre, rif: company.rif, logoUrl: company.logoUrl },
                subscription: subscriptionInfo ? {
                    plan: subscriptionInfo.plan,
                    status: subscriptionInfo.status,
                    endDate: subscriptionInfo.trialEndDate // O subscriptionEndDate si aplica
                } : null
            });
        } catch (error) {
            console.error('Error al obtener información del usuario (getMe):', error); // Log 7 (en caso de error inesperado)
            res.status(500).json({ success: false, message: 'Error interno al obtener información del usuario' });
        }
    },

    changePassword: async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            // CORRECCIÓN: Usar req.user._id también aquí
            const userId = req.user?._id;
            if(!userId) { return res.status(401).json({ success: false, message: 'No autenticado.' }); }

            const user = await User.findById(userId);
            if (!user) { return res.status(404).json({ success: false, message: 'Usuario no encontrado' }); }

            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) { return res.status(400).json({ success: false, message: 'Contraseña actual incorrecta' }); }

            user.password = newPassword; // Hashing en pre-save hook
            await user.save();

            res.json({ success: true, message: 'Contraseña actualizada correctamente' });
        } catch (error) {
            console.error('Error al cambiar contraseña:', error);
            res.status(500).json({ success: false, message: 'Error interno al cambiar contraseña' });
        }
    }
};

module.exports = authController;
