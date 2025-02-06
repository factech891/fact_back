const mongoose = require('mongoose');
const { 
   getAllProducts, 
   createProduct, 
   getProductById, 
   updateProduct, 
   deleteProduct,
   getProductByCode 
} = require('../services/product.service');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getProducts = async (req, res) => {
   try {
       const products = await getAllProducts();
       res.status(200).json(products);
   } catch (error) {
       console.error('Error al obtener productos:', error);
       res.status(500).json({ error: error.message });
   }
};

const createProductController = async (req, res) => {
   try {
       const { nombre, precio, codigo } = req.body;

       if (!nombre || !precio || !codigo) {
           return res.status(400).json({ error: 'Nombre, precio y código son requeridos.' });
       }

       const productWithSameCode = await getProductByCode(codigo);
       if (productWithSameCode) {
           return res.status(400).json({ error: 'El código ya está en uso por otro producto.' });
       }

       const newProduct = await createProduct({ nombre, precio, codigo });
       res.status(201).json(newProduct);
   } catch (error) {
       console.error('Error al crear producto:', error);
       res.status(500).json({ error: error.message });
   }
};

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

const updateProductController = async (req, res) => {
   try {
       const { id } = req.params;
       const updateData = req.body;

       if (!isValidObjectId(id)) {
           return res.status(400).json({ error: 'ID inválido.' });
       }

       const existingProduct = await getProductById(id);
       if (!existingProduct) {
           return res.status(404).json({ error: 'Producto no encontrado.' });
       }

       // Solo verificar código duplicado si está cambiando
       if (updateData.codigo && updateData.codigo !== existingProduct.codigo) {
           const duplicateCode = await getProductByCode(updateData.codigo);
           if (duplicateCode && duplicateCode._id.toString() !== id) {
               return res.status(400).json({ error: 'El código ya está en uso por otro producto.' });
           }
       }

       const productToUpdate = {
           nombre: updateData.nombre ?? existingProduct.nombre,
           precio: updateData.precio ?? existingProduct.precio,
           codigo: updateData.codigo ?? existingProduct.codigo
       };

       const updatedProduct = await updateProduct(id, productToUpdate);
       res.status(200).json(updatedProduct);
   } catch (error) {
       console.error('Error al actualizar el producto:', error);
       res.status(500).json({ error: error.message });
   }
};

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