// controllers/subscription.controller.js
const subscriptionService = require('../services/subscription.service');
const Company = require('../models/company.model');
const Subscription = require('../models/subscription.model');

const subscriptionController = {
    // Obtener información de suscripción
    getSubscriptionInfo: async (req, res) => {
        try {
            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }
            
            const result = await subscriptionService.getSubscriptionInfo(req.user.companyId);
            
            if (!result.success) {
                return res.status(404).json(result);
            }
            
            res.json(result);
        } catch (error) {
            console.error('Error al obtener información de suscripción:', error);
            res.status(500).json({ success: false, message: 'Error al obtener información de suscripción', error: error.message });
        }
    },
    
    // Actualizar plan de suscripción
    updateSubscriptionPlan: async (req, res) => {
        try {
            if (!req.user || !req.user.companyId || req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'No autorizado' });
            }
            
            const result = await subscriptionService.updateSubscriptionPlan(req.user.companyId, req.body);
            
            if (!result.success) {
                return res.status(400).json(result);
            }
            
            res.json(result);
        } catch (error) {
            console.error('Error al actualizar plan de suscripción:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar plan de suscripción', error: error.message });
        }
    },
    
    // Registrar pago de suscripción
    registerPayment: async (req, res) => {
        try {
            if (!req.user || !req.user.companyId || req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'No autorizado' });
            }
            
            const result = await subscriptionService.registerPayment(req.user.companyId, req.body);
            
            if (!result.success) {
                return res.status(400).json(result);
            }
            
            res.json(result);
        } catch (error) {
            console.error('Error al registrar pago:', error);
            res.status(500).json({ success: false, message: 'Error al registrar pago', error: error.message });
        }
    },
    
    // Cancelar suscripción
    cancelSubscription: async (req, res) => {
        try {
            if (!req.user || !req.user.companyId || req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'No autorizado' });
            }
            
            const result = await subscriptionService.cancelSubscription(req.user.companyId);
            
            if (!result.success) {
                return res.status(400).json(result);
            }
            
            res.json(result);
        } catch (error) {
            console.error('Error al cancelar suscripción:', error);
            res.status(500).json({ success: false, message: 'Error al cancelar suscripción', error: error.message });
        }
    },
    
    // Obtener planes disponibles
    getAvailablePlans: async (req, res) => {
        try {
            // Definir planes disponibles
            const plans = [
                {
                    id: 'free',
                    name: 'Plan Gratuito',
                    price: 0,
                    description: 'Funcionalidades básicas para pequeñas empresas',
                    features: [
                        'Hasta 3 usuarios',
                        'Hasta 50 clientes',
                        'Hasta 50 productos',
                        'Hasta 30 facturas por mes',
                        'Soporte básico por email'
                    ],
                    limits: {
                        maxUsers: 3,
                        maxClients: 50,
                        maxProducts: 50,
                        maxInvoicesPerMonth: 30,
                        advancedReports: false,
                        customBranding: false,
                        supportIncluded: false
                    }
                },
                {
                    id: 'basic',
                    name: 'Plan Básico',
                    price: 19.99,
                    description: 'Ideal para empresas en crecimiento',
                    features: [
                        'Hasta 10 usuarios',
                        'Hasta 200 clientes',
                        'Hasta 200 productos',
                        'Hasta 100 facturas por mes',
                        'Reportes avanzados',
                        'Soporte prioritario'
                    ],
                    limits: {
                        maxUsers: 10,
                        maxClients: 200,
                        maxProducts: 200,
                        maxInvoicesPerMonth: 100,
                        advancedReports: true,
                        customBranding: false,
                        supportIncluded: false
                    }
                },
                {
                    id: 'premium',
                    name: 'Plan Premium',
                    price: 39.99,
                    description: 'Todas las funcionalidades para empresas medianas y grandes',
                    features: [
                        'Usuarios ilimitados',
                        'Clientes ilimitados',
                        'Productos ilimitados',
                        'Facturas ilimitadas',
                        'Reportes avanzados',
                        'Personalización de marca',
                        'Soporte prioritario 24/7'
                    ],
                    limits: {
                        maxUsers: 999,
                        maxClients: 999,
                        maxProducts: 999,
                        maxInvoicesPerMonth: 999,
                        advancedReports: true,
                        customBranding: true,
                        supportIncluded: true
                    }
                }
            ];
            
            res.json({
                success: true,
                plans
            });
        } catch (error) {
            console.error('Error al obtener planes disponibles:', error);
            res.status(500).json({ success: false, message: 'Error al obtener planes disponibles', error: error.message });
        }
    },
    
    // Verificar estado de trial
    checkTrialStatus: async (req, res) => {
        try {
            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }
            
            const company = await Company.findById(req.user.companyId);
            
            if (!company) {
                return res.status(404).json({ success: false, message: 'Empresa no encontrada' });
            }
            
            const now = new Date();
            const trialEndDate = company.subscription.trialEndDate;
            const isTrialActive = company.subscription.status === 'trial' && trialEndDate > now;
            const daysLeft = isTrialActive ? Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24)) : 0;
            
            res.json({
                success: true,
                isTrialActive,
                trialEndDate,
                daysLeft,
                status: company.subscription.status
            });
        } catch (error) {
            console.error('Error al verificar estado de trial:', error);
            res.status(500).json({ success: false, message: 'Error al verificar estado de trial', error: error.message });
        }
    },
    
    // Extender periodo de prueba (solo para administradores del sistema)
    extendTrial: async (req, res) => {
        try {
            // Esta ruta debería estar protegida a nivel de sistema, no solo a nivel de empresa
            // Aquí podríamos verificar un token especial de administrador del sistema
            
            const { companyId, days } = req.body;
            
            if (!companyId || !days || isNaN(parseInt(days))) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Se requiere ID de empresa y días válidos' 
                });
            }
            
            const company = await Company.findById(companyId);
            
            if (!company) {
                return res.status(404).json({ success: false, message: 'Empresa no encontrada' });
            }
            
            // Calcular nueva fecha fin de trial
            const trialEndDate = company.subscription.trialEndDate || new Date();
            const newTrialEndDate = new Date(trialEndDate);
            newTrialEndDate.setDate(newTrialEndDate.getDate() + parseInt(days));
            
            // Actualizar estado a trial si no lo estaba
            company.subscription.status = 'trial';
            company.subscription.trialEndDate = newTrialEndDate;
            await company.save();
            
            // Actualizar también en la colección de suscripciones
            const subscription = await Subscription.findOne({ companyId });
            if (subscription) {
                subscription.status = 'trial';
                subscription.endDate = newTrialEndDate;
                await subscription.save();
            }
            
            res.json({
                success: true,
                message: `Periodo de prueba extendido por ${days} días.`,
                newTrialEndDate
            });
        } catch (error) {
            console.error('Error al extender periodo de prueba:', error);
            res.status(500).json({ success: false, message: 'Error al extender periodo de prueba', error: error.message });
        }
    },
    
    // Obtener historial de pagos
    getPaymentHistory: async (req, res) => {
        try {
            if (!req.user || !req.user.companyId || req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'No autorizado' });
            }
            
            const subscription = await Subscription.findOne({ companyId: req.user.companyId });
            
            if (!subscription) {
                return res.status(404).json({ success: false, message: 'Información de suscripción no encontrada' });
            }
            
            // Ordenar por fecha descendente
            const paymentHistory = subscription.paymentHistory.sort((a, b) => 
                new Date(b.paymentDate) - new Date(a.paymentDate)
            );
            
            res.json({
                success: true,
                paymentHistory
            });
        } catch (error) {
            console.error('Error al obtener historial de pagos:', error);
            res.status(500).json({ success: false, message: 'Error al obtener historial de pagos', error: error.message });
        }
    },
    
    // Actualizar información de facturación
    updateBillingInfo: async (req, res) => {
        try {
            if (!req.user || !req.user.companyId || req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'No autorizado' });
            }
            
            const { billingInfo } = req.body;
            
            if (!billingInfo) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Se requiere información de facturación' 
                });
            }
            
            const subscription = await Subscription.findOne({ companyId: req.user.companyId });
            
            if (!subscription) {
                return res.status(404).json({ success: false, message: 'Información de suscripción no encontrada' });
            }
            
            // Actualizar información de facturación
            subscription.billingInfo = {
                ...subscription.billingInfo,
                ...billingInfo
            };
            
            await subscription.save();
            
            res.json({
                success: true,
                message: 'Información de facturación actualizada correctamente',
                billingInfo: subscription.billingInfo
            });
        } catch (error) {
            console.error('Error al actualizar información de facturación:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar información de facturación', error: error.message });
        }
    },
    
    // Obtener estadísticas de uso actual
    getUsageStats: async (req, res) => {
        try {
            if (!req.user || !req.user.companyId) {
                return res.status(401).json({ success: false, message: 'No autenticado' });
            }
            
            const companyId = req.user.companyId;
            
            // Obtener conteos de diferentes recursos
            const userCount = await require('../models/user.model').countDocuments({ companyId });
            const clientCount = await require('../models/client.model').countDocuments({ companyId });
            const productCount = await require('../models/product.model').countDocuments({ companyId });
            
            // Contar facturas del mes actual
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            
            const invoiceCount = await require('../models/invoice.model').countDocuments({ 
                companyId,
                createdAt: { $gte: startOfMonth }
            });
            
            // Obtener límites de suscripción
            const subscription = await Subscription.findOne({ companyId });
            
            if (!subscription) {
                return res.status(404).json({ success: false, message: 'Información de suscripción no encontrada' });
            }
            
            const { features } = subscription;
            
            res.json({
                success: true,
                usageStats: {
                    users: {
                        current: userCount,
                        limit: features.maxUsers,
                        percentage: (userCount / features.maxUsers) * 100
                    },
                    clients: {
                        current: clientCount,
                        limit: features.maxClients,
                        percentage: (clientCount / features.maxClients) * 100
                    },
                    products: {
                        current: productCount,
                        limit: features.maxProducts,
                        percentage: (productCount / features.maxProducts) * 100
                    },
                    invoicesThisMonth: {
                        current: invoiceCount,
                        limit: features.maxInvoicesPerMonth,
                        percentage: (invoiceCount / features.maxInvoicesPerMonth) * 100
                    },
                    features: {
                        advancedReports: features.advancedReports,
                        customBranding: features.customBranding,
                        supportIncluded: features.supportIncluded
                    }
                }
            });
        } catch (error) {
            console.error('Error al obtener estadísticas de uso:', error);
            res.status(500).json({ success: false, message: 'Error al obtener estadísticas de uso', error: error.message });
        }
    }
};

module.exports = subscriptionController;