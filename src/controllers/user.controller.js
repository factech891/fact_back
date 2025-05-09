// controllers/user.controller.js
const User = require('../models/user.model');
const Company = require('../models/company.model');
const Subscription = require('../models/subscription.model'); // Asegúrate que la ruta sea correcta
const emailService = require('../services/email.service'); // Asegúrate que la ruta sea correcta
const crypto = require('crypto');

// --- URLs de Avatares Disponibles (Para validación opcional en el futuro) ---
// const availableAvatarUrls = [
//    'https://pub-c37b7a23aa9c49239d088e3e0a3ba275.r2.dev/Disen%CC%83o%20sin%20ti%CC%81tulo/1.png',
//    'https://pub-c37b7a23aa9c49239d088e3e0a3ba275.r2.dev/Disen%CC%83o%20sin%20ti%CC%81tulo/2.png',
//    'https://pub-c37b7a23aa9c49239d088e3e0a3ba275.r2.dev/Disen%CC%83o%20sin%20ti%CC%81tulo/3.png',
//    'https://pub-c37b7a23aa9c49239d088e3e0a3ba275.r2.dev/Disen%CC%83o%20sin%20ti%CC%81tulo/4.png',
//    'https://pub-c37b7a23aa9c49239d088e3e0a3ba275.r2.dev/Disen%CC%83o%20sin%20ti%CC%81tulo/5.png',
//    'https://pub-c37b7a23aa9c49239d088e3e0a3ba275.r2.dev/Disen%CC%83o%20sin%20ti%CC%81tulo/6.png'
// ];

