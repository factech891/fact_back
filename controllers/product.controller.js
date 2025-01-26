// products.controller.js
let products = [
    { 
        id: 1, 
        codigo: 'P001',
        nombre: 'Laptop', 
        precio: 1000 
    }
 ];
 
 const getProducts = async (req, res) => res.json(products);
 
 const createProduct = async (req, res) => {
    const { nombre, precio } = req.body;
    const newProduct = {
        id: products.length + 1,
        codigo: `P${String(products.length + 1).padStart(3, '0')}`,
        nombre,
        precio
    };
    products.push(newProduct);
    res.json(newProduct);
 };
 
 const updateProduct = async (req, res) => {
    const { id } = req.params;
    const { nombre, precio } = req.body;
    const productIndex = products.findIndex(product => product.id === parseInt(id));
 
    if (productIndex !== -1) {
        products[productIndex] = { 
            id: parseInt(id), 
            codigo: products[productIndex].codigo,
            nombre, 
            precio 
        };
        res.json(products[productIndex]);
    } else {
        res.status(404).json({ message: 'Product not found' });
    }
 };
 
 const deleteProduct = async (req, res) => {
    const productId = parseInt(req.params.id);
    const productExists = products.some(product => product.id === productId);
    if (!productExists) {
        return res.status(404).json({ message: 'Product not found' });
    }
    products = products.filter(product => product.id !== productId);
    res.status(204).end();
 };
 
 module.exports = {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct
 };