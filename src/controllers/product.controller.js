// controllers/product.controller.js
const mongoose = require('mongoose');
const { 
    getAllProducts, 
    createProduct, 
    getProductById, 
    updateProduct, 
    deleteProduct,
    getProductByCode // Importamos la nueva función
} = require('../services/product.service');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Obtener todos los productos
const getProducts = async (req, res) => {
    try {
        const products = await getAllProducts();
        res.status(200).json(products);
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ error: error.message });
    }
};

// Crear un nuevo producto
const createProductController = async (req, res) => {
    try {
        const { nombre, precio, codigo } = req.body;

        // Validar que todos los campos requeridos estén presentes
        if (!nombre || !precio || !codigo) {
            return res.status(400).json({ error: 'Nombre, precio y código son requeridos.' });
        }

        // Verificar si el código ya existe
        const productWithSameCode = await getProductByCode(codigo);
        if (productWithSameCode) {
            return res.status(400).json({ error: 'El código ya está en uso por otro producto.' });
        }

        // Crear el producto
        const newProduct = await createProduct({ nombre, precio, codigo });
        res.status(201).json(newProduct);
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ error: error.message });
    }
};

// Obtener un producto por ID
const getProductByIdController = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: 'ID inválido.' });
        }
        const product = await getProductById(id);
        if (!product) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Actualizar un producto
const updateProductController = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, precio, codigo } = req.body;

        // Validar ID
        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: 'ID inválido.' });
        }

        // Obtener el producto existente
        const existingProduct = await getProductById(id);
        if (!existingProduct) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }

        // Si no se proporciona un nuevo código, mantener el código existente
        const updatedCodigo = codigo || existingProduct.codigo;

        // Verificar si el nuevo código ya existe en otro producto
        if (updatedCodigo !== existingProduct.codigo) {
            const productWithSameCode = await getProductByCode(updatedCodigo);
            if (productWithSameCode) {
                return res.status(400).json({ error: 'El código ya está en uso por otro producto.' });
            }
        }

        // Actualizar el producto
        const updatedProduct = await updateProduct(id, { nombre, precio, codigo: updatedCodigo });

        res.status(200).json(updatedProduct);
    } catch (error) {
        console.error('Error al actualizar el producto:', error);
        res.status(500).json({ error: error.message });
    }
};

// Eliminar un producto
const deleteProductController = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const deletedProduct = await deleteProduct(id);

        if (!deletedProduct) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }
        res.status(204).end();
    } catch (error) {
        console.error('Error al eliminar el producto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

module.exports = {
    getProducts,
    createProductController,
    getProductByIdController,
    updateProductController,
    deleteProductController
};