// middleware/subscription.middleware.js
const Company = require('../models/company.model');
const Subscription = require('../models/subscription.model'); // Asegúrate que la ruta sea correcta
const User = require('../models/user.model'); // Importar User para contar
const Client = require('../models/client.model'); // Importar Client para contar
const Product = require('../models/product.model'); // Importar Product para contar
const Invoice = require('../models/invoice.model'); // Importar Invoice para contar

const subscriptionMiddleware = {
    // Middleware para verificar si la suscripción está activa (modificado para desarrollo)
    checkSubscriptionStatus: async (req, res, next) => {
        try {
            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
            }

            const company = await Company.findById(req.user.companyId).populate('subscription');

            if (!company) {
                return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });
            }

            const subscriptionInfo = company.subscription;

            if (!subscriptionInfo) {
                console.error(`Error crítico: No se encontró información de suscripción para la compañía ${req.user.companyId}`);
                return res.status(403).json({
                    success: false,
                    message: 'No se encontró información de suscripción asociada a esta empresa.',
                    subscriptionStatus: 'missing'
                });
            }

            const now = new Date();
            
            // SOLUCIÓN 2: Lógica mejorada para suscripciones trial
            if (subscriptionInfo.status === 'trial') {
                if (!subscriptionInfo.trialEndDate) {
                    console.log(`Advertencia: Compañía ${req.user.companyId} tiene trial sin fecha de finalización.`);
                    // Permitir acceso durante desarrollo
                    return next(); 
                }
                
                const trialEndDate = new Date(subscriptionInfo.trialEndDate);
                console.log(`Compañía ${req.user.companyId} - Trial hasta: ${trialEndDate.toISOString()}, Fecha actual: ${now.toISOString()}`);
                
                if (trialEndDate > now) {
                    console.log(`Acceso permitido: Compañía ${req.user.companyId} en periodo de prueba vigente.`);
                    return next();
                } else {
                    console.log(`Trial expirado para compañía ${req.user.companyId}. Actualizando estado.`);
                    // Durante desarrollo, permitir acceso aunque haya expirado
                    // await Company.findByIdAndUpdate(req.user.companyId, { $set: { 'subscription.status': 'trial_expired' } });
                    return next(); // Permite acceso aunque el trial esté expirado (solo en dev)
                }
            }

            if (subscriptionInfo.status !== 'active') {
                console.log(`Acceso denegado: Compañía ${req.user.companyId} con suscripción ${subscriptionInfo.status}.`);
                return res.status(403).json({
                    success: false,
                    message: 'La suscripción no está activa (expirada, cancelada o en prueba finalizada).',
                    subscriptionStatus: subscriptionInfo.status
                });
            }

            if (subscriptionInfo.subscriptionEndDate && new Date(subscriptionInfo.subscriptionEndDate) < now) {
                if (company.subscription.status === 'active') {
                    console.log(`Suscripción expirada para compañía ${req.user.companyId}. Actualizando estado.`);
                    await Company.findByIdAndUpdate(req.user.companyId, { $set: { 'subscription.status': 'expired' } });
                }
                return res.status(403).json({
                    success: false,
                    message: 'La suscripción ha expirado.',
                    subscriptionStatus: 'expired'
                });
            }

            console.log(`Acceso permitido: Compañía ${req.user.companyId} con suscripción activa.`);
            next();
        } catch (error) {
            console.error('Error en checkSubscriptionStatus:', error);
            return res.status(500).json({ success: false, message: 'Error interno al verificar estado de suscripción.' });
        }
    },

    // Middleware para verificar límites según el plan
    checkPlanLimits: (resourceType) => {
        return async (req, res, next) => {
            try {
                if (!req.user || !req.user.companyId) {
                    return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
                }

                const subscription = await Subscription.findOne({ companyId: req.user.companyId });

                if (!subscription) {
                    // --- MODIFICACIÓN TEMPORAL ---
                    // En lugar de bloquear si no hay suscripción, permitimos continuar.
                    // ¡¡¡RECORDATORIO: Eliminar este bypass y manejar correctamente el caso sin suscripción!!!
                    // (Ej: Crear una suscripción 'free' o 'trial' por defecto al registrar la empresa)
                    console.warn(`BYPASS TEMPORAL: No se encontró suscripción para compañía ${req.user.companyId}. Permitiendo acceso sin verificar límites.`);
                    return next(); // <-- PERMITIR CONTINUAR
                }

                // SOLUCIÓN PARA CORREGIR LA LÓGICA DE VALIDACIÓN EN TRIAL
                const now = new Date();
                if (subscription.status === 'trial') {
                    // Si es trial, verificar si está dentro del período válido
                    if (subscription.trialEndDate && new Date(subscription.trialEndDate) > now) {
                        console.log(`Usuario en trial (${req.user.companyId}), verificando límites para ${resourceType}...`);
                        // Continúa con verificación de límites - no bloqueamos aquí
                    } else {
                        // Durante desarrollo, permitimos incluso trials expirados
                        console.log(`NOTA DEV: Trial posiblemente expirado para compañía ${req.user.companyId}, pero permitimos acceso.`);
                        // No bloqueamos durante desarrollo
                    }
                } else if (subscription.status !== 'active') {
                    // Si no es ni trial ni active, denegar acceso
                    console.log(`Acción denegada: Suscripción no activa (${subscription.status}) para compañía ${req.user.companyId}.`);
                    return res.status(403).json({
                        success: false,
                        message: `La suscripción (${subscription.status}) no permite crear o modificar ${resourceType}.`,
                        subscriptionStatus: subscription.status
                    });
                }

                // Verificar límites según el tipo de recurso
                let limit = Infinity;
                let currentCount = 0;
                let limitReached = false;

                switch(resourceType) {
                    case 'users':
                        limit = subscription.features?.maxUsers;
                        if (typeof limit !== 'number') {
                             console.warn(`Límite de usuarios no definido para plan ${subscription.planName}. Permitiendo por defecto.`);
                             limit = Infinity;
                        } else {
                            currentCount = await User.countDocuments({ companyId: req.user.companyId });
                            limitReached = currentCount >= limit;
                        }
                        break;
                    case 'clients':
                        limit = subscription.features?.maxClients;
                         if (typeof limit !== 'number') {
                             console.warn(`Límite de clientes no definido para plan ${subscription.planName}. Permitiendo por defecto.`);
                             limit = Infinity;
                        } else {
                            currentCount = await Client.countDocuments({ companyId: req.user.companyId });
                            limitReached = currentCount >= limit;
                        }
                        break;
                    case 'products':
                        limit = subscription.features?.maxProducts;
                         if (typeof limit !== 'number') {
                             console.warn(`Límite de productos no definido para plan ${subscription.planName}. Permitiendo por defecto.`);
                             limit = Infinity;
                        } else {
                            currentCount = await Product.countDocuments({ companyId: req.user.companyId });
                            limitReached = currentCount >= limit;
                        }
                        break;
                    case 'invoices':
                         limit = subscription.features?.maxInvoicesPerMonth;
                         if (typeof limit !== 'number') {
                             console.warn(`Límite de facturas mensuales no definido para plan ${subscription.planName}. Permitiendo por defecto.`);
                             limit = Infinity;
                         } else {
                            const startOfMonth = new Date();
                            startOfMonth.setDate(1);
                            startOfMonth.setHours(0, 0, 0, 0);
                            currentCount = await Invoice.countDocuments({
                                companyId: req.user.companyId,
                                createdAt: { $gte: startOfMonth }
                            });
                            limitReached = currentCount >= limit;
                         }
                        break;
                    default:
                        console.warn(`Tipo de recurso desconocido para límite de plan: ${resourceType}`);
                        break;
                }

                if (limitReached && limit !== Infinity) {
                    console.log(`Límite alcanzado para ${resourceType}: ${currentCount}/${limit} para compañía ${req.user.companyId}`);
                    return res.status(403).json({
                        success: false,
                        message: `Ha alcanzado el límite de ${resourceType} (${limit}) para su plan actual.`,
                        limit: limit,
                        current: currentCount
                    });
                }

                console.log(`Límite OK para ${resourceType}: ${currentCount}/${limit === Infinity ? 'Ilimitado' : limit} para compañía ${req.user.companyId}`);
                next();
            } catch (error) {
                console.error(`Error en checkPlanLimits para ${resourceType}:`, error);
                return res.status(500).json({ success: false, message: 'Error interno al verificar límites de suscripción.' });
            }
        };
    }
};

module.exports = subscriptionMiddleware;