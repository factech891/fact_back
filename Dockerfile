# Usar una imagen oficial de Node.js
FROM node:18

# Crear y usar el directorio de trabajo en el contenedor
WORKDIR /app

# Copiar los archivos de configuración al contenedor
COPY package*.json ./

# Instalar las dependencias
RUN npm install

# Copiar el resto del código al contenedor
COPY . .

# Exponer el puerto en el contenedor
EXPOSE 5000

# Comando para iniciar el servidor
CMD ["node", "index.js"]
