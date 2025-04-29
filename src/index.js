require('dotenv').config();

// Verificar las variables de entorno al inicio
console.log('Verificando variables de entorno de Cloudinary:');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME || 'No configurado');
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'Configurado' : 'No configurado');
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'Configurado' : 'No configurado');

// Configuración de Cloudinary
const cloudinary = require('cloudinary').v2;
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const express = require('express');
const cors = require('cors'); // Middleware CORS general para Express (rutas HTTP normales)
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const http = require('http'); // Necesario para Socket.io
const jwt = require('jsonwebtoken'); // Para verificar tokens en Socket.io

// Importar controladores y middlewares
const invoiceController = require('./controllers/invoice.controller');
const clientController = require('./controllers/client.controller');
const productController = require('./controllers/product.controller');
const companyController = require('./controllers/company.controller');
const documentController = require('./controllers/document.controller');
const authController = require('./controllers/auth.controller');
const userController = require('./controllers/user.controller');
const subscriptionController = require('./controllers/subscription.controller');
const notificationController = require('./controllers/notification.controller');
const authMiddleware = require('./middleware/auth.middleware');
const subscriptionMiddleware = require('./middleware/subscription.middleware');
const notificationService = require('./services/notification.service');
// --- Inicio Modificación: Añadir importaciones --- // Mantener estas importaciones
const platformAdminMiddleware = require('./middleware/platform-admin.middleware');
const platformAdminController = require('./controllers/platform-admin.controller');
// --- Fin Modificación: Añadir importaciones --- // Mantener estas importaciones

const app = express();
const server = http.createServer(app); // Crear servidor HTTP con Express

// --- Configuración de CORS para Socket.IO ---
// Lista de orígenes permitidos
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000', // Origen desde variable de entorno o localhost:3000
    'http://192.168.1.45:3000' // Añadir explícitamente la IP local desde donde accedes
];

console.log('Orígenes CORS permitidos para Socket.IO:', allowedOrigins);

const io = require('socket.io')(server, {
    cors: {
        origin: function (origin, callback) {
          // Permitir solicitudes sin origen (como Postman o apps móviles) o si el origen está en la lista
          if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
          } else {
            console.error(`Origen CORS no permitido para Socket.IO: ${origin}`);
            callback(new Error('Not allowed by CORS'));
          }
        },
        methods: ['GET', 'POST'], // Métodos permitidos
        credentials: true // Permitir credenciales (cookies, etc.)
    }
}); // Inicializar Socket.io con el servidor y la configuración CORS

const port = process.env.PORT || 5002;
const urlMongo = "mongodb://localhost:27017/testing";
const mongoDb = process.env.MONGODB_URI || urlMongo;

// Middleware para Socket.io (autenticación)
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        console.warn('Intento de conexión Socket.IO sin token.');
        return next(new Error('Authentication error: Token not provided'));
    }

    try {
        // Verificar token JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded; // Guardar información decodificada en el socket
        next(); // Continuar
    } catch (error) {
        console.error('Error de autenticación Socket.IO (Token inválido o expirado):', error.message);
        next(new Error('Authentication error: Invalid or expired token'));
    }
});

