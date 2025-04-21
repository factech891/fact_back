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

const invoiceController = require('./controllers/invoice.controller');
const clientController = require('./controllers/client.controller');
const productController = require('./controllers/product.controller');
const companyController = require('./controllers/company.controller');
const documentController = require('./controllers/document.controller');
const authController = require('./controllers/auth.controller');
const userController = require('./controllers/user.controller');
const subscriptionController = require('./controllers/subscription.controller');
const authMiddleware = require('./middleware/auth.middleware');
const subscriptionMiddleware = require('./middleware/subscription.middleware');

const app = express();
const port = 5002;
const urlMongo = "mongodb://localhost:27017/testing";
const mongoDb = process.env.MONGODB_URI || urlMongo;

// Función para limpiar archivos huérfanos
function cleanOrphanFiles() {
  const uploadsDir = path.join(__dirname, '..', 'uploads');

  fs.readdir(uploadsDir, async (err, files) => {
    if (err) {
      // Handle potential error reading uploads directory (e.g., if it doesn't exist initially)
      if (err.code === 'ENOENT') {
          console.log('Directorio uploads no encontrado, omitiendo limpieza.');
      } else {
          console.error('Error al leer directorio uploads:', err);
      }
      return;
    }

    try {
      const Company = require('./models/company.model');
      const companies = await Company.find({}, 'localFilePath');
      const usedFiles = companies
        .map(c => c.localFilePath)
        .filter(Boolean);

      console.log('Archivos en uso:', usedFiles);
      console.log('Total archivos en carpeta:', files.length);

      const MAX_AGE = 3600000; // 1 hora
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        if (file === '.gitkeep') continue;
        if (usedFiles.includes(file)) {
          continue;
        }

        const filePath = path.join(uploadsDir, file);

        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtime.getTime() > MAX_AGE) {
            fs.unlinkSync(filePath);
            console.log(`Archivo huérfano eliminado: ${file}`);
            deletedCount++;
          }
        } catch (statErr) {
          if (statErr.code === 'ENOENT') {
             console.log(`Archivo ${file} no encontrado durante la verificación, posiblemente ya eliminado.`);
          } else {
             console.error(`Error al verificar archivo ${file}:`, statErr);
          }
        }
      }

      if (deletedCount > 0) {
        console.log(`Limpieza automática: ${deletedCount} archivos huérfanos eliminados`);
      } else {
        console.log('No se encontraron archivos huérfanos para eliminar');
      }
    } catch (error) {
      console.error('Error en limpieza automática:', error);
    }
  });
}


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dest = 'uploads/'; // Relative to CWD
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });


const uploadsPathRelative = 'uploads';
if (!fs.existsSync(uploadsPathRelative)) {
  fs.mkdirSync(uploadsPathRelative);
  fs.writeFileSync(path.join(uploadsPathRelative, '.gitkeep'), '');
  console.log(`Directorio ${uploadsPathRelative} creado.`);
}


// Middleware
app.use(cors());
app.use(express.json());
// Servir archivos estáticos desde 'uploads' (relativo al CWD)
// This is OK, it serves uploaded company logos etc.
app.use('/uploads', express.static(uploadsPathRelative));

// --- API Routes ---
// (Important: All API routes MUST be defined BEFORE the static serving/catch-all for the frontend build)

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

// Ruta protegida para administradores del sistema
app.post('/api/subscription/extend-trial', subscriptionController.extendTrial); // Consider adding system admin middleware here

