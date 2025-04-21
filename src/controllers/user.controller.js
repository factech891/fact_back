// controllers/user.controller.js
const User = require('../models/user.model');
const Company = require('../models/company.model');
const Subscription = require('../models/subscription.model');
const emailService = require('../services/email.service');
const crypto = require('crypto');

const userController = {
    // Obtener todos los usuarios de una empresa
    getUsers: async (req, res) => {
        try {
            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }
            
            const users = await User.find({ companyId: req.user.companyId })
                .select('-password -resetPasswordToken -resetPasswordExpires')
                .sort({ createdAt: -1 });
            
            res.json({
                success: true,
                users
            });
        } catch (error) {
            console.error('Error al obtener usuarios:', error);
            res.status(500).json({ success: false, message: 'Error al obtener usuarios', error: error.message });
        }
    },
    
    // Obtener usuario por ID
    getUserById: async (req, res) => {
        try {
            const { id } = req.params;
            
            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }
            
            const user = await User.findOne({ 
                _id: id, 
                companyId: req.user.companyId 
            }).select('-password -resetPasswordToken -resetPasswordExpires');
            
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }
            
            res.json({
                success: true,
                user
            });
        } catch (error) {
            console.error('Error al obtener usuario:', error);
            res.status(500).json({ success: false, message: 'Error al obtener usuario', error: error.message });
        }
    },
    
    // Crear nuevo usuario
    createUser: async (req, res) => {
        try {
            const { nombre, email, role } = req.body;
            
            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }
            
            // Verificar límites de suscripción
            const subscription = await Subscription.findOne({ companyId: req.user.companyId });
            const userCount = await User.countDocuments({ companyId: req.user.companyId });
            
            if (subscription && userCount >= subscription.features.maxUsers) {
                return res.status(403).json({
                    success: false,
                    message: `Ha alcanzado el límite de usuarios (${subscription.features.maxUsers}) para su plan actual.`,
                    limit: subscription.features.maxUsers,
                    current: userCount
                });
            }
            
            // Verificar si ya existe un usuario con el mismo email
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Ya existe un usuario con este email' 
                });
            }
            
            // Generar contraseña temporal
            const tempPassword = crypto.randomBytes(8).toString('hex');
            
            // Crear nuevo usuario
            const newUser = new User({
                nombre,
                email,
                password: tempPassword,
                companyId: req.user.companyId,
                role: role || 'visor', // Por defecto visor
                active: true
            });
            
            const savedUser = await newUser.save();
            
            // Enviar email con credenciales
            const company = await Company.findById(req.user.companyId);
            await emailService.sendWelcomeEmail(
                savedUser.email, 
                {
                    nombre: savedUser.nombre,
                    email: savedUser.email,
                    password: tempPassword,
                    companyName: company.nombre,
                    role: savedUser.role
                }
            );
            
            res.status(201).json({
                success: true,
                message: 'Usuario creado correctamente. Se ha enviado un email con las credenciales.',
                user: {
                    id: savedUser._id,
                    nombre: savedUser.nombre,
                    email: savedUser.email,
                    role: savedUser.role
                }
            });
        } catch (error) {
            console.error('Error al crear usuario:', error);
            res.status(500).json({ success: false, message: 'Error al crear usuario', error: error.message });
        }
    },
    
    // Actualizar usuario
    updateUser: async (req, res) => {
        try {
            const { id } = req.params;
            const { nombre, role, active } = req.body;
            
            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }
            
            // Buscar usuario
            const user = await User.findOne({ 
                _id: id, 
                companyId: req.user.companyId 
            });
            
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }
            
            // Verificar que no esté intentando modificar al administrador principal (creador de la cuenta)
            const isFirstAdmin = await User.findOne({ 
                companyId: req.user.companyId,
                role: 'admin'
            }).sort({ createdAt: 1 });
            
            // No permitir desactivar o cambiar el rol del admin principal
            if (isFirstAdmin && isFirstAdmin._id.toString() === id && req.user._id.toString() !== id) {
                if (typeof active !== 'undefined' && !active) {
                    return res.status(403).json({ 
                        success: false, 
                        message: 'No se puede desactivar al administrador principal' 
                    });
                }
                
                if (role && role !== 'admin') {
                    return res.status(403).json({ 
                        success: false, 
                        message: 'No se puede cambiar el rol del administrador principal' 
                    });
                }
            }
            
            // Actualizar usuario
            if (nombre) user.nombre = nombre;
            if (role) user.role = role;
            if (typeof active !== 'undefined') user.active = active;
            
            const updatedUser = await user.save();
            
            res.json({
                success: true,
                message: 'Usuario actualizado correctamente',
                user: {
                    id: updatedUser._id,
                    nombre: updatedUser.nombre,
                    email: updatedUser.email,
                    role: updatedUser.role,
                    active: updatedUser.active
                }
            });
        } catch (error) {
            console.error('Error al actualizar usuario:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar usuario', error: error.message });
        }
    },
    
    // Eliminar usuario
    deleteUser: async (req, res) => {
        try {
            const { id } = req.params;
            
            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }
            
            // No permitir auto-eliminación
            if (id === req.user._id.toString()) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'No puedes eliminar tu propio usuario' 
                });
            }
            
            // Buscar usuario
            const user = await User.findOne({ 
                _id: id, 
                companyId: req.user.companyId 
            });
            
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }
            
            // Verificar que no esté intentando eliminar al administrador principal
            const isFirstAdmin = await User.findOne({ 
                companyId: req.user.companyId,
                role: 'admin'
            }).sort({ createdAt: 1 });
            
            if (isFirstAdmin && isFirstAdmin._id.toString() === id) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'No se puede eliminar al administrador principal' 
                });
            }
            
            // Eliminar usuario
            await User.deleteOne({ _id: id });
            
            res.json({
                success: true,
                message: 'Usuario eliminado correctamente'
            });
        } catch (error) {
            console.error('Error al eliminar usuario:', error);
            res.status(500).json({ success: false, message: 'Error al eliminar usuario', error: error.message });
        }
    },
    
    // Restablecer contraseña (por parte del administrador)
    resetUserPassword: async (req, res) => {
        try {
            const { id } = req.params;
            
            if (!req.user || !req.user.companyId || req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'No autorizado' });
            }
            
            // Buscar usuario
            const user = await User.findOne({ 
                _id: id, 
                companyId: req.user.companyId 
            });
            
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }
            
            // Generar nueva contraseña
            const newPassword = crypto.randomBytes(8).toString('hex');
            
            // Actualizar contraseña
            user.password = newPassword;
            await user.save();
            
            // Enviar email con nueva contraseña
            const company = await Company.findById(req.user.companyId);
            await emailService.sendPasswordResetByAdminEmail(
                user.email,
                {
                    nombre: user.nombre,
                    email: user.email,
                    password: newPassword,
                    companyName: company.nombre,
                    adminName: req.user.nombre
                }
            );
            
            res.json({
                success: true,
                message: 'Contraseña restablecida. Se ha enviado un email con la nueva contraseña.'
            });
        } catch (error) {
            console.error('Error al restablecer contraseña:', error);
            res.status(500).json({ success: false, message: 'Error al restablecer contraseña', error: error.message });
        }
    },
    
    // Actualizar propio perfil (usuario actual)
    updateProfile: async (req, res) => {
        try {
            const { nombre } = req.body;
            
            if (!req.user) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }
            
            const user = await User.findById(req.user._id);
            
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }
            
            // Solo permitir actualizar el nombre (no el rol ni email)
            if (nombre) user.nombre = nombre;
            
            const updatedUser = await user.save();
            
            res.json({
                success: true,
                message: 'Perfil actualizado correctamente',
                user: {
                    id: updatedUser._id,
                    nombre: updatedUser.nombre,
                    email: updatedUser.email,
                    role: updatedUser.role
                }
            });
        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar perfil', error: error.message });
        }
    }
};

module.exports = userController;