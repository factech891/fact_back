// src/controllers/product.controller.js
const mongoose = require('mongoose');
const {
   getAllProducts,
   createProduct,
   getProductById,
   updateProduct,
   deleteProduct,
   getProductByCode // Asegúrate que esté exportado y actualizado en el servicio
} = require('../services/product.service'); // Asegúrate que la ruta sea correcta
const stockMonitorService = require('../services/stock-monitor.service'); // Importar servicio de monitoreo de stock

// Helper para validar ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Obtener todos los productos de la compañía del usuario.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
const getProducts = async (req, res) => {
   try {
       // Obtener companyId del usuario autenticado
       const companyId = req.user?.companyId;
       if (!companyId || !isValidObjectId(companyId)) {
           console.error('Controller - Error: companyId inválido o no encontrado en req.user');
           return res.status(500).json({ error: 'Error interno: Información de compañía inválida o faltante.' });
       }

       console.log(`Controller - getProducts para CompanyId: ${companyId}`);
       // Llamar al servicio pasando companyId
       const products = await getAllProducts(companyId);
       res.status(200).json(products);

   } catch (error) {
       console.error('Controller - Error al obtener productos:', error.message);
       res.status(500).json({ error: 'Error interno al obtener productos.' });
   }
};

/**
 * Crear un nuevo producto para la compañía del usuario.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
const createProductController = async (req, res) => {
   try {
       // Obtener companyId del usuario autenticado
       const companyId = req.user?.companyId;
       if (!companyId || !isValidObjectId(companyId)) {
           console.error('Controller - Error: companyId inválido o no encontrado en req.user para crear producto.');
           return res.status(500).json({ error: 'Error interno: Información de compañía inválida o faltante.' });
       }

       const { nombre, precio, codigo, tipo, stock, descripcion } = req.body;
       console.log(`Controller - Datos recibidos para crear producto para CompanyId ${companyId}:`, req.body);

       // Validación básica (se mantiene)
       if (!nombre || precio === undefined || !codigo || !tipo ) {
           return res.status(400).json({ error: 'Nombre, precio, código y tipo son requeridos.' });
       }
       if (!['producto', 'servicio'].includes(tipo)) {
            return res.status(400).json({ error: 'El tipo debe ser "producto" o "servicio".' });
       }

       // --- Verificación de código duplicado DENTRO de la compañía ---
       const productWithSameCode = await getProductByCode(codigo, companyId); // Pasar companyId
       if (productWithSameCode) {
           console.warn(`Controller - Intento de crear producto con código duplicado '${codigo}' para CompanyId ${companyId}`);
           return res.status(400).json({ error: 'El código ya está en uso por otro producto en esta compañía.' });
       }
       // --- Fin Verificación código ---

       const finalStock = tipo === 'servicio' ? 0 : (Number.isInteger(Number(stock)) ? Number(stock) : 0);

       const productData = {
            nombre,
            precio: Number(precio),
            codigo, // El servicio/modelo maneja mayúsculas
            tipo,
            stock: finalStock,
            descripcion: descripcion || ''
            // companyId será añadido por el servicio
       };

       // Llamar al servicio createProduct pasando productData y companyId
       const newProduct = await createProduct(productData, companyId);
       
       // Verificar si el nuevo producto tiene stock bajo y notificar si es necesario
       if (newProduct.tipo === 'producto' && newProduct.stock > 0) {
           await stockMonitorService.checkProductStockAfterUpdate(newProduct);
       }
       
       res.status(201).json(newProduct);

   } catch (error) {
       console.error('Controller - Error al crear producto:', error.message);
       if (error.name === 'ValidationError') {
            // Extraer mensajes de error de validación
            const errors = Object.values(error.errors).map(el => el.message);
            return res.status(400).json({ error: `Error de validación: ${errors.join(', ')}` });
       }
       // Manejar error de duplicado lanzado por el servicio (basado en índice único compuesto)
       if (error.message.includes('duplicate key') || error.message.includes('Ya existe un producto con este código')) {
            return res.status(400).json({ error: 'El código ya está en uso por otro producto en esta compañía.' });
       }
       res.status(500).json({ error: 'Error interno al crear el producto.' });
   }
};

/**
 * Obtener un producto por ID, verificando que pertenezca a la compañía del usuario.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
const getProductByIdController = async (req, res) => {
   try {
       const { id } = req.params; // ID del producto
       const companyId = req.user?.companyId; // ID de la compañía

       if (!companyId || !isValidObjectId(companyId)) {
           console.error('Controller - Error: companyId inválido o no encontrado en req.user para obtener producto.');
           return res.status(500).json({ error: 'Error interno: Información de compañía inválida o faltante.' });
       }
       if (!isValidObjectId(id)) {
            console.warn(`Controller - ID de producto inválido: ${id}`);
           return res.status(400).json({ error: 'ID de producto inválido.' });
       }

       console.log(`Controller - getProductById: ProductID ${id}, CompanyId ${companyId}`);
       // Llamar al servicio pasando ID del producto y companyId
       const product = await getProductById(id, companyId);

       // El servicio lanza 'Producto no encontrado' si no existe o no pertenece a la compañía
       res.status(200).json(product);

   } catch (error) {
       console.error('Controller - Error al obtener producto por ID:', error.message);
       if (error.message === 'Producto no encontrado') {
           return res.status(404).json({ error: 'Producto no encontrado.' });
       }
        if (error.message === 'ID de producto inválido' || error.message === 'ID de compañía inválido') {
            return res.status(400).json({ error: error.message });
        }
       res.status(500).json({ error: 'Error interno al obtener el producto.' });
   }
};

/**
 * Actualizar un producto, verificando que pertenezca a la compañía del usuario.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
const updateProductController = async (req, res) => {
   try {
       const { id } = req.params; // ID del producto a actualizar
       const companyId = req.user?.companyId; // ID de la compañía
       const productData = req.body; // Datos para actualizar

       if (!companyId || !isValidObjectId(companyId)) {
           console.error('Controller - Error: companyId inválido o no encontrado en req.user para actualizar producto.');
           return res.status(500).json({ error: 'Error interno: Información de compañía inválida o faltante.' });
       }
       if (!isValidObjectId(id)) {
            console.warn(`Controller - ID de producto inválido para actualizar: ${id}`);
           return res.status(400).json({ error: 'ID de producto inválido.' });
       }

        console.log(`Controller - Datos recibidos para actualizar producto ${id} para CompanyId ${companyId}:`, productData);

       // --- Verificación de código duplicado DENTRO de la compañía (si se intenta cambiar) ---
       if (productData.codigo) {
            const upperCaseCodigo = productData.codigo.toUpperCase();
            // Buscar si ya existe otro producto con ese código en la misma compañía
            const duplicateCodeProduct = await getProductByCode(upperCaseCodigo, companyId);
            // Si existe Y NO es el mismo producto que estamos editando, entonces es un duplicado inválido
            if (duplicateCodeProduct && duplicateCodeProduct._id.toString() !== id) {
                console.warn(`Controller - Intento de actualizar producto ${id} con código duplicado '${upperCaseCodigo}' para CompanyId ${companyId}`);
                return res.status(400).json({ error: 'El código ya está en uso por otro producto en esta compañía.' });
            }
            productData.codigo = upperCaseCodigo; // Asegurar mayúsculas para la actualización
       }
       // --- Fin Verificación código ---

        // Validar tipo si se intenta cambiar
       if (productData.tipo && !['producto', 'servicio'].includes(productData.tipo)) {
            return res.status(400).json({ error: 'El tipo debe ser "producto" o "servicio".' });
       }

       // Asegurar que precio y stock sean números si vienen
       if (productData.precio !== undefined) productData.precio = Number(productData.precio);
       if (productData.stock !== undefined) productData.stock = Number.isInteger(Number(productData.stock)) ? Number(productData.stock) : undefined; // Ignorar si no es entero

       // Si se cambia a servicio o ya era servicio y se envía stock, forzarlo a 0
       // Necesitamos saber el tipo actual o el tipo que se está enviando
       if (productData.tipo === 'servicio') {
           productData.stock = 0;
       } else if (productData.stock !== undefined && productData.tipo === undefined) {
           // Si se envía stock pero no tipo, necesitamos saber el tipo actual para decidir
           // Podríamos hacer una llamada extra a getProductById o confiar en que el frontend envíe el tipo si es relevante
           // Por simplicidad aquí, asumimos que si se envía stock, el tipo es 'producto' o ya lo era.
           // Una lógica más robusta podría requerir obtener el producto actual primero.
       }


       // Llamar al servicio updateProduct pasando id, datos y companyId
       const updatedProduct = await updateProduct(id, productData, companyId);
       
       // Verificar si el producto actualizado tiene stock bajo y generar notificación si es necesario
       if (updatedProduct.tipo === 'producto' && 
           (productData.stock !== undefined || productData.tipo !== undefined)) {
           // Solo verificar si se modificó el stock o el tipo
           await stockMonitorService.checkProductStockAfterUpdate(updatedProduct);
       }

       // El servicio ya maneja el caso de no encontrado o sin permiso
       res.status(200).json(updatedProduct);

   } catch (error) {
       console.error('Controller - Error al actualizar el producto:', error.message);
       if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(el => el.message);
            return res.status(400).json({ error: `Error de validación: ${errors.join(', ')}` });
       }
       if (error.message.includes('duplicate key') || error.message.includes('Ya existe otro producto con este código')) {
            return res.status(400).json({ error: 'El código ya está en uso por otro producto en esta compañía.' });
       }
       if (error.message.startsWith('Producto no encontrado') || error.message.startsWith('ID de producto inválido')) {
            return res.status(404).json({ error: 'Producto no encontrado o no tiene permiso para actualizarlo.' });
       }
        if (error.message === 'ID de compañía inválido') {
            return res.status(500).json({ error: 'Error interno: Información de compañía inválida.' });
        }
       res.status(500).json({ error: 'Error interno al actualizar el producto.' });
   }
};

/**
 * Eliminar un producto, verificando que pertenezca a la compañía del usuario.
 * @param {Object} req - Solicitud HTTP (debe incluir req.user con companyId)
 * @param {Object} res - Respuesta HTTP
 */
