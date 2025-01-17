const express = require('express');
const cors = require('cors');
const path = require('path');
const invoiceController  =  require('./controllers/invoice.controller');
const clientController = require('./controllers/client.controller');
const productController = require('./controllers/product.controller')
const app = express();
const port = 5002;

// Middleware
app.use(cors());
app.use(express.json());


app.get('/api/invoices',invoiceController.getInvoices);
app.post('/api/invoices',invoiceController.createInvoices);
app.put('/api/invoices/:id',invoiceController.updateInvocies);
app.delete('/api/invoices/:id',invoiceController.deleteInvoices);


// Endpoints de clientes
app.get('/api/clients', clientController.getCLients );
app.post('/api/clients', clientController.createClient);

// Endpoints de productos
app.get('/api/products', productController.getProducts);
app.post('/api/products', productController.createProduct);

// Sirviendo el frontend
app.use(express.static(path.join(__dirname, 'build')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Iniciar el servidor
app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${port}`);
});
