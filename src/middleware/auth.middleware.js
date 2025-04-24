// middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const authMiddleware = {
    // Middleware para verificar token
    authenticateToken: async (req, res, next) => {
        console.log('--- Iniciando authenticateToken ---'); // <-- LOG INICIO
        try {
            // Obtener el token del header de autorización
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
            console.log('Token recibido:', token ? 'Sí' : 'No'); // <-- LOG TOKEN

            if (!token) {
                console.log('Error: Token no proporcionado.'); // <-- LOG ERROR
                return res.status(401).json({ success: false, message: 'Acceso denegado. Token no proporcionado.' });
            }

            // Verificar el token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('Token decodificado - userId:', decoded.userId); // <-- LOG DECODED ID

            // Buscar el usuario por id
            const user = await User.findById(decoded.userId);

            if (!user) {
                console.log('Error: Usuario no encontrado para el ID del token.'); // <-- LOG ERROR USER
                return res.status(401).json({ success: false, message: 'Usuario no encontrado o token inválido.' });
            }

            console.log('Usuario encontrado:', user.email, '- Rol:', user.role, '- Activo:', user.active); // <-- LOG USER FOUND

            if (!user.active) {
                 console.log('Error: Usuario encontrado pero está inactivo.'); // <-- LOG ERROR INACTIVE
                return res.status(403).json({ success: false, message: 'Usuario desactivado. Contacte al administrador.' });
            }

            // Guardar el usuario en la solicitud para uso posterior
            req.user = user;
            console.log('Usuario asignado a req.user. Rol:', req.user.role); // <-- LOG REQ.USER
            console.log('--- Finalizando authenticateToken (éxito) ---'); // <-- LOG FIN OK
            next();
        } catch (error) {
            console.error('Error en autenticación:', error.message); // <-- LOG ERROR CATCH
             // Diferenciar error de token inválido/expirado de otros errores
            if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
                 console.log('Error: Token inválido o expirado.');
                 return res.status(401).json({ success: false, message: 'Token inválido o expirado.' });
            } else {
                 console.log('Error inesperado en authenticateToken:', error);
                 return res.status(500).json({ success: false, message: 'Error interno del servidor durante la autenticación.' });
            }
        }
    },

    // Middleware para verificar roles
    checkRole: (roles) => {
        return (req, res, next) => {
            console.log('--- Iniciando checkRole ---'); // <-- LOG CHECKROLE START
            if (!req.user) {
                console.log('Error checkRole: req.user no existe.'); // <-- LOG CHECKROLE ERROR
                return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
            }

            console.log('checkRole: Rol requerido:', roles, '- Rol del usuario:', req.user.role); // <-- LOG CHECKROLE INFO

            if (!roles.includes(req.user.role)) {
                console.log('Error checkRole: El rol del usuario NO está incluido en los roles permitidos.'); // <-- LOG CHECKROLE FORBIDDEN
                return res.status(403).json({ success: false, message: 'No tiene permiso para acceder a este recurso.' });
            }
            console.log('checkRole: Permiso concedido.'); // <-- LOG CHECKROLE OK
            next();
        };
    }
};

module.exports = authMiddleware;