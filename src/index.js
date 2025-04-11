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

const app = express();
const port = 5002;
const urlMongo = "mongodb://localhost:27017/testing";
const mongoDb = process.env.MONGODB_URI || urlMongo;

// Configuración de Multer para subida de archivos locales
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Asegurar que existe el directorio de uploads
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Rutas para invoices
app.get('/api/invoices', invoiceController.getInvoices);
app.post('/api/invoices', invoiceController.createOrUpdateInvoice);
app.put('/api/invoices/:id', invoiceController.updateInvoice);
app.delete('/api/invoices/:id', invoiceController.deleteInvoice);
app.get('/api/invoices/dashboard-data', invoiceController.getDashboardData);
// Ruta para actualizar el estado de una factura
app.patch('/api/invoices/:id/status', async (req, res) => {
    invoiceController.updateInvoiceStatus(req, res);
});

// Rutas para clients
app.get('/api/clients', clientController.getClients);
app.post('/api/clients', clientController.createClientController);
app.get('/api/clients/:id', clientController.getClientByIdController);
app.put('/api/clients/:id', clientController.updateClientController);
app.delete('/api/clients/:id', clientController.deleteClientController);

// Rutas para products
app.get('/api/products', productController.getProducts);
app.post('/api/products', productController.createProductController);
app.get('/api/products/:id', productController.getProductByIdController);
app.put('/api/products/:id', productController.updateProductController);
app.delete('/api/products/:id', productController.deleteProductController);

// Rutas para company
app.get('/api/company', companyController.getCompanyController);
app.put('/api/company', companyController.updateCompanyController);
app.post('/api/company/logo', upload.single('logo'), async (req, res) => {
    try {
        // Subir el logo a Cloudinary
        const resultado = await cloudinary.uploader.upload(req.file.path, {
            folder: 'logos_empresas'
        });
        res.json({ mensaje: 'Logo subido exitosamente', url: resultado.secure_url });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al subir el logo', error });
    }
});
app.put('/api/company/theme', companyController.updateThemeController);
app.delete('/api/company', companyController.deleteCompanyController);

// Rutas para documentos
app.get('/api/documents', documentController.getDocuments);
app.get('/api/documents/pending', documentController.getPendingDocuments);
app.get('/api/documents/:id', documentController.getDocument);
app.post('/api/documents', documentController.createDocument);
app.put('/api/documents/:id', documentController.updateDocument);
app.delete('/api/documents/:id', documentController.deleteDocument);
app.patch('/api/documents/:id/status', documentController.updateDocumentStatus);
app.post('/api/documents/:id/convert-to-invoice', documentController.convertToInvoice);

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Conexión a MongoDB
async function conectarBD() {
  try {
    await mongoose.connect(mongoDb);
    console.log('MongoDB Conectada');
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error);
    process.exit(1);
  }
}

conectarBD();

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${port}`);
});
