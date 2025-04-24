// controllers/user.controller.js
const User = require('../models/user.model');
const Company = require('../models/company.model');
const Subscription = require('../models/subscription.model'); // Asegúrate que la ruta sea correcta
const emailService = require('../services/email.service'); // Asegúrate que la ruta sea correcta
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
            res.json({ success: true, users });
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

    // Crear nuevo usuario (con bloque de suscripción comentado reintegrado)
    createUser: async (req, res) => {
        try {
            // --- MODIFICADO: Ahora también recibe 'password' del admin ---
            const { nombre, email, role, password } = req.body;

            // Validación básica de entrada (incluyendo password si es creación)
            if (!nombre || !email || !role || !password) {
                 return res.status(400).json({ success: false, message: 'Faltan campos requeridos: nombre, email, rol o contraseña.' });
            }
             // Validación simple de longitud de contraseña
            if (password.length < 6) {
                 return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
            }


            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'No autenticado o sin ID de compañía.' });
            }

            // --- REINTEGRADO: Bloque de verificación de límites (Comentado) ---
            /*
            console.log("Verificando límites de suscripción..."); // Log informativo
            const subscription = await Subscription.findOne({ companyId: req.user.companyId });
            const userCount = await User.countDocuments({ companyId: req.user.companyId });

            if (subscription && subscription.features && typeof subscription.features.maxUsers === 'number' && userCount >= subscription.features.maxUsers) {
                console.log(`Límite de usuarios alcanzado para compañía ${req.user.companyId}: ${userCount}/${subscription.features.maxUsers}`);
                return res.status(403).json({
                    success: false,
                    message: `Ha alcanzado el límite de usuarios (${subscription.features.maxUsers}) para su plan actual.`,
                    limit: subscription.features.maxUsers,
                    current: userCount
                });
            } else if (!subscription) {
                 console.warn(`No se encontró suscripción para compañía ${req.user.companyId}. Se permite la creación (revisar lógica).`);
                 // Aquí podrías decidir si permitir o bloquear si no hay suscripción
            } else {
                 console.log(`Límites de usuarios OK para compañía ${req.user.companyId}: ${userCount}/${subscription.features?.maxUsers ?? 'Ilimitado'}`);
            }
            */
           // --- FIN Bloque comentado ---
           console.log("Verificación de límites desactivada temporalmente"); // Mantener este log mientras el bloque esté comentado


            // Verificar si ya existe un usuario con el mismo email
            const existingUser = await User.findOne({ email: email.toLowerCase() });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: `El email '${email}' ya está registrado. Por favor, utiliza otro.`
                });
            }

            // --- MODIFICADO: Usar la contraseña proporcionada por el admin ---
            // const tempPassword = crypto.randomBytes(10).toString('hex'); // Ya no generamos contraseña temporal

            // Crear instancia del nuevo usuario
            const newUser = new User({
                nombre: nombre.trim(),
                email: email.toLowerCase().trim(),
                password: password, // Usar la contraseña del formulario
                companyId: req.user.companyId,
                role: role,
                active: true
            });

            // Guardar el usuario (Mongoose se encarga del hash pre-save)
            const savedUser = await newUser.save();

            // --- MODIFICADO: Ya no se envía email con contraseña temporal ---
            // Enviar email de bienvenida (sin contraseña) si el servicio está activo
            /*
            try {
                 const company = await Company.findById(req.user.companyId);
                 await emailService.sendWelcomeEmail( // Tendría que ser una versión sin contraseña
                     savedUser.email,
                     {
                         nombre: savedUser.nombre,
                         email: savedUser.email,
                         // password: tempPassword, // NO ENVIAR CONTRASEÑA
                         companyName: company ? company.nombre : 'Tu Empresa',
                         role: savedUser.role
                     }
                 );
            } catch (emailError) {
                 console.error(`Usuario ${savedUser.email} creado, pero falló el envío del email de bienvenida:`, emailError);
            }
            */
            console.log(`Usuario ${savedUser.email} creado. Recordar configurar el envío de email de bienvenida.`);


            // Responder con éxito
            res.status(201).json({
                success: true,
                // --- MODIFICADO: Mensaje ya no menciona email con credenciales ---
                message: 'Usuario creado correctamente.',
                user: {
                    id: savedUser._id,
                    nombre: savedUser.nombre,
                    email: savedUser.email,
                    role: savedUser.role,
                    active: savedUser.active
                }
            });

        } catch (error) {
            console.error('Error detallado al crear usuario:', error); // Loguear el error completo
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

    // Actualizar usuario
    updateUser: async (req, res) => {
        try {
            const { id } = req.params;
            // --- MODIFICADO: Ahora puede recibir 'password' para actualizarla ---
            const { nombre, role, active, password } = req.body;

            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }

            const user = await User.findOne({ _id: id, companyId: req.user.companyId });
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }

            // Lógica para proteger al admin principal (sin cambios)
            const isFirstAdmin = await User.findOne({ companyId: req.user.companyId, role: 'admin' }).sort({ createdAt: 1 });
            if (isFirstAdmin && isFirstAdmin._id.toString() === id && req.user._id.toString() !== id) {
                if (typeof active !== 'undefined' && !active) {
                    return res.status(403).json({ success: false, message: 'No se puede desactivar al administrador principal' });
                }
                if (role && role !== 'admin') {
                    return res.status(403).json({ success: false, message: 'No se puede cambiar el rol del administrador principal' });
                }
                 if (password) { // No permitir cambiar contraseña del admin principal por otro admin
                     return res.status(403).json({ success: false, message: 'No se puede cambiar la contraseña del administrador principal directamente.' });
                 }
            }

            // Actualizar campos
            if (nombre) user.nombre = nombre.trim();
            if (role) user.role = role;
            if (typeof active !== 'undefined') user.active = active;
            // --- MODIFICADO: Actualizar contraseña solo si se proporciona una nueva ---
            if (password) {
                 // Validación simple de longitud
                 if (password.length < 6) {
                     return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
                 }
                 user.password = password; // El pre-save hook se encargará del hash
                 console.log(`Contraseña actualizada para usuario ${user.email}`);
            }


            const updatedUser = await user.save(); // Mongoose validation on save
            res.json({
                success: true,
                message: 'Usuario actualizado correctamente',
                // No devolver el usuario completo aquí por seguridad si no es necesario
                user: { id: updatedUser._id, nombre: updatedUser.nombre, email: updatedUser.email, role: updatedUser.role, active: updatedUser.active }
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

    // Eliminar usuario (sin cambios relevantes)
    deleteUser: async (req, res) => {
        try {
            const { id } = req.params;
            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }
            if (id === req.user._id.toString()) {
                return res.status(400).json({ success: false, message: 'No puedes eliminar tu propio usuario' });
            }
            const user = await User.findOne({ _id: id, companyId: req.user.companyId });
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }
            const isFirstAdmin = await User.findOne({ companyId: req.user.companyId, role: 'admin' }).sort({ createdAt: 1 });
            if (isFirstAdmin && isFirstAdmin._id.toString() === id) {
                return res.status(403).json({ success: false, message: 'No se puede eliminar al administrador principal' });
            }
            await User.deleteOne({ _id: id });
            res.json({ success: true, message: 'Usuario eliminado correctamente' });
        } catch (error) {
            console.error('Error al eliminar usuario:', error);
            res.status(500).json({ success: false, message: 'Error al eliminar usuario', error: error.message });
        }
    },

    // Restablecer contraseña (por parte del administrador)
    // Mantenemos esta función separada, genera contraseña temporal y la envía por email (si está configurado)
    resetUserPassword: async (req, res) => {
        try {
            const { id } = req.params;
            if (!req.user || !req.user.companyId || req.user.role !== 'admin') {
                 // Permitir también al 'manager' restablecer contraseñas si se decide
                return res.status(403).json({ success: false, message: 'No autorizado para restablecer contraseñas.' });
            }

             // No permitir restablecer la contraseña del admin principal
             const isFirstAdmin = await User.findOne({ companyId: req.user.companyId, role: 'admin' }).sort({ createdAt: 1 });
             if (isFirstAdmin && isFirstAdmin._id.toString() === id) {
                 return res.status(403).json({ success: false, message: 'No se puede restablecer la contraseña del administrador principal desde aquí.' });
             }
             // No permitir restablecer la propia contraseña desde aquí (usar cambio de contraseña)
             if (req.user._id.toString() === id) {
                  return res.status(400).json({ success: false, message: 'Usa la opción "Cambiar mi contraseña" para tu propia cuenta.' });
             }


            const user = await User.findOne({ _id: id, companyId: req.user.companyId });
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }

            const newPassword = crypto.randomBytes(10).toString('hex');
            user.password = newPassword; // Mongoose pre-save hook will hash it
            await user.save();

            // Enviar email con nueva contraseña (si el servicio está configurado)
            try {
                const company = await Company.findById(req.user.companyId);
                await emailService.sendPasswordResetByAdminEmail( user.email, { nombre: user.nombre, email: user.email, password: newPassword, companyName: company ? company.nombre : 'Tu Empresa', adminName: req.user.nombre });
                 res.json({ success: true, message: 'Contraseña restablecida. Se ha enviado un email con la nueva contraseña.' });
            } catch(emailError) {
                 console.error(`Contraseña restablecida para ${user.email}, pero falló envío de email:`, emailError);
                 // Informar al admin que el email falló pero la contraseña sí se cambió
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

    // Actualizar propio perfil (usuario actual - sin cambios relevantes)
    updateProfile: async (req, res) => {
        try {
            // Solo permitir actualizar nombre y quizás otros campos no sensibles
            const { nombre } = req.body;
            if (!req.user) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }
            const user = await User.findById(req.user._id);
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }
            if (nombre) user.nombre = nombre.trim();
            // Añadir aquí otros campos que el usuario pueda modificar de sí mismo
            // user.telefono = telefono;
            // user.preferencias = preferencias;

            const updatedUser = await user.save();
            res.json({
                success: true,
                message: 'Perfil actualizado correctamente',
                // Devolver solo la información necesaria y segura
                user: { id: updatedUser._id, nombre: updatedUser.nombre, email: updatedUser.email, role: updatedUser.role }
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
    }
};

module.exports = userController;