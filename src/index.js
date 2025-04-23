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
const documentController = require('./controllers/document.controller');
const authController = require('./controllers/auth.controller');
const userController = require('./controllers/user.controller');
const subscriptionController = require('./controllers/subscription.controller');
const authMiddleware = require('./middleware/auth.middleware');
const subscriptionMiddleware = require('./middleware/subscription.middleware'); // Asegúrate que la ruta sea correcta

const app = express();
const port = 5002;
const urlMongo = "mongodb://localhost:27017/testing";
const mongoDb = process.env.MONGODB_URI || urlMongo;

// --- Funciones auxiliares (cleanOrphanFiles, storage, etc. - sin cambios) ---
function cleanOrphanFiles() {
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  fs.readdir(uploadsDir, async (err, files) => {
    if (err) {
      if (err.code === 'ENOENT') { console.log('Directorio uploads no encontrado, omitiendo limpieza.'); }
      else { console.error('Error al leer directorio uploads:', err); }
      return;
    }
    try {
      const Company = require('./models/company.model');
      const companies = await Company.find({}, 'localFilePath');
      const usedFiles = companies.map(c => c.localFilePath).filter(Boolean);
      const MAX_AGE = 3600000; const now = Date.now(); let deletedCount = 0;
      for (const file of files) {
        if (file === '.gitkeep' || usedFiles.includes(file)) continue;
        const filePath = path.join(uploadsDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtime.getTime() > MAX_AGE) {
            fs.unlinkSync(filePath); console.log(`Archivo huérfano eliminado: ${file}`); deletedCount++;
          }
        } catch (statErr) {
          if (statErr.code !== 'ENOENT') { console.error(`Error al verificar archivo ${file}:`, statErr); }
        }
      }
      if (deletedCount > 0) { console.log(`Limpieza automática: ${deletedCount} archivos huérfanos eliminados`); }
      else { console.log('No se encontraron archivos huérfanos para eliminar'); }
    } catch (error) { console.error('Error en limpieza automática:', error); }
  });
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dest = 'uploads/'; if (!fs.existsSync(dest)) { fs.mkdirSync(dest, { recursive: true }); } cb(null, dest);
  }, filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage: storage });
const uploadsPathRelative = 'uploads';
if (!fs.existsSync(uploadsPathRelative)) {
  fs.mkdirSync(uploadsPathRelative); fs.writeFileSync(path.join(uploadsPathRelative, '.gitkeep'), ''); console.log(`Directorio ${uploadsPathRelative} creado.`);
}
// --- Fin Funciones auxiliares ---


// Middleware generales
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsPathRelative));

// --- API Routes ---

// Rutas para autenticación (sin cambios)
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.post('/api/auth/forgot-password', authController.forgotPassword);
app.post('/api/auth/reset-password', authController.resetPassword);
app.get('/api/auth/me', authMiddleware.authenticateToken, authController.getMe);
app.post('/api/auth/change-password', authMiddleware.authenticateToken, authController.changePassword);

// Rutas para usuarios (sin cambios en POST/PUT respecto a suscripción)
app.get('/api/users', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), userController.getUsers);
app.get('/api/users/:id', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), userController.getUserById);
// POST y PUT de usuarios mantienen la verificación de límites, ya que es una acción de admin
app.post('/api/users', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionMiddleware.checkPlanLimits('users'), userController.createUser);
app.put('/api/users/:id', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), userController.updateUser);
app.delete('/api/users/:id', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), userController.deleteUser);
app.post('/api/users/:id/reset-password', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), userController.resetUserPassword);
app.put('/api/users/profile', authMiddleware.authenticateToken, userController.updateProfile);

// Rutas para suscripciones (sin cambios)
app.get('/api/subscription', authMiddleware.authenticateToken, subscriptionController.getSubscriptionInfo);
app.put('/api/subscription/plan', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionController.updateSubscriptionPlan);
app.post('/api/subscription/payment', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionController.registerPayment);
app.post('/api/subscription/cancel', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionController.cancelSubscription);
app.get('/api/subscription/plans', subscriptionController.getAvailablePlans);
app.get('/api/subscription/trial-status', authMiddleware.authenticateToken, subscriptionController.checkTrialStatus);
app.get('/api/subscription/payment-history', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionController.getPaymentHistory);
app.put('/api/subscription/billing-info', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), subscriptionController.updateBillingInfo);
app.get('/api/subscription/usage-stats', authMiddleware.authenticateToken, subscriptionController.getUsageStats);
app.post('/api/subscription/extend-trial', subscriptionController.extendTrial);

