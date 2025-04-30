// services/socket.service.js (versión mejorada)
let io; // Instancia de Socket.io

// Almacenamos una referencia al objeto global para acceder a io en caso de emergencia
const globalScope = typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : {});

const socketService = {
    // Inicializar con la instancia de socket.io
    initialize: (socketIo) => {
        io = socketIo;
        console.log('Socket service initialized successfully');
    },

    // Emitir notificación a una sala de compañía
    emitCompanyNotification: (companyId, notification) => {
        // Si io no está disponible directamente, intentar obtenerlo del ámbito global
        let socketIo = io;
        
        if (!socketIo && globalScope.io) {
            socketIo = globalScope.io;
            console.log('Socket service usando io global como fallback');
        }
        
        if (!socketIo) {
            console.warn('Socket.io no disponible. No se pudo emitir notificación.');
            return false;
        }
        
        const companyRoom = `company:${companyId}`;
        console.log(`Emitiendo nueva notificación a la sala ${companyRoom}:`, notification.title);
        socketIo.to(companyRoom).emit('newNotification', notification);
        return true;
    },
    
    // Método para verificar si el servicio está inicializado
    isInitialized: () => {
        return !!io || !!globalScope.io;
    }
};

module.exports = socketService;