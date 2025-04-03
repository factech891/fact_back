// src/controllers/product.controller.js
const mongoose = require('mongoose');
const { 
   getAllProducts, 
   createProduct, 
   getProductById, 
   updateProduct, 
   deleteProduct,
   getProductByCode 
} = require('../services/product.service'); // Asegúrate que la ruta sea correcta

// Helper para validar ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Controlador GET (sin cambios) ---
const getProducts = async (req, res) => {
   try {
       const products = await getAllProducts();
       res.status(200).json(products);
   } catch (error) {
       console.error('Error al obtener productos:', error);
       // Es mejor no exponer error.message directamente en producción a veces
       res.status(500).json({ error: 'Error interno al obtener productos.' }); 
   }
};

// --- Controlador CREATE (MODIFICADO) ---
const createProductController = async (req, res) => {
   try {
        // Extraer TODOS los campos del body que definimos en el modelo/form
       const { nombre, precio, codigo, tipo, stock, descripcion } = req.body; 

        // Validación básica de campos requeridos (modelo ya valida más a fondo)
       if (!nombre || precio === undefined || !codigo || !tipo ) { // precio puede ser 0, así que verificamos undefined
           return res.status(400).json({ error: 'Nombre, precio, código y tipo son requeridos.' });
       }

       // Validar tipo explícitamente (aunque el modelo también lo hace)
       if (!['producto', 'servicio'].includes(tipo)) {
            return res.status(400).json({ error: 'El tipo debe ser "producto" o "servicio".' });
       }
       
       // --- Verificación de código duplicado (sin cambios) ---
       const productWithSameCode = await getProductByCode(codigo);
       if (productWithSameCode) {
           return res.status(400).json({ error: 'El código ya está en uso por otro producto.' });
       }
       // --- Fin Verificación código ---

        // Asegurar que stock sea 0 si es servicio (buena práctica aunque el modelo/form lo hagan)
       const finalStock = tipo === 'servicio' ? 0 : (Number(stock) || 0);

        // Crear objeto con todos los datos para pasar al servicio
       const productData = {
            nombre,
            precio: Number(precio), // Asegurar que precio sea número
            codigo, // El modelo lo pone en mayúsculas
            tipo,
            stock: finalStock,
            // Usar descripción si viene, si no, string vacío (o dejar que default del modelo actúe)
            descripcion: descripcion || '' 
       };

       const newProduct = await createProduct(productData);
       res.status(201).json(newProduct);

   } catch (error) {
       console.error('Error al crear producto:', error);
        // Revisar si es un error de validación de Mongoose
       if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
       }
       res.status(500).json({ error: 'Error interno al crear el producto.' });
   }
};

// --- Controlador GET BY ID (sin cambios) ---
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
       res.status(500).json({ error: 'Error interno al obtener el producto.' });
   }
};

// --- Controlador UPDATE (MODIFICADO) ---
const updateProductController = async (req, res) => {
   try {
       const { id } = req.params;
       // Extraer TODOS los campos posibles del body
       const { nombre, precio, codigo, tipo, stock, descripcion } = req.body; 

       if (!isValidObjectId(id)) {
           return res.status(400).json({ error: 'ID inválido.' });
       }

       // Verificar si el producto existe antes de intentar actualizar
       const existingProduct = await getProductById(id);
       if (!existingProduct) {
           return res.status(404).json({ error: 'Producto no encontrado para actualizar.' });
       }

       // --- Verificación de código duplicado (mejorada) ---
       if (codigo && codigo.toUpperCase() !== existingProduct.codigo) {
           const duplicateCode = await getProductByCode(codigo);
           // Asegurarse que el duplicado encontrado no sea el mismo producto que estamos editando
           if (duplicateCode && duplicateCode._id.toString() !== id) { 
               return res.status(400).json({ error: 'El código ya está en uso por otro producto.' });
           }
       }
       // --- Fin Verificación código ---

        // Validar tipo si se intenta cambiar
       if (tipo && !['producto', 'servicio'].includes(tipo)) {
            return res.status(400).json({ error: 'El tipo debe ser "producto" o "servicio".' });
       }

       // --- Construir objeto de actualización solo con los campos enviados ---
       const productToUpdate = {};
       if (nombre !== undefined) productToUpdate.nombre = nombre;
       if (precio !== undefined) productToUpdate.precio = Number(precio); // Asegurar número
       if (codigo !== undefined) productToUpdate.codigo = codigo; // El modelo lo pone en mayúsculas
       if (tipo !== undefined) productToUpdate.tipo = tipo;
       if (descripcion !== undefined) productToUpdate.descripcion = descripcion;
        
       // Manejo especial para stock: solo actualizar si el tipo es/será 'producto'
       const finalType = tipo || existingProduct.tipo; // Determinar cuál será el tipo final
       if (finalType === 'producto' && stock !== undefined) {
           productToUpdate.stock = Number(stock) || 0; // Actualizar stock
       } else if (finalType === 'servicio') {
            // Si se cambia a servicio o ya era servicio, asegurar stock 0 en la actualización
           productToUpdate.stock = 0; 
       }
       // --- Fin construcción objeto ---

       // Verificar si hay algo que actualizar
        if (Object.keys(productToUpdate).length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron datos para actualizar.' });
        }

       const updatedProduct = await updateProduct(id, productToUpdate);
       
       // updateProduct devuelve null si no encontró el ID (aunque ya verificamos antes)
       if (!updatedProduct) {
            return res.status(404).json({ error: 'Producto no encontrado tras intentar actualizar.' });
       }
       
       res.status(200).json(updatedProduct);

   } catch (error) {
       console.error('Error al actualizar el producto:', error);
       if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
       }
       res.status(500).json({ error: 'Error interno al actualizar el producto.' });
   }
};

// --- Controlador DELETE (sin cambios, pero mejorado mensaje error) ---
const deleteProductController = async (req, res) => {
   try {
       const { id } = req.params;
       if (!isValidObjectId(id)) {
           return res.status(400).json({ error: 'ID inválido' });
       }
       const deletedProduct = await deleteProduct(id);

       if (!deletedProduct) {
           return res.status(404).json({ error: 'Producto no encontrado para eliminar.' });
       }
       // Éxito, sin contenido que devolver
       res.status(204).end(); 
   } catch (error) {
       console.error('Error al eliminar el producto:', error);
       res.status(500).json({ error: 'Error interno al eliminar el producto.' });
   }
};

module.exports = {
   getProducts,
   createProductController,
   getProductByIdController,
   updateProductController,
   deleteProductController
};