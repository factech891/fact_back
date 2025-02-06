// services/product.service.js
const Product = require('../models/product.model');

// Obtener todos los productos
const getAllProducts = async () => {
    return Product.find();
};

// Crear un nuevo producto
const createProduct = async (productData) => {
    const product = new Product(productData);
    return product.save();
};

// Obtener un producto por ID
const getProductById = async (id) => {
    return Product.findById(id);
};

// Buscar un producto por código
const getProductByCode = async (codigo) => {
    return Product.findOne({ codigo });
};

// Actualizar un producto
const updateProduct = async (id, productData) => {
    return Product.findByIdAndUpdate(id, productData, { new: true });
};

// Eliminar un producto
const deleteProduct = async (id) => {
    return Product.findByIdAndDelete(id);
};

module.exports = {
    getAllProducts,
    createProduct,
    getProductById,
    updateProduct,
    deleteProduct,
    getProductByCode // Exportamos la nueva función
};