// middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/user.model'); // Asegúrate que la ruta sea correcta

const authMiddleware = {
    // Middleware para verificar token
    authenticateToken: async (req, res, next) => {
        console.log('--- Iniciando authenticateToken ---');
        try {
            // Obtener el token del header de autorización
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
            console.log('Token recibido:', token ? 'Sí' : 'No');

            if (!token) {
                console.log('Error: Token no proporcionado.');
                // 401 Unauthorized: Falta autenticación
                return res.status(401).json({ success: false, message: 'Acceso denegado. Token no proporcionado.' });
            }

            // Verificar el token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('Token decodificado - userId:', decoded.userId);

            // Buscar el usuario por id y seleccionar campos necesarios
            // Asegúrate de que el modelo User tenga el campo 'companyId'
            const user = await User.findById(decoded.userId).select('_id email role active companyId').lean(); // Usamos .lean() para obtener un objeto JS plano

            if (!user) {
                console.log('Error: Usuario no encontrado para el ID del token.');
                 // 401 Unauthorized: Credenciales inválidas (token apunta a usuario inexistente)
                return res.status(401).json({ success: false, message: 'Usuario no encontrado o token inválido.' });
            }

            console.log('Usuario encontrado:', user.email, '- Rol:', user.role, '- Activo:', user.active, '- CompanyId:', user.companyId); // <-- LOG USER FOUND + CompanyId

            if (!user.active) {
                 console.log('Error: Usuario encontrado pero está inactivo.');
                 // 403 Forbidden: Autenticado pero no autorizado por estar inactivo
                return res.status(403).json({ success: false, message: 'Usuario desactivado. Contacte al administrador.' });
            }

            // Guardar información esencial del usuario en la solicitud para uso posterior
            // Incluimos explícitamente companyId
            req.user = {
                id: user._id, // Renombrado de _id a id para consistencia si se prefiere
                email: user.email,
                role: user.role,
                active: user.active,
                companyId: user.companyId // <-- Aseguramos que companyId está aquí
            };

            console.log('Usuario asignado a req.user. Rol:', req.user.role, 'CompanyId:', req.user.companyId); // <-- LOG REQ.USER con CompanyId
            console.log('--- Finalizando authenticateToken (éxito) ---');
            next();
        } catch (error) {
            console.error('Error en autenticación:', error.message);
             // Diferenciar error de token inválido/expirado de otros errores
            if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
                 console.log('Error: Token inválido o expirado.');
                 // 401 Unauthorized: Token inválido o expirado
                 return res.status(401).json({ success: false, message: 'Token inválido o expirado.' });
            } else {
                 console.log('Error inesperado en authenticateToken:', error);
                 // 500 Internal Server Error: Otros errores
                 return res.status(500).json({ success: false, message: 'Error interno del servidor durante la autenticación.' });
            }
        }
    },

    // Middleware para verificar roles (sin cambios)
    checkRole: (roles) => {
        return (req, res, next) => {
            console.log('--- Iniciando checkRole ---');
            if (!req.user) {
                console.log('Error checkRole: req.user no existe.');
                // 401 Unauthorized: Se requiere autenticación previa
                return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
            }

            console.log('checkRole: Rol requerido:', roles, '- Rol del usuario:', req.user.role);

            // Asegurarse que roles sea un array
            const requiredRoles = Array.isArray(roles) ? roles : [roles];

            if (!requiredRoles.includes(req.user.role)) {
                console.log('Error checkRole: El rol del usuario NO está incluido en los roles permitidos.');
                // 403 Forbidden: Autenticado pero sin permisos suficientes
                return res.status(403).json({ success: false, message: 'No tiene permiso para acceder a este recurso.' });
            }
            console.log('checkRole: Permiso concedido.');
            next();
        };
    }
};

module.exports = authMiddleware;