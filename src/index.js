const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require("mongoose");
const invoiceController = require('./controllers/invoice.controller');
const clientController = require('./controllers/client.controller');
const productController = require('./controllers/product.controller')
const app = express();
const port = 5002;
const urlMongo =  "mongodb://localhost:27017/testing";
const mongoDb = process.env.MONGODB_URI || urlMongo ; 

app.use(cors());
app.use(express.json());

app.get('/api/invoices', invoiceController.getInvoices);
app.post('/api/invoices', invoiceController.createInvoices);
app.put('/api/invoices/:id', invoiceController.updateInvocies);
app.delete('/api/invoices/:id', invoiceController.deleteInvoices);
app.get('/api/invoices/:id/pdf', invoiceController.generateInvoicePDFController);

app.get('/api/clients', clientController.getCLients);
app.post('/api/clients', clientController.createClient);
app.put('/api/clients/:id', clientController.updateClient);
app.delete('/api/clients/:id', clientController.deleteClient);

app.get('/api/products', productController.getProducts);
app.post('/api/products', productController.createProduct);
app.put('/api/products/:id', productController.updateProduct);
app.delete('/api/products/:id', productController.deleteProduct);


app.use(express.static(path.join(__dirname, 'build')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});


async function conectarBD() {

    try {
        await mongoose.connect(mongoDb, {
            //useNewUrlParser: true,
            // useUnifiedTopology: true
        });
        console.log('MongoDB Conectada');
        // Puedes realizar tus consultas aquí después de haber establecido la conexión
    } catch (error) {
        console.error('Error al conectar a MongoDB:', error);
    }
}

conectarBD();


app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${port}`);
});