// Manejar conexiones de Socket.io
io.on('connection', (socket) => {
    // Asegurarse que socket.user existe después del middleware de autenticación
    if (!socket.user) {
        console.error('Conexión Socket.IO establecida pero sin datos de usuario. Desconectando.');
        socket.disconnect(true); // Desconectar forzosamente si no hay usuario
        return;
    }

    const userId = socket.user.userId;
    const companyId = socket.user.companyId;

    console.log(`Usuario conectado vía Socket.IO: ${userId} (Empresa: ${companyId})`);

    // Unir al usuario a una sala específica de su compañía
    // Esto permite enviar mensajes solo a los usuarios de esa compañía
    const companyRoom = `company:${companyId}`;
    socket.join(companyRoom);
    console.log(`Usuario ${userId} unido a la sala ${companyRoom}`);

    // Evento para obtener notificaciones no leídas al conectarse o solicitarlas
    socket.on('getUnreadNotifications', async (callback) => {
        console.log(`Usuario ${userId} solicitando notificaciones no leídas.`);
        try {
            const result = await notificationService.getNotificationsByCompany(
                companyId,
                1, // página 1
                100, // límite alto para obtener todas las no leídas relevantes
                { read: false } // filtro: solo no leídas
            );
            console.log(`Enviando ${result.notifications.length} notificaciones no leídas a ${userId}.`);
            // Enviar notificaciones no leídas de vuelta al cliente que las pidió
            // Usar callback si se proporciona, o emitir evento
            if (typeof callback === 'function') {
                callback({ success: true, notifications: result.notifications });
            } else {
                socket.emit('unreadNotifications', result.notifications);
            }
        } catch (error) {
            console.error(`Error al obtener notificaciones no leídas para ${userId}:`, error);
            if (typeof callback === 'function') {
                callback({ success: false, error: 'Failed to fetch notifications' });
            }
            // Opcional: emitir un evento de error al cliente
            // socket.emit('notificationError', { message: 'Could not load unread notifications.' });
        }
    });

    // Evento para marcar una notificación específica como leída
    socket.on('markAsRead', async (notificationId, callback) => {
        console.log(`Usuario ${userId} marcando notificación ${notificationId} como leída.`);
        if (!notificationId) {
            console.warn(`Intento de marcar como leída sin ID por usuario ${userId}`);
            if (typeof callback === 'function') callback({ success: false, error: 'Notification ID required' });
            return;
        }
        try {
            const updatedNotification = await notificationService.markAsRead(notificationId, userId);
            if (updatedNotification) {
                console.log(`Notificación ${notificationId} marcada como leída por ${userId}.`);
                // Emitir evento de actualización solo al usuario que marcó como leída
                socket.emit('notificationMarkedAsRead', notificationId);
                 if (typeof callback === 'function') callback({ success: true, notificationId });
            } else {
                console.warn(`No se encontró la notificación ${notificationId} para marcar como leída.`);
                 if (typeof callback === 'function') callback({ success: false, error: 'Notification not found' });
            }
        } catch (error) {
            console.error(`Error al marcar notificación ${notificationId} como leída por ${userId}:`, error);
             if (typeof callback === 'function') callback({ success: false, error: 'Failed to mark notification as read' });
        }
    });

    // Evento para marcar todas las notificaciones de la compañía como leídas
    socket.on('markAllAsRead', async (callback) => {
        console.log(`Usuario ${userId} marcando todas las notificaciones como leídas para la compañía ${companyId}.`);
        try {
            const result = await notificationService.markAllAsRead(companyId);
            console.log(`${result.modifiedCount} notificaciones marcadas como leídas para la compañía ${companyId}.`);
            // Emitir evento de actualización a TODOS los usuarios conectados de esa empresa
            io.to(companyRoom).emit('allNotificationsMarkedAsRead');
             if (typeof callback === 'function') callback({ success: true, modifiedCount: result.modifiedCount });
        } catch (error) {
            console.error(`Error al marcar todas las notificaciones como leídas para ${companyId}:`, error);
             if (typeof callback === 'function') callback({ success: false, error: 'Failed to mark all notifications as read' });
        }
    });

    // Manejar desconexión del usuario
    socket.on('disconnect', (reason) => {
        console.log(`Usuario desconectado: ${userId} (Empresa: ${companyId}). Razón: ${reason}`);
        // El socket abandona automáticamente las salas al desconectarse
    });

    // Manejo de errores de socket individuales
    socket.on('error', (error) => {
        console.error(`Error en Socket.IO para usuario ${userId}:`, error);
    });
});

