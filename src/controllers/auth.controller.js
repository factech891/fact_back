// controllers/auth.controller.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const Company = require('../models/company.model');
const Subscription = require('../models/subscription.model');
const crypto = require('crypto');
const emailService = require('../services/email.service');

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
            
            // Crear la empresa
            const newCompany = new Company({
                nombre: company.nombre,
                rif: company.rif,
                direccion: company.direccion || '',
                ciudad: company.ciudad || '',
                estado: company.estado || '',
                telefono: company.telefono || '',
                email: company.email,
                // Iniciar con subscription en trial por defecto
            });
            
            const savedCompany = await newCompany.save();
            
            // Crear suscripción
            const subscription = new Subscription({
                companyId: savedCompany._id,
                plan: 'free',
                status: 'trial',
                startDate: new Date(),
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
            });
            
            await subscription.save();
            
            // Crear usuario administrador
            const adminUser = new User({
                nombre: user.nombre,
                email: user.email,
                password: user.password,
                companyId: savedCompany._id,
                role: 'admin'
            });
            
            const savedUser = await adminUser.save();
            
            // Generar token
            const token = jwt.sign(
                { userId: savedUser._id, companyId: savedCompany._id, role: savedUser.role },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            res.status(201).json({
                success: true,
                message: 'Registro exitoso',
                user: {
                    id: savedUser._id,
                    nombre: savedUser.nombre,
                    email: savedUser.email,
                    role: savedUser.role
                },
                company: {
                    id: savedCompany._id,
                    nombre: savedCompany.nombre,
                    rif: savedCompany.rif
                },
                subscription: {
                    plan: subscription.plan,
                    status: subscription.status,
                    endDate: subscription.endDate
                },
                token
            });
        } catch (error) {
            console.error('Error en registro:', error);
            res.status(500).json({ success: false, message: 'Error en el registro', error: error.message });
        }
    },
    
    // Login
    login: async (req, res) => {
        try {
            const { email, password } = req.body;
            
            // Buscar usuario por email
            const user = await User.findOne({ email });
            
            if (!user) {
                return res.status(401).json({ success: false, message: 'Email o contraseña incorrectos' });
            }
            
            // Verificar si el usuario está activo
            if (!user.active) {
                return res.status(403).json({ success: false, message: 'Usuario desactivado. Contacte al administrador.' });
            }
            
            // Verificar contraseña
            const isMatch = await user.comparePassword(password);
            
            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Email o contraseña incorrectos' });
            }
            
            // Buscar empresa
            const company = await Company.findById(user.companyId);
            
            if (!company) {
                return res.status(404).json({ success: false, message: 'Empresa no encontrada' });
            }
            
            // Verificar si la empresa está activa
            if (!company.active) {
                return res.status(403).json({ success: false, message: 'Empresa desactivada. Contacte al soporte.' });
            }
            
            // Buscar info de suscripción
            const subscription = await Subscription.findOne({ companyId: company._id });
            
            // Actualizar fecha último login
            user.lastLogin = new Date();
            await user.save();
            
            // Generar token
            const token = jwt.sign(
                { userId: user._id, companyId: company._id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            res.json({
                success: true,
                message: 'Login exitoso',
                user: {
                    id: user._id,
                    nombre: user.nombre,
                    email: user.email,
                    role: user.role
                },
                company: {
                    id: company._id,
                    nombre: company.nombre,
                    rif: company.rif,
                    logoUrl: company.logoUrl
                },
                subscription: subscription ? {
                    plan: subscription.plan,
                    status: subscription.status,
                    endDate: subscription.endDate
                } : null,
                token
            });
        } catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({ success: false, message: 'Error en el login', error: error.message });
        }
    },
    
    // Recuperar contraseña - Solicitud
    forgotPassword: async (req, res) => {
        try {
            const { email } = req.body;
            
            const user = await User.findOne({ email });
            
            if (!user) {
                return res.status(404).json({ success: false, message: 'No se encontró usuario con este email.' });
            }
            
            // Generar token
            const resetToken = crypto.randomBytes(20).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
            
            // Guardar token en BD
            user.resetPasswordToken = tokenHash;
            user.resetPasswordExpires = Date.now() + 3600000; // 1 hora
            await user.save();
            
            // Enviar email
            const resetLink = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
            await emailService.sendPasswordResetEmail(user.email, resetLink);
            
            res.json({ 
                success: true, 
                message: 'Se ha enviado un enlace de recuperación a tu email.' 
            });
        } catch (error) {
            console.error('Error en recuperación de contraseña:', error);
            res.status(500).json({ success: false, message: 'Error al procesar la solicitud', error: error.message });
        }
    },
    
    // Recuperar contraseña - Reset
    resetPassword: async (req, res) => {
        try {
            const { token, newPassword } = req.body;
            
            // Hash del token recibido
            const resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
            
            // Buscar usuario con token válido
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
            
            // Actualizar contraseña
            user.password = newPassword;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
            
            // Enviar email de confirmación
            await emailService.sendPasswordChangedEmail(user.email);
            
            res.json({ 
                success: true, 
                message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.' 
            });
        } catch (error) {
            console.error('Error en reset de contraseña:', error);
            res.status(500).json({ success: false, message: 'Error al restablecer contraseña', error: error.message });
        }
    },
    
    // Obtener información del usuario actual
    getMe: async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }
            
            const user = await User.findById(req.user._id).select('-password');
            
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }
            
            const company = await Company.findById(user.companyId);
            
            if (!company) {
                return res.status(404).json({ success: false, message: 'Empresa no encontrada' });
            }
            
            const subscription = await Subscription.findOne({ companyId: company._id });
            
            res.json({
                success: true,
                user: {
                    id: user._id,
                    nombre: user.nombre,
                    email: user.email,
                    role: user.role
                },
                company: {
                    id: company._id,
                    nombre: company.nombre,
                    rif: company.rif,
                    logoUrl: company.logoUrl
                },
                subscription: subscription ? {
                    plan: subscription.plan,
                    status: subscription.status,
                    endDate: subscription.endDate
                } : null
            });
        } catch (error) {
            console.error('Error al obtener información del usuario:', error);
            res.status(500).json({ success: false, message: 'Error al obtener información del usuario', error: error.message });
        }
    },
    
    // Cambiar contraseña del usuario logueado
    changePassword: async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            
            if (!req.user) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }
            
            const user = await User.findById(req.user._id);
            
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }
            
            // Verificar contraseña actual
            const isMatch = await user.comparePassword(currentPassword);
            
            if (!isMatch) {
                return res.status(400).json({ success: false, message: 'Contraseña actual incorrecta' });
            }
            
            // Actualizar contraseña
            user.password = newPassword;
            await user.save();
            
            res.json({ success: true, message: 'Contraseña actualizada correctamente' });
        } catch (error) {
            console.error('Error al cambiar contraseña:', error);
            res.status(500).json({ success: false, message: 'Error al cambiar contraseña', error: error.message });
        }
    }
};

module.exports = authController;