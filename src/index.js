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
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Importar controladores y middlewares
const invoiceController = require('./controllers/invoice.controller');
const clientController = require('./controllers/client.controller');
const productController = require('./controllers/product.controller');
const companyController = require('./controllers/company.controller');
const documentController = require('./controllers/document.controller'); // Asegúrate que es la versión completa
const authController = require('./controllers/auth.controller');
const userController = require('./controllers/user.controller');
const subscriptionController = require('./controllers/subscription.controller');
const authMiddleware = require('./middleware/auth.middleware');
// Importar middleware de suscripción (desactivado internamente)
const subscriptionMiddleware = require('./middleware/subscription.middleware');

const app = express();
const port = process.env.PORT || 5002; // Usar variable de entorno para el puerto si está definida
const urlMongo = "mongodb://localhost:27017/testing";
const mongoDb = process.env.MONGODB_URI || urlMongo;

// --- Funciones auxiliares (cleanOrphanFiles, storage, etc.) ---
// Función para limpiar archivos huérfanos en 'uploads'
function cleanOrphanFiles() {
  const baseDir = path.resolve(__dirname, '..');
  const uploadsDir = path.join(baseDir, 'uploads');
  console.log(`Iniciando limpieza de archivos huérfanos en: ${uploadsDir}`);
  fs.readdir(uploadsDir, async (err, files) => {
    if (err) {
      if (err.code === 'ENOENT') { console.log('Directorio uploads no encontrado, omitiendo limpieza.'); }
      else { console.error('Error al leer directorio uploads:', err); }
      return;
    }
    try {
      const Company = require('./models/company.model');
      const companies = await Company.find({}, 'localFilePath').lean();
      const usedFiles = new Set(companies.map(c => c.localFilePath).filter(Boolean));
      const MAX_AGE = 3600 * 1000; // 1 hora en milisegundos
      const now = Date.now();
      let deletedCount = 0;
      console.log(`Archivos encontrados en uploads: ${files.length}. Archivos en uso: ${usedFiles.size}`);
      for (const file of files) {
        if (file === '.gitkeep' || usedFiles.has(file)) continue;
        const filePath = path.join(uploadsDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtime.getTime() > MAX_AGE) {
            fs.unlinkSync(filePath); console.log(`Archivo huérfano eliminado: ${file}`); deletedCount++;
          }
        } catch (statErr) { if (statErr.code !== 'ENOENT') { console.error(`Error al verificar archivo ${file}:`, statErr); } }
      }
      if (deletedCount > 0) { console.log(`Limpieza automática: ${deletedCount} archivos huérfanos eliminados.`); }
      else { console.log('No se encontraron archivos huérfanos para eliminar en esta ejecución.'); }
    } catch (error) { console.error('Error durante la limpieza automática de archivos:', error); }
  });
}

// Configuración de Multer para subida de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const baseDir = path.resolve(__dirname, '..');
    const dest = path.join(baseDir, 'uploads');
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
      console.log(`Directorio de subidas creado en: ${dest}`);
      fs.writeFileSync(path.join(dest, '.gitkeep'), '');
    }
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) { cb(null, true); }
        else { cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes.'), false); }
    }
}).single('logo'); // Middleware específico para el campo 'logo'

// Middleware para manejar errores de Multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.error("Error de Multer:", err.message);
        return res.status(400).json({ error: `Error al subir archivo: ${err.message}` });
    } else if (err) {
        console.error("Error en filtro de archivo:", err.message);
        return res.status(400).json({ error: err.message });
    }
    next();
};
// --- Fin Funciones auxiliares ---


// Middleware generales
app.use(cors()); // Habilitar CORS
app.use(express.json()); // Para parsear application/json
app.use(express.urlencoded({ extended: true })); // Para parsear application/x-www-form-urlencoded

// Servir archivos estáticos desde 'uploads'
const uploadsStaticPath = path.resolve(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsStaticPath));
console.log(`Sirviendo archivos estáticos desde: ${uploadsStaticPath}`);


// --- API Routes ---

// Rutas para autenticación
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.post('/api/auth/forgot-password', authController.forgotPassword);
app.post('/api/auth/reset-password', authController.resetPassword);
app.get('/api/auth/me', authMiddleware.authenticateToken, authController.getMe);
app.post('/api/auth/change-password', authMiddleware.authenticateToken, authController.changePassword);

// Rutas para usuarios
app.get('/api/users', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), userController.getUsers);
app.get('/api/users/:id', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), userController.getUserById);
app.post('/api/users', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionMiddleware.checkPlanLimits('users'), userController.createUser);
app.put('/api/users/:id', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), userController.updateUser);
app.delete('/api/users/:id', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), userController.deleteUser);
app.post('/api/users/:id/reset-password', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), userController.resetUserPassword);
app.put('/api/users/profile', authMiddleware.authenticateToken, userController.updateProfile);

