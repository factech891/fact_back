// services/socket.service.js
let io; // Instancia de Socket.io (se inicializará después)

const socketService = {
    // Inicializar con la instancia de socket.io
    initialize: (socketIo) => {
        io = socketIo;
        console.log('Socket service initialized successfully');
    },

    // Emitir notificación a una sala de compañía
    emitCompanyNotification: (companyId, notification) => {
        if (!io) {
            console.warn('Socket.io no inicializado en socketService. No se pudo emitir notificación.');
            return false;
        }
        
        const companyRoom = `company:${companyId}`;
        console.log(`Emitiendo nueva notificación a la sala ${companyRoom}:`, notification.title);
        io.to(companyRoom).emit('newNotification', notification);
        return true;
    },
    
    // Método para verificar si el servicio está inicializado
    isInitialized: () => {
        return !!io;
    }
};

module.exports = socketService;