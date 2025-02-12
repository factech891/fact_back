const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');
const invoiceController = require('./controllers/invoice.controller');
const clientController = require('./controllers/client.controller');
const productController = require('./controllers/product.controller');
const companyController = require('./controllers/company.controller');

const app = express();
const port = 5002;
const urlMongo = "mongodb://localhost:27017/testing";
const mongoDb = process.env.MONGODB_URI || urlMongo;

// Configuración de Multer para subida de archivos
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
const fs = require('fs');
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
app.post('/api/company/logo', upload.single('logo'), companyController.uploadLogoController);
app.put('/api/company/theme', companyController.updateThemeController);

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