const userController = {
    // Obtener todos los usuarios de una empresa (SIN CAMBIOS, selectedAvatarUrl se incluye por defecto)
    getUsers: async (req, res) => {
        try {
            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }
            // selectedAvatarUrl se incluye por defecto al no estar excluido en select()
            const users = await User.find({ companyId: req.user.companyId })
                .select('-password -resetPasswordToken -resetPasswordExpires')
                .sort({ createdAt: -1 });
            res.json({ success: true, users });
        } catch (error) {
            console.error('Error al obtener usuarios:', error);
            res.status(500).json({ success: false, message: 'Error al obtener usuarios', error: error.message });
        }
    },

    // Obtener usuario por ID (SIN CAMBIOS, selectedAvatarUrl se incluye por defecto)
    getUserById: async (req, res) => {
        try {
            const { id } = req.params;
            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }
             // selectedAvatarUrl se incluye por defecto al no estar excluido en select()
            const user = await User.findOne({ _id: id, companyId: req.user.companyId })
                           .select('-password -resetPasswordToken -resetPasswordExpires');
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }
            res.json({ success: true, user });
        } catch (error) {
            console.error('Error al obtener usuario:', error);
            res.status(500).json({ success: false, message: 'Error al obtener usuario', error: error.message });
        }
    },

    // Crear nuevo usuario (SIN CAMBIOS relevantes para el avatar)
    createUser: async (req, res) => {
        try {
            const { nombre, email, role, password } = req.body;
            if (!nombre || !email || !role || !password) {
                 return res.status(400).json({ success: false, message: 'Faltan campos requeridos: nombre, email, rol o contraseña.' });
            }
            if (password.length < 6) {
                 return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
            }
            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'No autenticado o sin ID de compañía.' });
            }

            console.log("Verificación de límites desactivada temporalmente");

            const existingUser = await User.findOne({ email: email.toLowerCase() });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: `El email '${email}' ya está registrado. Por favor, utiliza otro.`
                });
            }

            // El avatar por defecto se asigna desde el modelo User
            const newUser = new User({
                nombre: nombre.trim(),
                email: email.toLowerCase().trim(),
                password: password,
                companyId: req.user.companyId,
                role: role,
                active: true
                // selectedAvatarUrl usará el default del schema
            });

            const savedUser = await newUser.save();

            console.log(`Usuario ${savedUser.email} creado. Recordar configurar el envío de email de bienvenida.`);

            res.status(201).json({
                success: true,
                message: 'Usuario creado correctamente.',
                user: {
                    id: savedUser._id,
                    nombre: savedUser.nombre,
                    email: savedUser.email,
                    role: savedUser.role,
                    active: savedUser.active,
                    selectedAvatarUrl: savedUser.selectedAvatarUrl // Devolver avatar por defecto
                }
            });

        } catch (error) {
            console.error('Error detallado al crear usuario:', error);
            if (error.name === 'ValidationError') {
                const messages = Object.values(error.errors).map(val => val.message);
                const errorMessage = messages.join('. ');
                return res.status(400).json({
                    success: false,
                    message: `Error de validación: ${errorMessage}` || 'Error de validación al crear usuario.'
                });
            } else if (error.code === 11000) {
                 let field = error.message.split("index: ")[1];
                 field = field.split(" dup key")[0];
                 field = field.substring(0, field.lastIndexOf("_"));
                 return res.status(400).json({
                     success: false,
                     message: `Error: Ya existe un registro con este valor para el campo '${field}'.`
                 });
            } else {
                return res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor al crear el usuario.',
                });
            }
        }
    },

    // Actualizar usuario (SIN CAMBIOS relevantes para el avatar)
    updateUser: async (req, res) => {
        try {
            const { id } = req.params;
            const { nombre, role, active, password } = req.body;

            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }

            const user = await User.findOne({ _id: id, companyId: req.user.companyId });
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }

            const isFirstAdmin = await User.findOne({ companyId: req.user.companyId, role: 'admin' }).sort({ createdAt: 1 });
            if (isFirstAdmin && isFirstAdmin._id.toString() === id && req.user._id.toString() !== id) {
                // ... (lógica de protección sin cambios) ...
                 if (typeof active !== 'undefined' && !active) { return res.status(403).json({ success: false, message: 'No se puede desactivar al administrador principal' });}
                 if (role && role !== 'admin') { return res.status(403).json({ success: false, message: 'No se puede cambiar el rol del administrador principal' });}
                 if (password) { return res.status(403).json({ success: false, message: 'No se puede cambiar la contraseña del administrador principal directamente.' });}
            }

            if (nombre) user.nombre = nombre.trim();
            if (role) user.role = role;
            if (typeof active !== 'undefined') user.active = active;
            if (password) {
                 if (password.length < 6) { return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres.' }); }
                 user.password = password;
                 console.log(`Contraseña actualizada para usuario ${user.email}`);
            }


            const updatedUser = await user.save();
            res.json({
                success: true,
                message: 'Usuario actualizado correctamente',
                user: {
                    id: updatedUser._id,
                    nombre: updatedUser.nombre,
                    email: updatedUser.email,
                    role: updatedUser.role,
                    active: updatedUser.active,
                    selectedAvatarUrl: updatedUser.selectedAvatarUrl // Devolver avatar
                 }
            });
        } catch (error) {
             console.error('Error al actualizar usuario:', error);
             if (error.name === 'ValidationError') {
                 const messages = Object.values(error.errors).map(val => val.message);
                 const errorMessage = messages.join('. ');
                 return res.status(400).json({ success: false, message: `Error de validación: ${errorMessage}` });
             }
             res.status(500).json({ success: false, message: 'Error al actualizar usuario', error: error.message });
        }
    },

    // Eliminar usuario (SIN CAMBIOS)
    deleteUser: async (req, res) => {
        try {
            const { id } = req.params;
            if (!req.user || !req.user.companyId) { return res.status(401).json({ success: false, message: 'No autenticado' }); }
            if (id === req.user._id.toString()) { return res.status(400).json({ success: false, message: 'No puedes eliminar tu propio usuario' }); }
            const user = await User.findOne({ _id: id, companyId: req.user.companyId });
            if (!user) { return res.status(404).json({ success: false, message: 'Usuario no encontrado' }); }
            const isFirstAdmin = await User.findOne({ companyId: req.user.companyId, role: 'admin' }).sort({ createdAt: 1 });
            if (isFirstAdmin && isFirstAdmin._id.toString() === id) { return res.status(403).json({ success: false, message: 'No se puede eliminar al administrador principal' }); }
            await User.deleteOne({ _id: id });
            res.json({ success: true, message: 'Usuario eliminado correctamente' });
        } catch (error) {
            console.error('Error al eliminar usuario:', error);
            res.status(500).json({ success: false, message: 'Error al eliminar usuario', error: error.message });
        }
    },

    // Restablecer contraseña (SIN CAMBIOS relevantes para el avatar)
    resetUserPassword: async (req, res) => {
        try {
            const { id } = req.params;
             if (!req.user || !req.user.companyId || req.user.role !== 'admin') { return res.status(403).json({ success: false, message: 'No autorizado para restablecer contraseñas.' }); }
             const isFirstAdmin = await User.findOne({ companyId: req.user.companyId, role: 'admin' }).sort({ createdAt: 1 });
             if (isFirstAdmin && isFirstAdmin._id.toString() === id) { return res.status(403).json({ success: false, message: 'No se puede restablecer la contraseña del administrador principal desde aquí.' }); }
             if (req.user._id.toString() === id) { return res.status(400).json({ success: false, message: 'Usa la opción "Cambiar mi contraseña" para tu propia cuenta.' }); }

            const user = await User.findOne({ _id: id, companyId: req.user.companyId });
            if (!user) { return res.status(404).json({ success: false, message: 'Usuario no encontrado' }); }

            const newPassword = crypto.randomBytes(10).toString('hex');
            user.password = newPassword;
            await user.save();

            try {
                const company = await Company.findById(req.user.companyId);
                await emailService.sendPasswordResetByAdminEmail( user.email, { nombre: user.nombre, email: user.email, password: newPassword, companyName: company ? company.nombre : 'Tu Empresa', adminName: req.user.nombre });
                 res.json({ success: true, message: 'Contraseña restablecida. Se ha enviado un email con la nueva contraseña.' });
            } catch(emailError) {
                 console.error(`Contraseña restablecida para ${user.email}, pero falló envío de email:`, emailError);
                 res.json({ success: true, message: 'Contraseña restablecida en el sistema, pero no se pudo enviar el email de notificación.' });
            }

        } catch (error) {
            console.error('Error al restablecer contraseña:', error);
             if (error.name === 'ValidationError') {
                 const messages = Object.values(error.errors).map(val => val.message);
                 const errorMessage = messages.join('. ');
                 return res.status(400).json({ success: false, message: `Error de validación: ${errorMessage}` });
             }
            res.status(500).json({ success: false, message: 'Error al restablecer contraseña', error: error.message });
        }
    },

    // Actualizar propio perfil
    updateProfile: async (req, res) => {
        try {
            const { nombre } = req.body; // Permitir solo actualizar el nombre desde aquí por ahora
            if (!req.user) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }
            const user = await User.findById(req.user._id);
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }
            if (nombre) user.nombre = nombre.trim();
            // Aquí NO actualizamos el avatar, para eso usaremos la nueva función

            const updatedUser = await user.save();
            res.json({
                success: true,
                message: 'Perfil actualizado correctamente',
                // --- MODIFICADO: Devolver también el avatar actual ---
                user: {
                    id: updatedUser._id,
                    nombre: updatedUser.nombre,
                    email: updatedUser.email,
                    role: updatedUser.role,
                    selectedAvatarUrl: updatedUser.selectedAvatarUrl // Añadido
                }
            });
        } catch (error) {
            console.error('Error al actualizar perfil:', error);
             if (error.name === 'ValidationError') {
                 const messages = Object.values(error.errors).map(val => val.message);
                 const errorMessage = messages.join('. ');
                 return res.status(400).json({ success: false, message: `Error de validación: ${errorMessage}` });
             }
            res.status(500).json({ success: false, message: 'Error al actualizar perfil', error: error.message });
        }
    },

    // --- INICIO: Nueva Función para Actualizar Avatar ---
    updateMyAvatar: async (req, res) => {
        try {
            // Verificar autenticación
            if (!req.user || !req.user._id) {
                return res.status(401).json({ success: false, message: 'No autenticado.' });
            }

            // Obtener la URL del avatar del cuerpo de la solicitud
            const { avatarUrl } = req.body;

            // Validación básica: ¿Nos enviaron una URL?
            if (!avatarUrl || typeof avatarUrl !== 'string' || avatarUrl.trim() === '') {
                return res.status(400).json({ success: false, message: 'Se requiere la URL del avatar (avatarUrl).' });
            }

            // Opcional: Validar si la URL es una de las 6 permitidas
            // if (!availableAvatarUrls.includes(avatarUrl)) {
            //     return res.status(400).json({ success: false, message: 'La URL del avatar proporcionada no es válida.' });
            // }

            // Actualizar directamente en la base de datos
            // Nota: Idealmente, esto iría en un user.service.js
            const updatedUser = await User.findByIdAndUpdate(
                req.user._id, // ID del usuario autenticado
                { selectedAvatarUrl: avatarUrl.trim() }, // Campo a actualizar
                { new: true, runValidators: true } // Opciones: devolver doc actualizado, correr validadores del schema
            ).select('selectedAvatarUrl'); // Seleccionar solo el campo actualizado para devolver si se desea

            if (!updatedUser) {
                 // Esto no debería pasar si el usuario está autenticado, pero por si acaso
                 return res.status(404).json({ success: false, message: 'Usuario no encontrado después de la actualización.' });
            }

            // Responder con éxito
            res.json({
                success: true,
                message: 'Avatar actualizado correctamente.',
                selectedAvatarUrl: updatedUser.selectedAvatarUrl // Devolver la nueva URL guardada
            });

        } catch (error) {
            console.error('Error al actualizar avatar:', error);
            if (error.name === 'ValidationError') { // Por si añadimos validaciones futuras a la URL
                 const messages = Object.values(error.errors).map(val => val.message);
                 const errorMessage = messages.join('. ');
                 return res.status(400).json({ success: false, message: `Error de validación: ${errorMessage}` });
             }
            res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar el avatar.' });
        }
    },
    // --- FIN: Nueva Función para Actualizar Avatar ---

    // --- INICIO: Nueva Función para Actualizar Zona Horaria ---
    updateMyTimezone: async (req, res) => {
        try {
            // Verificar autenticación
            if (!req.user || !req.user._id) {
                return res.status(401).json({ success: false, message: 'No autenticado.' });
            }

            // Obtener la zona horaria del cuerpo de la solicitud
            const { timezone } = req.body;

            // Validación básica
            if (!timezone || typeof timezone !== 'string' || timezone.trim() === '') {
                return res.status(400).json({ success: false, message: 'Se requiere una zona horaria válida.' });
            }

            // Actualizar directamente en la base de datos
            const updatedUser = await User.findByIdAndUpdate(
                req.user._id,
                { timezone: timezone.trim() },
                { new: true, runValidators: true }
            ).select('timezone');

            if (!updatedUser) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado después de la actualización.' });
            }

            // Responder con éxito
            res.json({
                success: true,
                message: 'Zona horaria actualizada correctamente.',
                timezone: updatedUser.timezone
            });

        } catch (error) {
            console.error('Error al actualizar zona horaria:', error);
            if (error.name === 'ValidationError') {
                const messages = Object.values(error.errors).map(val => val.message);
                const errorMessage = messages.join('. ');
                return res.status(400).json({ success: false, message: `Error de validación: ${errorMessage}` });
            }
            res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar la zona horaria.' });
        }
    }
    
};

module.exports = userController;