const express = require('express');
const cors = require('cors');
const path = require('path');
const invoiceController = require('./controllers/invoice.controller');
const clientController = require('./controllers/client.controller');
const productController = require('./controllers/product.controller')
const app = express();
const port = 5002;

app.use(cors());
app.use(express.json());

app.get('/api/invoices', invoiceController.getInvoices);
app.post('/api/invoices', invoiceController.createInvoices);
app.put('/api/invoices/:id', invoiceController.updateInvocies);
app.delete('/api/invoices/:id', invoiceController.deleteInvoices);

app.get('/api/clients', clientController.getCLients);
app.post('/api/clients', clientController.createClient);
app.put('/api/clients/:id', clientController.updateClient);
app.delete('/api/clients/:id', clientController.deleteClient);

app.get('/api/products', productController.getProducts);
app.post('/api/products', productController.createProduct);
app.put('/api/products/:id', productController.updateProduct);

app.use(express.static(path.join(__dirname, 'build')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${port}`);
});