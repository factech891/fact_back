// middleware/subscription.middleware.js
const Company = require('../models/company.model');
const Subscription = require('../models/subscription.model');

const subscriptionMiddleware = {
    // Middleware para verificar si la suscripción está activa
    checkSubscriptionStatus: async (req, res, next) => {
        try {
            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
            }
            
            const company = await Company.findById(req.user.companyId);
            
            if (!company) {
                return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });
            }
            
            // Verificar si está en periodo de prueba
            const now = new Date();
            if (company.subscription.status === 'trial' && company.subscription.trialEndDate > now) {
                // Aún está en periodo de prueba, permitir acceso
                return next();
            }
            
            // Verificar si la suscripción está activa
            if (company.subscription.status !== 'active') {
                return res.status(403).json({ 
                    success: false, 
                    message: 'La suscripción ha expirado o ha sido cancelada.',
                    subscriptionStatus: company.subscription.status
                });
            }
            
            // Verificar fecha de vencimiento si existe
            if (company.subscription.subscriptionEndDate && company.subscription.subscriptionEndDate < now) {
                // Actualizar estado a expirado
                company.subscription.status = 'expired';
                await company.save();
                
                return res.status(403).json({ 
                    success: false, 
                    message: 'La suscripción ha expirado.',
                    subscriptionStatus: 'expired'
                });
            }
            
            // Todo está bien, continuar
            next();
        } catch (error) {
            console.error('Error al verificar suscripción:', error);
            return res.status(500).json({ success: false, message: 'Error al verificar estado de suscripción.' });
        }
    },
    
    // Middleware para verificar límites según el plan
    checkPlanLimits: (resourceType) => {
        return async (req, res, next) => {
            try {
                if (!req.user || !req.user.companyId) {
                    return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
                }
                
                // Si es una solicitud GET, permitir sin verificar límites
                if (req.method === 'GET') {
                    return next();
                }
                
                const subscription = await Subscription.findOne({ companyId: req.user.companyId });
                
                if (!subscription) {
                    return res.status(404).json({ success: false, message: 'Información de suscripción no encontrada.' });
                }
                
                // Verificar límites según el tipo de recurso
                switch(resourceType) {
                    case 'users':
                        const userCount = await require('../models/user.model').countDocuments({ companyId: req.user.companyId });
                        if (userCount >= subscription.features.maxUsers) {
                            return res.status(403).json({ 
                                success: false, 
                                message: `Ha alcanzado el límite de usuarios (${subscription.features.maxUsers}) para su plan actual.`,
                                limit: subscription.features.maxUsers,
                                current: userCount
                            });
                        }
                        break;
                    case 'clients':
                        const clientCount = await require('../models/client.model').countDocuments({ companyId: req.user.companyId });
                        if (clientCount >= subscription.features.maxClients) {
                            return res.status(403).json({ 
                                success: false, 
                                message: `Ha alcanzado el límite de clientes (${subscription.features.maxClients}) para su plan actual.`,
                                limit: subscription.features.maxClients,
                                current: clientCount
                            });
                        }
                        break;
                    case 'products':
                        const productCount = await require('../models/product.model').countDocuments({ companyId: req.user.companyId });
                        if (productCount >= subscription.features.maxProducts) {
                            return res.status(403).json({ 
                                success: false, 
                                message: `Ha alcanzado el límite de productos (${subscription.features.maxProducts}) para su plan actual.`,
                                limit: subscription.features.maxProducts,
                                current: productCount
                            });
                        }
                        break;
                    case 'invoices':
                        // Verificar número de facturas en el mes actual
                        const startOfMonth = new Date();
                        startOfMonth.setDate(1);
                        startOfMonth.setHours(0, 0, 0, 0);
                        
                        const invoiceCount = await require('../models/invoice.model').countDocuments({ 
                            companyId: req.user.companyId,
                            createdAt: { $gte: startOfMonth }
                        });
                        
                        if (invoiceCount >= subscription.features.maxInvoicesPerMonth) {
                            return res.status(403).json({ 
                                success: false, 
                                message: `Ha alcanzado el límite de facturas mensuales (${subscription.features.maxInvoicesPerMonth}) para su plan actual.`,
                                limit: subscription.features.maxInvoicesPerMonth,
                                current: invoiceCount
                            });
                        }
                        break;
                }
                
                // Todo está bien, continuar
                next();
            } catch (error) {
                console.error('Error al verificar límites del plan:', error);
                return res.status(500).json({ success: false, message: 'Error al verificar límites de suscripción.' });
            }
        };
    }
};

module.exports = subscriptionMiddleware;