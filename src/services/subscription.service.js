// services/subscription.service.js
const Company = require('../models/company.model');
const Subscription = require('../models/subscription.model');
const emailService = require('./email.service');

const subscriptionService = {
    // Obtener información de suscripción
    getSubscriptionInfo: async (companyId) => {
        try {
            const subscription = await Subscription.findOne({ companyId });
            
            if (!subscription) {
                return {
                    success: false,
                    message: 'Información de suscripción no encontrada'
                };
            }
            
            return {
                success: true,
                subscription
            };
        } catch (error) {
            console.error('Error al obtener información de suscripción:', error);
            return {
                success: false,
                message: 'Error al obtener información de suscripción',
                error: error.message
            };
        }
    },
    
    // Actualizar plan de suscripción
    updateSubscriptionPlan: async (companyId, planData) => {
        try {
            const { plan, paymentMethod, billingInfo } = planData;
            
            // Buscar suscripción existente
            let subscription = await Subscription.findOne({ companyId });
            
            if (!subscription) {
                // Si no existe, crear una nueva
                subscription = new Subscription({
                    companyId,
                    plan: 'free',
                    status: 'trial'
                });
            }
            
            // Definir configuraciones del plan
            const planConfigs = {
                free: {
                    maxUsers: 3,
                    maxClients: 50,
                    maxProducts: 50,
                    maxInvoicesPerMonth: 30,
                    advancedReports: false,
                    customBranding: false,
                    supportIncluded: false
                },
                basic: {
                    maxUsers: 10,
                    maxClients: 200,
                    maxProducts: 200,
                    maxInvoicesPerMonth: 100,
                    advancedReports: true,
                    customBranding: false,
                    supportIncluded: false
                },
                premium: {
                    maxUsers: 999, // Ilimitado prácticamente
                    maxClients: 999, // Ilimitado prácticamente
                    maxProducts: 999, // Ilimitado prácticamente
                    maxInvoicesPerMonth: 999, // Ilimitado prácticamente
                    advancedReports: true,
                    customBranding: true,
                    supportIncluded: true
                }
            };
            
            // Actualizar datos de suscripción
            subscription.plan = plan;
            subscription.status = 'active';
            subscription.startDate = new Date();
            
            // Si es plan gratuito, no hay fecha de fin
            if (plan === 'free') {
                subscription.endDate = null;
            } else {
                // Por defecto, 1 mes de suscripción
                const endDate = new Date();
                endDate.setMonth(endDate.getMonth() + 1);
                subscription.endDate = endDate;
            }
            
            // Actualizar método de pago si se proporciona
            if (paymentMethod) {
                subscription.paymentMethod = paymentMethod;
            }
            
            // Actualizar información de facturación si se proporciona
            if (billingInfo) {
                subscription.billingInfo = billingInfo;
            }
            
            // Actualizar features según el plan
            subscription.features = planConfigs[plan] || planConfigs.free;
            
            // Guardar cambios
            await subscription.save();
            
            // Actualizar estado de suscripción en Company también
            const company = await Company.findById(companyId);
            if (company) {
                company.subscription.plan = plan;
                company.subscription.status = 'active';
                company.subscription.subscriptionStartDate = subscription.startDate;
                company.subscription.subscriptionEndDate = subscription.endDate;
                await company.save();
            }
            
            return {
                success: true,
                message: 'Plan de suscripción actualizado correctamente',
                subscription
            };
        } catch (error) {
            console.error('Error al actualizar plan de suscripción:', error);
            return {
                success: false,
                message: 'Error al actualizar plan de suscripción',
                error: error.message
            };
        }
    },
    
    // Registrar pago de suscripción
    registerPayment: async (companyId, paymentData) => {
        try {
            const { amount, currency, paymentMethod, paymentId, status } = paymentData;
            
            // Buscar suscripción
            const subscription = await Subscription.findOne({ companyId });
            
            if (!subscription) {
                return {
                    success: false,
                    message: 'Suscripción no encontrada'
                };
            }
            
            // Añadir registro de pago
            subscription.paymentHistory.push({
                amount,
                currency: currency || 'USD',
                paymentMethod,
                paymentDate: new Date(),
                paymentId,
                status
            });
            
            // Si el pago es exitoso, extender la suscripción
            if (status === 'completed') {
                // Por defecto, extender 1 mes
                const newEndDate = subscription.endDate ? new Date(subscription.endDate) : new Date();
                newEndDate.setMonth(newEndDate.getMonth() + 1);
                subscription.endDate = newEndDate;
                
                // Actualizar estado si estaba expirada
                if (subscription.status === 'expired') {
                    subscription.status = 'active';
                }
                
                // Actualizar en Company también
                const company = await Company.findById(companyId);
                if (company) {
                    company.subscription.status = 'active';
                    company.subscription.subscriptionEndDate = newEndDate;
                    await company.save();
                }
            }
            
            await subscription.save();
            
            return {
                success: true,
                message: 'Pago registrado correctamente',
                subscription
            };
        } catch (error) {
            console.error('Error al registrar pago:', error);
            return {
                success: false,
                message: 'Error al registrar pago',
                error: error.message
            };
        }
    },
    
    // Cancelar suscripción
    cancelSubscription: async (companyId) => {
        try {
            // Buscar suscripción
            const subscription = await Subscription.findOne({ companyId });
            
            if (!subscription) {
                return {
                    success: false,
                    message: 'Suscripción no encontrada'
                };
            }
            
            // Actualizar estado
            subscription.status = 'cancelled';
            await subscription.save();
            
            // Actualizar en Company también
            const company = await Company.findById(companyId);
            if (company) {
                company.subscription.status = 'cancelled';
                await company.save();
            }
            
            return {
                success: true,
                message: 'Suscripción cancelada correctamente'
            };
        } catch (error) {
            console.error('Error al cancelar suscripción:', error);
            return {
                success: false,
                message: 'Error al cancelar suscripción',
                error: error.message
            };
        }
    },
    
    // Verificar y actualizar estados de suscripciones vencidas
    checkExpiredSubscriptions: async () => {
        try {
            const now = new Date();
            
            // Buscar suscripciones activas con fecha de fin pasada
            const expiredSubscriptions = await Subscription.find({
                status: 'active',
                endDate: { $lt: now }
            });
            
            let updatedCount = 0;
            
            for (const subscription of expiredSubscriptions) {
                // Actualizar estado
                subscription.status = 'expired';
                await subscription.save();
                
                // Actualizar en Company también
                const company = await Company.findById(subscription.companyId);
                if (company) {
                    company.subscription.status = 'expired';
                    await company.save();
                }
                
                updatedCount++;
                
                // Enviar email de notificación (opcional)
                // ...
            }
            
            return {
                success: true,
                message: `${updatedCount} suscripciones actualizadas a estado expirado`
            };
        } catch (error) {
            console.error('Error al verificar suscripciones vencidas:', error);
            return {
                success: false,
                message: 'Error al verificar suscripciones vencidas',
                error: error.message
            };
        }
    }
};

module.exports = subscriptionService;