// Rutas para invoices (modificadas)
app.get('/api/invoices', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, invoiceController.getInvoices);
app.post('/api/invoices', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, subscriptionMiddleware.checkPlanLimits('invoices'), invoiceController.createOrUpdateInvoice);
app.put('/api/invoices/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, invoiceController.updateInvoice);
app.delete('/api/invoices/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, authMiddleware.checkRole(['admin', 'facturador']), invoiceController.deleteInvoice);
app.get('/api/invoices/dashboard-data', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, invoiceController.getDashboardData);
app.patch('/api/invoices/:id/status', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, invoiceController.updateInvoiceStatus);

// Rutas para clients (modificadas)
app.get('/api/clients', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, clientController.getClients);
app.post('/api/clients', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, subscriptionMiddleware.checkPlanLimits('clients'), clientController.createClientController);
app.get('/api/clients/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, clientController.getClientByIdController);
app.put('/api/clients/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, clientController.updateClientController);
app.delete('/api/clients/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, authMiddleware.checkRole(['admin', 'facturador']), clientController.deleteClientController);

// Rutas para products (modificadas)
app.get('/api/products', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, productController.getProducts);
app.post('/api/products', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, subscriptionMiddleware.checkPlanLimits('products'), productController.createProductController);
app.get('/api/products/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, productController.getProductByIdController);
app.put('/api/products/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, productController.updateProductController);
app.delete('/api/products/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, authMiddleware.checkRole(['admin', 'facturador']), productController.deleteProductController);

// Rutas para company (modificadas)
app.get('/api/company', authMiddleware.authenticateToken, companyController.getCompanyController);
app.put('/api/company', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), companyController.updateCompanyController);
app.put('/api/company/theme', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), companyController.updateThemeController);
app.delete('/api/company', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), companyController.deleteCompanyController);

// Ruta mejorada para subir logo
app.post('/api/company/logo', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), upload.single('logo'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ mensaje: 'No se subió ningún archivo.' });
    }
    try {
        const localFilename = req.file.filename;
        console.log('Archivo local guardado:', localFilename);

        const resultado = await cloudinary.uploader.upload(req.file.path, {
            folder: 'logos_empresas'
        });

        const Company = require('./models/company.model');
        let company = await Company.findById(req.user.companyId);

        if (!company) {
           // Clean up uploaded file if company not found
           if (req.file && req.file.path && fs.existsSync(req.file.path)) {
               fs.unlinkSync(req.file.path);
           }
           return res.status(404).json({ mensaje: 'Compañía no encontrada.' });
        }

        if (company.logoId) {
            try {
                await cloudinary.uploader.destroy(company.logoId);
                console.log('Logo anterior eliminado de Cloudinary:', company.logoId);
            } catch (err) {
                console.error('Error eliminando logo anterior de Cloudinary:', err);
            }
        }

        if (company.localFilePath) {
            try {
                const oldPath = path.join(__dirname, '..', 'uploads', company.localFilePath);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                    console.log('Archivo local anterior eliminado:', company.localFilePath);
                } else {
                     console.log('Archivo local anterior no encontrado, no se eliminó:', company.localFilePath);
                }
            } catch (err) {
                console.error('Error al eliminar archivo local anterior:', err);
            }
        }

        company.logoUrl = resultado.secure_url;
        company.logoId = resultado.public_id;
        company.localFilePath = localFilename;
        await company.save();

        // Optionally delete the local file after successful Cloudinary upload & DB save
        // if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        //     fs.unlinkSync(req.file.path);
        //     console.log('Archivo local temporal eliminado después de subida exitosa:', localFilename);
        // }

        res.json({
            mensaje: 'Logo subido exitosamente',
            url: resultado.secure_url,
            public_id: resultado.public_id
        });
    } catch (error) {
        console.error('Error al subir el logo:', error);
         if (req.file && req.file.path && fs.existsSync(req.file.path)) {
             try {
                 fs.unlinkSync(req.file.path);
                 console.log('Archivo local eliminado debido a error en subida:', req.file.filename);
             } catch (cleanupErr) {
                 console.error('Error al limpiar archivo local después de un error:', cleanupErr);
             }
         }
        res.status(500).json({ mensaje: 'Error al subir el logo', error: error.message });
    }
});