// Rutas para suscripciones
app.get('/api/subscription', authMiddleware.authenticateToken, subscriptionController.getSubscriptionInfo);
app.put('/api/subscription/plan', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionController.updateSubscriptionPlan);
app.post('/api/subscription/payment', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionController.registerPayment);
app.post('/api/subscription/cancel', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionController.cancelSubscription);
app.get('/api/subscription/plans', subscriptionController.getAvailablePlans);
app.get('/api/subscription/trial-status', authMiddleware.authenticateToken, subscriptionController.checkTrialStatus);
app.get('/api/subscription/payment-history', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionController.getPaymentHistory);
app.put('/api/subscription/billing-info', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionController.updateBillingInfo);
app.get('/api/subscription/usage-stats', authMiddleware.authenticateToken, subscriptionController.getUsageStats);
app.post('/api/subscription/extend-trial', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionController.extendTrial);

// --- Rutas para invoices (ORDEN CORREGIDO) ---
app.get('/api/invoices', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, invoiceController.getInvoices);
// Ruta específica ANTES de la ruta con parámetro :id
app.get('/api/invoices/dashboard-data', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, invoiceController.getDashboardData);
app.post('/api/invoices',
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    subscriptionMiddleware.checkPlanLimits('invoices'),
    invoiceController.createOrUpdateInvoice
);
// Ruta con parámetro :id DESPUÉS de las rutas específicas
app.get('/api/invoices/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, invoiceController.getInvoiceById);
app.delete('/api/invoices/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, authMiddleware.checkRole(['admin', 'facturador']), invoiceController.deleteInvoice);
app.patch('/api/invoices/:id/status', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, invoiceController.updateInvoiceStatus);

// --- Rutas para clients ---
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

// --- Rutas para products ---
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

// --- Rutas para company ---
app.get('/api/company', authMiddleware.authenticateToken, companyController.getCompanyController);
app.put('/api/company',
    authMiddleware.authenticateToken,
    authMiddleware.checkRole(['admin']),
    companyController.updateCompanyController
);
app.put('/api/company/theme',
    authMiddleware.authenticateToken,
    authMiddleware.checkRole(['admin']),
    companyController.updateThemeController
);
app.post('/api/company/logo',
    authMiddleware.authenticateToken,
    authMiddleware.checkRole(['admin']),
    upload,
    handleMulterError,
    companyController.uploadLogoController
);
app.delete('/api/company/logo',
    authMiddleware.authenticateToken,
    authMiddleware.checkRole(['admin']),
    companyController.deleteLogoController
);
app.delete('/api/company',
    authMiddleware.authenticateToken,
    authMiddleware.checkRole(['admin']),
    companyController.deleteCompanyController
);


// --- Rutas para documentos (ORDEN CORREGIDO y DESCOMENTADAS) ---
app.get('/api/documents',
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    documentController.getDocuments
);
// Ruta específica ANTES de la ruta con parámetro :id
app.get('/api/documents/pending',
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    documentController.getPendingDocuments
);
// Ruta con parámetro :id DESPUÉS de las rutas específicas
app.get('/api/documents/:id',
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    documentController.getDocument
);
app.post('/api/documents',
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
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
    authMiddleware.checkRole(['admin', 'facturador']),
    documentController.deleteDocument
);
app.patch('/api/documents/:id/status',
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    documentController.updateDocumentStatus
);
app.post('/api/documents/:id/convert-to-invoice',
    authMiddleware.authenticateToken,
    subscriptionMiddleware.checkSubscriptionStatus,
    subscriptionMiddleware.checkPlanLimits('invoices'),
    documentController.convertToInvoice
);


// --- Database Connection and Server Start ---
async function conectarBD() {
  try {
    await mongoose.connect(mongoDb);
    console.log('MongoDB Conectada a:', mongoDb);
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error);
    process.exit(1);
  }
}

async function startServer() {
    await conectarBD();
    app.listen(port, '0.0.0.0', () => {
      console.log(`Servidor corriendo en http://localhost:${port} (accesible en la red local)`);
      console.log('Programando limpieza inicial de archivos huérfanos en 15 segundos...');
      setTimeout(() => {
          console.log('Ejecutando limpieza inicial de archivos huérfanos...');
          cleanOrphanFiles();
        }, 15000);
      const cleanIntervalMinutes = 60;
      console.log(`Programando limpieza recurrente de archivos huérfanos cada ${cleanIntervalMinutes} minutos...`);
      setInterval(cleanOrphanFiles, cleanIntervalMinutes * 60 * 1000);
    });
}

startServer();

process.on('SIGINT', async () => {
    console.log('Cerrando conexión a MongoDB...');
    await mongoose.connection.close();
    console.log('MongoDB desconectada. Saliendo...');
    process.exit(0);
});