// --- Función para emitir notificaciones (accesible globalmente) ---
// Se usa para que otros servicios (como el check de stock bajo) puedan enviar notificaciones
function emitCompanyNotification(companyId, notification) {
    const companyRoom = `company:${companyId}`;
    console.log(`Emitiendo nueva notificación a la sala ${companyRoom}:`, notification.title);
    io.to(companyRoom).emit('newNotification', notification);
}
// Exponer la función globalmente (considerar alternativas como inyección de dependencias si la app crece)
global.emitCompanyNotification = emitCompanyNotification;


// --- Funciones auxiliares (cleanOrphanFiles, storage, etc.) ---
// Función para limpiar archivos huérfanos en 'uploads'
function cleanOrphanFiles() {
  const baseDir = path.resolve(__dirname, '..');
  const uploadsDir = path.join(baseDir, 'uploads');
  console.log(`[Limpieza] Iniciando limpieza de archivos huérfanos en: ${uploadsDir}`);
  fs.readdir(uploadsDir, async (err, files) => {
    if (err) {
      if (err.code === 'ENOENT') { console.log('[Limpieza] Directorio uploads no encontrado, omitiendo.'); }
      else { console.error('[Limpieza] Error al leer directorio uploads:', err); }
      return;
    }
    try {
      const Company = require('./models/company.model'); // Cargar modelo dentro de la función si es necesario
      const companies = await Company.find({}, 'localFilePath').lean();
      // Crear un Set con nombres de archivo base (sin la ruta)
      const usedFiles = new Set(companies.map(c => c.localFilePath ? path.basename(c.localFilePath) : null).filter(Boolean));
      const MAX_AGE = 3600 * 1000; // 1 hora en milisegundos
      const now = Date.now();
      let deletedCount = 0;
      console.log(`[Limpieza] Archivos encontrados: ${files.length}. Archivos en uso (logos): ${usedFiles.size}`);
      for (const file of files) {
        // Ignorar .gitkeep y archivos que están en uso (logos)
        if (file === '.gitkeep' || usedFiles.has(file)) continue;

        const filePath = path.join(uploadsDir, file);
        try {
          const stats = fs.statSync(filePath);
          // Eliminar si es más viejo que MAX_AGE
          if (now - stats.mtime.getTime() > MAX_AGE) {
            fs.unlinkSync(filePath);
            console.log(`[Limpieza] Archivo huérfano eliminado (antiguo): ${file}`);
            deletedCount++;
          }
        } catch (statErr) {
          // Ignorar si el archivo ya no existe, loguear otros errores
          if (statErr.code !== 'ENOENT') {
            console.error(`[Limpieza] Error al verificar archivo ${file}:`, statErr);
          }
        }
      }
      if (deletedCount > 0) { console.log(`[Limpieza] Finalizada: ${deletedCount} archivos huérfanos eliminados.`); }
      else { console.log('[Limpieza] Finalizada: No se eliminaron archivos huérfanos.'); }
    } catch (error) { console.error('[Limpieza] Error durante la limpieza automática:', error); }
  });
}

// Configuración de Multer para subida de archivos (logo de compañía)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const baseDir = path.resolve(__dirname, '..'); // Directorio base del proyecto
    const dest = path.join(baseDir, 'uploads'); // Carpeta de subidas
    // Crear directorio si no existe
    if (!fs.existsSync(dest)) {
      try {
        fs.mkdirSync(dest, { recursive: true });
        console.log(`Directorio de subidas creado en: ${dest}`);
        // Crear .gitkeep para asegurar que la carpeta (vacía) se incluya en git
        fs.writeFileSync(path.join(dest, '.gitkeep'), '');
      } catch (mkdirErr) {
        console.error(`Error al crear directorio de subidas ${dest}:`, mkdirErr);
        return cb(mkdirErr); // Pasar error a Multer
      }
    }
    cb(null, dest); // Indicar a Multer dónde guardar
  },
  filename: function (req, file, cb) {
    // Generar un nombre de archivo único para evitar colisiones
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname); // Obtener extensión original
    cb(null, uniqueSuffix + extension); // Nombre final: sufijo-unico.extension
  }
});

