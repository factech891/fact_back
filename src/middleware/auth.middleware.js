// middleware/auth.middleware.js 
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Company = require('../models/company.model'); // Añadimos esta importación

const authMiddleware = {
    // Middleware para verificar token
    authenticateToken: async (req, res, next) => {
        // --- LOG INICIAL ---
        console.log(`>>> authMiddleware.authenticateToken ejecutado para: ${req.method} ${req.originalUrl}`);
        // --- FIN LOG ---
        try {
            // Obtener el token del header de autorización
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
            console.log('Token recibido:', token ? 'Sí' : 'No');

            if (!token) {
                console.log('Error: Token no proporcionado.');
                return res.status(401).json({ success: false, message: 'Acceso denegado. Token no proporcionado.' });
            }

            // Verificar el token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('Token decodificado - userId:', decoded.userId);

            // Buscar el usuario por id y seleccionar campos necesarios
            const user = await User.findById(decoded.userId).select('_id email role active companyId').lean();

            if (!user) {
                console.log('Error: Usuario no encontrado para el ID del token.');
                return res.status(401).json({ success: false, message: 'Usuario no encontrado o token inválido.' });
            }

            console.log('Usuario encontrado:', user.email, '- Rol:', user.role, '- Activo:', user.active, '- CompanyId:', user.companyId);

            if (!user.active) {
                console.log('Error: Usuario encontrado pero está inactivo.');
                return res.status(403).json({ success: false, message: 'Usuario desactivado. Contacte al administrador.' });
            }

            // NUEVO: Verificar el estado de la empresa asociada al usuario
            // Solo para usuarios que no sean administradores de plataforma
            if (user.companyId && user.role !== 'platform_admin') {
                console.log('Verificando estado de empresa con ID:', user.companyId);
                
                const company = await Company.findById(user.companyId).lean();
                
                if (!company) {
                    console.log('Error: Empresa no encontrada para el usuario.');
                    return res.status(403).json({ 
                        success: false, 
                        message: 'Empresa no encontrada. Contacte al administrador.',
                        errorCode: 'COMPANY_NOT_FOUND'
                    });
                }
                
                // Verificar si la empresa está activa
                if (!company.active) {
                    console.log('Error: La empresa del usuario está bloqueada (inactive).');
                    return res.status(403).json({ 
                        success: false, 
                        message: 'Empresa bloqueada. Contacte al administrador del sistema.',
                        errorCode: 'COMPANY_BLOCKED'
                    });
                }
                
                // Verificar el estado de la suscripción
                if (company.subscription && ['expired', 'cancelled'].includes(company.subscription.status)) {
                    console.log(`Error: La empresa tiene estado de suscripción: ${company.subscription.status}`);
                    return res.status(403).json({ 
                        success: false, 
                        message: 'Suscripción suspendida. Contacte al administrador del sistema.',
                        errorCode: 'SUBSCRIPTION_SUSPENDED'
                    });
                }
                
                console.log('Empresa verificada correctamente. Estado:', company.active, '- Suscripción:', company.subscription.status);
            }

            // Guardar información esencial del usuario en la solicitud
            req.user = {
                id: user._id,
                email: user.email,
                role: user.role,
                active: user.active,
                companyId: user.companyId
            };

            console.log('Usuario asignado a req.user. Rol:', req.user.role, 'CompanyId:', req.user.companyId);
            console.log('--- Finalizando authenticateToken (éxito) ---');
            next();
        } catch (error) {
            console.error('Error en autenticación:', error.message);
            if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
                console.log('Error: Token inválido o expirado.');
                return res.status(401).json({ success: false, message: 'Token inválido o expirado.' });
            } else {
                console.log('Error inesperado en authenticateToken:', error);
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
                return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
            }
            console.log('checkRole: Rol requerido:', roles, '- Rol del usuario:', req.user.role);
            const requiredRoles = Array.isArray(roles) ? roles : [roles];
            if (!requiredRoles.includes(req.user.role)) {
                console.log('Error checkRole: El rol del usuario NO está incluido en los roles permitidos.');
                return res.status(403).json({ success: false, message: 'No tiene permiso para acceder a este recurso.' });
            }
            console.log('checkRole: Permiso concedido.');
            next();
        };
    }
};

module.exports = authMiddleware;