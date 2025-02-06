const Product = require('../models/product.model');

const getAllProducts = async () => {
    return Product.find().sort({ createdAt: -1 });
};

const createProduct = async (productData) => {
    const product = new Product(productData);
    return product.save();
};

const getProductById = async (id) => {
    return Product.findById(id);
};

const getProductByCode = async (codigo) => {
    return Product.findOne({ codigo: codigo.toUpperCase() });
};

const updateProduct = async (id, productData) => {
    return Product.findByIdAndUpdate(
        id, 
        { $set: productData }, 
        { new: true, runValidators: true }
    );
};

const deleteProduct = async (id) => {
    return Product.findByIdAndDelete(id);
};

module.exports = {
    getAllProducts,
    createProduct,
    getProductById,
    updateProduct,
    deleteProduct,
    getProductByCode
};