// Ruta mejorada para eliminar logo
app.delete('/api/company/logo/:id', authMiddleware.authenticateToken, authMiddleware.checkRole(['admin']), async (req, res) => {
  try {
    const publicIdToDelete = decodeURIComponent(req.params.id);
    console.log('Intentando eliminar logo con public_id:', publicIdToDelete);

    const Company = require('./models/company.model');
    const company = await Company.findById(req.user.companyId);

    if (!company) {
        return res.status(404).json({ success: false, message: 'Compañía no encontrada' });
    }
    if (company.logoId !== publicIdToDelete) {
        return res.status(403).json({ success: false, message: 'No autorizado para eliminar este logo' });
    }

    try {
        await cloudinary.uploader.destroy(publicIdToDelete);
        console.log('Logo eliminado de Cloudinary:', publicIdToDelete);
    } catch (cloudinaryErr) {
         console.error('Error eliminando logo de Cloudinary:', cloudinaryErr);
         return res.status(500).json({ success: false, message: 'Error eliminando de Cloudinary', error: cloudinaryErr.message });
    }

    if (company.localFilePath) {
      try {
        const filePath = path.join(__dirname, '..', 'uploads', company.localFilePath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('Archivo local eliminado:', company.localFilePath);
        } else {
          console.log('Archivo local referenciado no encontrado, no se eliminó:', company.localFilePath);
        }
      } catch (fsError) {
        console.error('Error al eliminar archivo local (continuando...):', fsError);
      }
    } else {
        console.log('No había referencia a archivo local para eliminar.');
    }

    company.logoUrl = null;
    company.logoId = null;
    company.localFilePath = null;
    await company.save();
    console.log('Referencia de logo eliminada de la base de datos.');

    res.json({ success: true, message: 'Logo eliminado completamente' });
  } catch (error) {
    console.error('Error general en la ruta de eliminar logo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rutas para documentos (modificadas)
app.get('/api/documents', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, documentController.getDocuments);
app.get('/api/documents/pending', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, documentController.getPendingDocuments);
app.get('/api/documents/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, documentController.getDocument);
app.post('/api/documents', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, documentController.createDocument);
app.put('/api/documents/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, documentController.updateDocument);
app.delete('/api/documents/:id', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, authMiddleware.checkRole(['admin', 'facturador']), documentController.deleteDocument);
app.patch('/api/documents/:id/status', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, documentController.updateDocumentStatus);
app.post('/api/documents/:id/convert-to-invoice', authMiddleware.authenticateToken, subscriptionMiddleware.checkSubscriptionStatus, subscriptionMiddleware.checkPlanLimits('invoices'), documentController.convertToInvoice);


// --- Static files and Catch-all for Frontend ---
// These lines are typically used for production builds.
// In development, the Vite/React dev server usually handles the frontend.
// Commented out to prevent interference with API routes during development
// and to avoid ENOENT errors if the 'build' folder doesn't exist.

/*
app.use(express.static(path.join(__dirname, '..', 'build')));

app.get('*', (req, res) => {
  // If no API route matched, serve the frontend's index.html for client-side routing.
  res.sendFile(path.join(__dirname, '..', 'build', 'index.html'), (err) => {
     if (err) {
       // Handle error if 'build/index.html' doesn't exist
       console.error("Error sending build/index.html:", err);
       res.status(404).send('Frontend build not found. Ensure the frontend is built and the path is correct, or run the frontend dev server.');
     }
  });
});
*/

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
      setTimeout(() => {
          console.log('Ejecutando limpieza inicial de archivos huérfanos...');
          cleanOrphanFiles();
      }, 10000);

      const cleanIntervalMinutes = 30;
      console.log(`Programando limpieza recurrente de archivos huérfanos cada ${cleanIntervalMinutes} minutos...`);
      setInterval(cleanOrphanFiles, cleanIntervalMinutes * 60 * 1000);
    });
}

startServer();