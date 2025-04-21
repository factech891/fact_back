// middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const authMiddleware = {
    // Middleware para verificar token
    authenticateToken: async (req, res, next) => {
        try {
            // Obtener el token del header de autorización
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
            
            if (!token) {
                return res.status(401).json({ success: false, message: 'Acceso denegado. Token no proporcionado.' });
            }
            
            // Verificar el token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Buscar el usuario por id
            const user = await User.findById(decoded.userId);
            
            if (!user) {
                return res.status(401).json({ success: false, message: 'Usuario no encontrado o token inválido.' });
            }
            
            if (!user.active) {
                return res.status(403).json({ success: false, message: 'Usuario desactivado. Contacte al administrador.' });
            }
            
            // Guardar el usuario en la solicitud para uso posterior
            req.user = user;
            next();
        } catch (error) {
            console.error('Error en autenticación:', error);
            return res.status(401).json({ success: false, message: 'Token inválido o expirado.' });
        }
    },
    
    // Middleware para verificar roles
    checkRole: (roles) => {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
            }
            
            if (!roles.includes(req.user.role)) {
                return res.status(403).json({ success: false, message: 'No tiene permiso para acceder a este recurso.' });
            }
            
            next();
        };
    }
};

module.exports = authMiddleware;