// Middleware de Multer configurado
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB por archivo
    fileFilter: (req, file, cb) => {
        // Aceptar solo imágenes
        if (file.mimetype.startsWith('image/')) {
            cb(null, true); // Aceptar archivo
        } else {
            // Rechazar archivo con un error específico
            cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes (JPEG, PNG, GIF, etc.).'), false);
        }
    }
}).single('logo'); // Espera un archivo en el campo 'logo' del formulario multipart

// Middleware para manejar errores específicos de Multer y del fileFilter
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Errores conocidos de Multer (límite de tamaño, etc.)
        console.error("Error de Multer:", err.code, "-", err.message);
        let friendlyMessage = 'Error al subir archivo.';
        if (err.code === 'LIMIT_FILE_SIZE') {
            friendlyMessage = 'El archivo es demasiado grande. El límite es 5MB.';
        }
        // Añadir más códigos si es necesario (LIMIT_FIELD_KEY, LIMIT_FIELD_VALUE, etc.)
        return res.status(400).json({ error: friendlyMessage });
    } else if (err) {
        // Otros errores (como el del fileFilter)
        console.error("Error en subida (posiblemente filtro):", err.message);
        // Usar el mensaje del error si es descriptivo, o uno genérico
        return res.status(400).json({ error: err.message || 'Error al procesar el archivo.' });
    }
    // Si no hubo errores de Multer, pasar al siguiente middleware
    next();
};
// --- Fin Funciones auxiliares ---


// --- Middlewares Generales de Express ---
// Habilitar CORS para todas las rutas HTTP API (diferente de Socket.IO)
// Configuración más específica si es necesario
app.use(cors({
    origin: allowedOrigins, // Reutilizar la lista de orígenes permitidos
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // Métodos comunes
    allowedHeaders: ['Content-Type', 'Authorization'], // Cabeceras permitidas
    credentials: true
}));
app.options('*', cors()); // Habilitar pre-flight requests para todas las rutas

app.use(express.json()); // Para parsear JSON bodies (application/json)
app.use(express.urlencoded({ extended: true })); // Para parsear URL-encoded bodies (application/x-www-form-urlencoded)

// Servir archivos estáticos desde la carpeta 'uploads'
const uploadsStaticPath = path.resolve(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsStaticPath)); // Acceso público a /uploads/nombrearchivo.jpg
console.log(`Sirviendo archivos estáticos desde la ruta /uploads apuntando a: ${uploadsStaticPath}`);


// --- API Routes ---
// Rutas de ejemplo (mantener la estructura)

// Rutas para notificaciones (protegidas)
app.get('/api/notifications',
    authMiddleware.authenticateToken,
    notificationController.getNotifications
);
app.patch('/api/notifications/:id/read',
    authMiddleware.authenticateToken,
    notificationController.markAsRead
);
app.patch('/api/notifications/read-all',
    authMiddleware.authenticateToken,
    notificationController.markAllAsRead
);
app.delete('/api/notifications/:id',
    authMiddleware.authenticateToken,
    notificationController.deleteNotification
);
// Ruta para disparar manualmente la verificación (solo admin)
app.post('/api/notifications/check-low-stock',
    authMiddleware.authenticateToken,
    authMiddleware.checkRole(['admin']), // Solo admins pueden disparar esto manualmente
    notificationController.checkLowStockProducts
);

// Rutas para autenticación (públicas y protegidas)
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.post('/api/auth/forgot-password', authController.forgotPassword);
app.post('/api/auth/reset-password', authController.resetPassword);
app.get('/api/auth/me', authMiddleware.authenticateToken, authController.getMe); // Obtener datos del usuario logueado
app.post('/api/auth/change-password', authMiddleware.authenticateToken, authController.changePassword); // Cambiar contraseña (logueado)