const deleteProductController = async (req, res) => {
   try {
       const { id } = req.params; // ID del producto a eliminar
       const companyId = req.user?.companyId; // ID de la compañía

       if (!companyId || !isValidObjectId(companyId)) {
           console.error('Controller - Error: companyId inválido o no encontrado en req.user para eliminar producto.');
           return res.status(500).json({ error: 'Error interno: Información de compañía inválida o faltante.' });
       }
       if (!isValidObjectId(id)) {
           console.warn(`Controller - ID de producto inválido para eliminar: ${id}`);
           return res.status(400).json({ error: 'ID de producto inválido' });
       }

       console.log(`Controller - ID recibido para eliminar producto: ${id} para CompanyId ${companyId}`);
       // Llamar al servicio deleteProduct pasando id y companyId
       await deleteProduct(id, companyId);

       // El servicio lanza error si no lo encuentra o no pertenece a la company.
       res.status(204).end(); // Éxito, sin contenido

   } catch (error) {
       console.error('Controller - Error al eliminar el producto:', error.message);
       if (error.message.startsWith('Producto no encontrado') || error.message.startsWith('ID de producto inválido')) {
            return res.status(404).json({ error: 'Producto no encontrado o no tiene permiso para eliminarlo.' });
       }
        if (error.message === 'ID de compañía inválido') {
            return res.status(500).json({ error: 'Error interno: Información de compañía inválida.' });
        }
       res.status(500).json({ error: 'Error interno al eliminar el producto.' });
   }
};

module.exports = {
   getProducts,
   createProductController,
   getProductByIdController,
   updateProductController,
   deleteProductController
   // Asegúrate que las rutas estén usando estos controladores
};