// --- Rutas para invoices (MODIFICADAS) ---
app.get('/api/invoices', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, invoiceController.getInvoices);
app.post('/api/invoices',
    authMiddleware.authenticateToken,
    // subscriptionMiddleware.checkSubscriptionStatus, // <-- Comentado temporalmente
    // subscriptionMiddleware.checkPlanLimits('invoices'), // <-- Comentado temporalmente
    invoiceController.createOrUpdateInvoice // Usar el controlador que maneja creación/actualización
);
app.put('/api/invoices/:id',
    authMiddleware.authenticateToken,
    // subscriptionMiddleware.checkSubscriptionStatus, // <-- Comentado temporalmente
    invoiceController.updateInvoice // Asumiendo que este es el controlador correcto para PUT
);
// DELETE y otras rutas de invoices mantienen las verificaciones
app.delete('/api/invoices/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, authMiddleware.checkRole(['admin', 'facturador']), invoiceController.deleteInvoice);
app.get('/api/invoices/dashboard-data', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, invoiceController.getDashboardData);
app.patch('/api/invoices/:id/status', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, invoiceController.updateInvoiceStatus);

// --- Rutas para clients (MODIFICADAS) ---
app.get('/api/clients', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, clientController.getClients);
app.post('/api/clients',
    authMiddleware.authenticateToken,
    // subscriptionMiddleware.checkSubscriptionStatus, // <-- Comentado temporalmente
    // subscriptionMiddleware.checkPlanLimits('clients'), // <-- Comentado temporalmente
    clientController.createClientController
);
app.get('/api/clients/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, clientController.getClientByIdController);
app.put('/api/clients/:id',
    authMiddleware.authenticateToken,
    // subscriptionMiddleware.checkSubscriptionStatus, // <-- Comentado temporalmente
    clientController.updateClientController
);
// DELETE mantiene las verificaciones
app.delete('/api/clients/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, authMiddleware.checkRole(['admin', 'facturador']), clientController.deleteClientController);

// --- Rutas para products (MODIFICADAS) ---
app.get('/api/products', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, productController.getProducts);
app.post('/api/products',
    authMiddleware.authenticateToken,
    // subscriptionMiddleware.checkSubscriptionStatus, // <-- Comentado temporalmente
    // subscriptionMiddleware.checkPlanLimits('products'), // <-- Comentado temporalmente
    productController.createProductController
);
app.get('/api/products/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, productController.getProductByIdController);
app.put('/api/products/:id',
    authMiddleware.authenticateToken,
    // subscriptionMiddleware.checkSubscriptionStatus, // <-- Comentado temporalmente
    productController.updateProductController
);
// DELETE mantiene las verificaciones
app.delete('/api/products/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, authMiddleware.checkRole(['admin', 'facturador']), productController.deleteProductController);

// Rutas para company (sin cambios en POST/PUT respecto a suscripción)
app.get('/api/company', authMiddleware.authenticateToken, companyController.getCompanyController);
app.put('/api/company', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), companyController.updateCompanyController);
app.put('/api/company/theme', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), companyController.updateThemeController);
app.delete('/api/company', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), companyController.deleteCompanyController);
app.post('/api/company/logo', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), upload.single('logo'), async (req, res) => { /* ... (lógica de subida sin cambios) ... */ });
app.delete('/api/company/logo/:id', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), async (req, res) => { /* ... (lógica de borrado sin cambios) ... */ });

// Rutas para documentos (sin cambios en POST/PUT respecto a suscripción, ya que no tenían checkPlanLimits)
app.get('/api/documents', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, documentController.getDocuments);
app.get('/api/documents/pending', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, documentController.getPendingDocuments);
app.get('/api/documents/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, documentController.getDocument);
// POST y PUT de documentos no tenían checkPlanLimits, así que solo necesitan checkSubscriptionStatus
app.post('/api/documents', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, documentController.createDocument);
app.put('/api/documents/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, documentController.updateDocument);
// DELETE mantiene las verificaciones
app.delete('/api/documents/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, authMiddleware.checkRole(['admin', 'facturador']), documentController.deleteDocument);
app.patch('/api/documents/:id/status', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, documentController.updateDocumentStatus);

// MODIFICADO: Comentar middlewares de verificación de suscripción para convertir a factura
app.post('/api/documents/:id/convert-to-invoice', 
    authMiddleware.authenticateToken, 
    // subscriptionMiddleware.checkSubscriptionStatus, // <-- Comentado temporalmente
    // subscriptionMiddleware.checkPlanLimits('invoices'), // <-- Comentado temporalmente
    documentController.convertToInvoice);


// --- Database Connection and Server Start ---
async function conectarBD() {
  try {
    await mongoose.connect(mongoDb);
    console.log('MongoDB Conectada');
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error);
    process.exit(1);
  }
}

async function startServer() {
    await conectarBD();
    app.listen(port, '0.0.0.0', () => {
      console.log(`Servidor corriendo en http://0.0.0.0:${port}`);
      console.log('Programando limpieza inicial de archivos huérfanos en 10 segundos...');
      setTimeout(() => { console.log('Ejecutando limpieza inicial...'); cleanOrphanFiles(); }, 10000);
      const cleanIntervalMinutes = 30;
      console.log(`Programando limpieza recurrente cada ${cleanIntervalMinutes} minutos...`);
      setInterval(cleanOrphanFiles, cleanIntervalMinutes * 60 * 1000);
    });
}

startServer();