// Rutas para gestión de usuarios (protegidas, mayormente admin)
app.get('/api/users', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), userController.getUsers);
app.get('/api/users/:id', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), userController.getUserById);
app.post('/api/users', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionMiddleware.checkPlanLimits('users'), userController.createUser);
app.put('/api/users/:id', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), userController.updateUser);
app.delete('/api/users/:id', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), userController.deleteUser);
app.post('/api/users/:id/reset-password', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), userController.resetUserPassword); // Admin resetea contraseña de otro usuario
app.put('/api/users/profile', authMiddleware.authenticateToken, userController.updateProfile); // Usuario actualiza su propio perfil

// Rutas para suscripciones (protegidas, mayormente admin)
app.get('/api/subscription', authMiddleware.authenticateToken, subscriptionController.getSubscriptionInfo);
app.put('/api/subscription/plan', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionController.updateSubscriptionPlan);
app.post('/api/subscription/payment', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionController.registerPayment);
app.post('/api/subscription/cancel', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionController.cancelSubscription);
app.get('/api/subscription/plans', subscriptionController.getAvailablePlans); // Puede ser pública o protegida según necesidad
app.get('/api/subscription/trial-status', authMiddleware.authenticateToken, subscriptionController.checkTrialStatus);
app.get('/api/subscription/payment-history', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionController.getPaymentHistory);
app.put('/api/subscription/billing-info', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionController.updateBillingInfo);
app.get('/api/subscription/usage-stats', authMiddleware.authenticateToken, subscriptionController.getUsageStats);
app.post('/api/subscription/extend-trial', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionController.extendTrial);

// --- Inicio Modificación: CORREGIR rutas de platform admin ---
// Rutas para administración de plataforma (solo para platform_admin)
// CORREGIDO: Ruta para obtener estadísticas del dashboard
app.get('/api/platform-admin/stats', // <- Cambiado de 'dashboard' a 'stats'
    authMiddleware.authenticateToken,
    platformAdminMiddleware.isPlatformAdmin,
    platformAdminController.getDashboardStats
);
// Ruta para listar compañías (ya estaba bien)
app.get('/api/platform-admin/companies',
    authMiddleware.authenticateToken,
    platformAdminMiddleware.isPlatformAdmin,
    platformAdminController.listCompanies
);
// CORREGIDO: Ruta para extender/reducir trial
app.post('/api/platform-admin/companies/extend-trial', // <- Añadido '/companies/'
    authMiddleware.authenticateToken,
    platformAdminMiddleware.isPlatformAdmin,
    platformAdminController.extendTrial
);
// CORREGIDO: Ruta para cambiar estado de suscripción
app.put('/api/platform-admin/companies/subscription-status', // <- Cambiado método a PUT y ruta completa
    authMiddleware.authenticateToken,
    platformAdminMiddleware.isPlatformAdmin,
    platformAdminController.changeSubscriptionStatus
);
// CORREGIDO: Ruta para activar/desactivar compañía
app.put('/api/platform-admin/companies/toggle-active', // <- Cambiado método a PUT y ruta completa
    authMiddleware.authenticateToken,
    platformAdminMiddleware.isPlatformAdmin,
    platformAdminController.toggleCompanyActive
);
// --- Fin Modificación: CORREGIR rutas de platform admin ---


// Rutas para invoices (protegidas, con chequeo de suscripción)
app.get('/api/invoices', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, invoiceController.getInvoices);
app.get('/api/invoices/dashboard-data', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, invoiceController.getDashboardData); // Ruta específica primero
app.post('/api/invoices',
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    subscriptionMiddleware.checkPlanLimits('invoices'),
    invoiceController.createOrUpdateInvoice // Asumiendo que este controlador maneja creación y actualización
);
app.get('/api/invoices/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, invoiceController.getInvoiceById); // Ruta con parámetro después
app.delete('/api/invoices/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, authMiddleware.checkRole(['admin', 'facturador']), invoiceController.deleteInvoice);
app.patch('/api/invoices/:id/status', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, invoiceController.updateInvoiceStatus);

// Rutas para clients (protegidas, con chequeo de suscripción)
app.get('/api/clients', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, clientController.getClients);
app.post('/api/clients',
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    subscriptionMiddleware.checkPlanLimits('clients'),
    clientController.createClientController
);
app.get('/api/clients/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, clientController.getClientByIdController);
app.put('/api/clients/:id',
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    clientController.updateClientController
);
app.delete('/api/clients/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, authMiddleware.checkRole(['admin', 'facturador']), clientController.deleteClientController);

// Rutas para products (protegidas, con chequeo de suscripción)
app.get('/api/products', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, productController.getProducts);
app.post('/api/products',
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    subscriptionMiddleware.checkPlanLimits('products'),
    productController.createProductController
);
app.get('/api/products/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, productController.getProductByIdController);
app.put('/api/products/:id',
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    productController.updateProductController
);
app.delete('/api/products/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, authMiddleware.checkRole(['admin', 'facturador']), productController.deleteProductController);

// Rutas para company (protegidas, mayormente admin)
app.get('/api/company', authMiddleware.authenticateToken, companyController.getCompanyController); // Obtener datos de la compañía del usuario logueado
app.put('/api/company',
    authMiddleware.authenticateToken,
    authMiddleware.checkRole(['admin']), // Solo admin puede actualizar datos generales
    companyController.updateCompanyController
);
app.put('/api/company/theme',
    authMiddleware.authenticateToken,
    authMiddleware.checkRole(['admin']), // Solo admin puede cambiar el tema
    companyController.updateThemeController
);
// Ruta para subir logo (usa Multer y el manejador de errores)
app.post('/api/company/logo',
    authMiddleware.authenticateToken,
    authMiddleware.checkRole(['admin']), // Solo admin
    upload, // Middleware de Multer para procesar el archivo 'logo'
    handleMulterError, // Middleware para manejar errores de Multer
    companyController.uploadLogoController // Controlador final si todo va bien
);
app.delete('/api/company/logo',
    authMiddleware.authenticateToken,
    authMiddleware.checkRole(['admin']), // Solo admin
    companyController.deleteLogoController
);
// Ruta peligrosa: eliminar compañía (solo admin)
app.delete('/api/company',
    authMiddleware.authenticateToken,
    authMiddleware.checkRole(['admin']),
    companyController.deleteCompanyController
);

// Rutas para documentos (cotizaciones, etc.) (protegidas, con chequeo de suscripción)
app.get('/api/documents',
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    documentController.getDocuments
);
app.get('/api/documents/pending', // Ruta específica primero
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    documentController.getPendingDocuments
);
app.get('/api/documents/:id', // Ruta con parámetro después
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    documentController.getDocument
);
app.post('/api/documents',
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    // Podría tener su propio límite de plan: subscriptionMiddleware.checkPlanLimits('documents'),
    documentController.createDocument
);
app.put('/api/documents/:id',
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    documentController.updateDocument
);
app.delete('/api/documents/:id',
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    authMiddleware.checkRole(['admin', 'facturador']), // O roles relevantes
    documentController.deleteDocument
);
app.patch('/api/documents/:id/status',
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    documentController.updateDocumentStatus
);
app.post('/api/documents/:id/convert-to-invoice', // Convertir cotización a factura
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    subscriptionMiddleware.checkPlanLimits('invoices'), // Asegurarse que hay cupo para una nueva factura
    documentController.convertToInvoice
);


// --- Conexión a Base de Datos e Inicio del Servidor ---
async function conectarBD() {
  try {
    // Opciones recomendadas para Mongoose 6+
    const options = {
        // useNewUrlParser: true, // Ya no son necesarias
        // useUnifiedTopology: true, // Ya no son necesarias
        // useCreateIndex: true, // Ya no es soportada
        // useFindAndModify: false // Ya no es soportada
    };
    await mongoose.connect(mongoDb, options);
    console.log('MongoDB Conectada exitosamente a:', mongoDb);
  } catch (error) {
    console.error('Error crítico al conectar a MongoDB:', error);
    process.exit(1); // Salir si no se puede conectar a la BD
  }
}

async function startServer() {
    await conectarBD(); // Esperar a que la BD esté conectada

    // --- Tareas Programadas ---
    // Programar verificación periódica de productos con stock bajo
    const checkLowStockInterval = process.env.LOW_STOCK_CHECK_INTERVAL || 3600000; // 1 hora por defecto
    const runLowStockCheck = async () => {
        console.log('[Tarea Programada] Ejecutando verificación de stock bajo...');
        try {
            const notifications = await notificationService.checkLowStockProducts();
            // Emitir notificaciones a las empresas correspondientes vía Socket.IO
            notifications.forEach(notification => {
                // Asegurarse que la notificación tiene companyId antes de emitir
                if (notification.companyId) {
                    emitCompanyNotification(notification.companyId.toString(), notification);
                } else {
                    console.warn('[Tarea Programada] Notificación de stock bajo sin companyId:', notification);
                }
            });
            console.log(`[Tarea Programada] Verificación de stock bajo completada: ${notifications.length} nuevas notificaciones creadas y emitidas.`);
        } catch (error) {
            console.error('[Tarea Programada] Error en verificación automática de stock bajo:', error);
        }
    };

    // Primera ejecución después de un breve retraso (ej: 2 minutos) para permitir que todo inicie
    const initialDelay = 120000; // 2 minutos
    console.log(`[Tarea Programada] Primera verificación de stock bajo programada en ${initialDelay / 60000} minutos.`);
    setTimeout(runLowStockCheck, initialDelay);

    // Ejecuciones periódicas posteriores
    console.log(`[Tarea Programada] Verificación de stock bajo recurrente programada cada ${checkLowStockInterval / 60000} minutos.`);
    setInterval(runLowStockCheck, checkLowStockInterval);

    // Programar limpieza de archivos huérfanos
    const cleanIntervalMinutes = process.env.CLEAN_FILES_INTERVAL_MINUTES || 60; // Cada hora por defecto
    const cleanFilesInterval = cleanIntervalMinutes * 60 * 1000;
    // Ejecución inicial después de un corto tiempo
    const initialCleanDelay = 15000; // 15 segundos
    console.log(`[Limpieza] Programando limpieza inicial de archivos huérfanos en ${initialCleanDelay / 1000} segundos...`);
    setTimeout(() => {
        console.log('[Limpieza] Ejecutando limpieza inicial de archivos huérfanos...');
        cleanOrphanFiles();
      }, initialCleanDelay);
    // Ejecuciones recurrentes
    console.log(`[Limpieza] Programando limpieza recurrente de archivos huérfanos cada ${cleanIntervalMinutes} minutos...`);
    setInterval(cleanOrphanFiles, cleanFilesInterval);
    // --- Fin Tareas Programadas ---


    // Iniciar el servidor HTTP (que incluye Express y Socket.IO)
    // Escuchar en todas las interfaces (0.0.0.0) para permitir acceso desde IP local
    server.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Servidor Express corriendo en http://localhost:${port}`);
      console.log(`🔌 Socket.io escuchando conexiones.`);
      console.log(`🌐 Accesible en la red local (si la configuración de red lo permite) en puerto ${port}`);
    });
}

// Iniciar todo el proceso
startServer();

// Manejo de cierre elegante (Ctrl+C)
process.on('SIGINT', async () => {
    console.log('\n🔌 Cerrando servidor Socket.IO...');
    io.close(() => { // Cierra todas las conexiones de Socket.IO
        console.log('✅ Conexiones Socket.IO cerradas.');
        console.log('🗄️ Cerrando conexión a MongoDB...');
        mongoose.connection.close(false).then(() => { // Cierra conexión a Mongoose
            console.log('✅ Conexión a MongoDB cerrada.');
            console.log('👋 Saliendo...');
            process.exit(0); // Salir del proceso limpiamente
        }).catch(err => {
            console.error('❌ Error al cerrar conexión MongoDB:', err);
            process.exit(1); // Salir con error si falla el cierre de BD
        });
    });
});