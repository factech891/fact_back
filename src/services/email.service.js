// services/email.service.js
const nodemailer = require('nodemailer');

// Configurar transporte de email
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.EMAIL_PORT) || 465,
    secure: process.env.EMAIL_SECURE === 'true' || true, // true para puerto 465, modificado según la especificación
    auth: {
        user: process.env.EMAIL_USER || 'info@facttech.io',
        pass: process.env.EMAIL_PASSWORD // La contraseña debe estar en las variables de entorno
    }
});

// // Comentario: El bloque transporter.verify() ha sido eliminado según la especificación implícita 
// // de la modificación, que no lo incluía en el "Debería verse así".
// transporter.verify(function(error, success) {
// if (error) {
// console.error('Error de configuración del servidor de correo:', error);
// } else {
// console.log('Servidor de correo está listo para enviar mensajes');
// }
// });

const emailService = {
    // Enviar email de bienvenida con credenciales
    sendWelcomeEmail: async (to, { nombre, email, password, companyName, role }) => {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'FactTech'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'info@facttech.io'}>`, // Usar EMAIL_USER como fallback para el from
            to,
            subject: `Bienvenido a FactTech - ${companyName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Bienvenido a FactTech</h2>
                    <p>Hola ${nombre},</p>
                    <p>Has sido agregado como usuario en la plataforma de facturación de <strong>${companyName}</strong> con el rol de <strong>${role}</strong>.</p>
                    <p>Tus credenciales de acceso son:</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Contraseña temporal:</strong> ${password}</p>
                    </div>
                    <p>Por favor, inicia sesión y cambia tu contraseña lo antes posible.</p>
                    <p>Puedes acceder desde: <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}">${process.env.FRONTEND_URL || 'http://localhost:3000'}</a></p>
                    <p style="margin-top: 30px;">Saludos,<br>El equipo de FactTech</p>
                </div>
            `
        };

        return transporter.sendMail(mailOptions);
    },
    
    // Enviar email de recuperación de contraseña
    sendPasswordResetEmail: async (to, resetLink) => {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'FactTech'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'info@facttech.io'}>`,
            to,
            subject: 'Recuperación de contraseña - FactTech',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Recuperación de contraseña</h2>
                    <p>Has solicitado restablecer tu contraseña.</p>
                    <p>Haz clic en el siguiente enlace para establecer una nueva contraseña:</p>
                    <p><a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 5px;">Restablecer contraseña</a></p>
                    <p>Este enlace expirará en 1 hora.</p>
                    <p>Si no solicitaste este cambio, por favor ignora este mensaje.</p>
                    <p style="margin-top: 30px;">Saludos,<br>El equipo de FactTech</p>
                </div>
            `
        };

        return transporter.sendMail(mailOptions);
    },
    
    // Enviar confirmación de cambio de contraseña
    sendPasswordChangedEmail: async (to) => {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'FactTech'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'info@facttech.io'}>`,
            to,
            subject: 'Contraseña actualizada - FactTech',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Contraseña actualizada</h2>
                    <p>Tu contraseña ha sido actualizada correctamente.</p>
                    <p>Si no realizaste este cambio, por favor contacta inmediatamente con el administrador de tu cuenta o con nuestro soporte si crees que tu cuenta ha sido comprometida.</p>
                    <p style="margin-top: 30px;">Saludos,<br>El equipo de FactTech</p>
                </div>
            `
        };

        return transporter.sendMail(mailOptions);
    },
    
    // Enviar email con nueva contraseña (reset por admin)
    sendPasswordResetByAdminEmail: async (to, { nombre, email, password, companyName, adminName }) => {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'FactTech'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'info@facttech.io'}>`,
            to,
            subject: `Nueva contraseña establecida por administrador - ${companyName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Nueva contraseña establecida</h2>
                    <p>Hola ${nombre},</p>
                    <p>El administrador ${adminName} ha restablecido tu contraseña en la plataforma de facturación de <strong>${companyName}</strong>.</p>
                    <p>Tus nuevas credenciales de acceso son:</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Nueva contraseña:</strong> ${password}</p>
                    </div>
                    <p>Por favor, inicia sesión y cambia tu contraseña lo antes posible.</p>
                    <p>Puedes acceder desde: <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}">${process.env.FRONTEND_URL || 'http://localhost:3000'}</a></p>
                    <p style="margin-top: 30px;">Saludos,<br>El equipo de FactTech</p>
                </div>
            `
        };

        return transporter.sendMail(mailOptions);
    },

    // Enviar correo de verificación de email
    sendEmailVerificationEmail: async (to, { nombre, verificationLink }) => {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'FactTech'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'info@facttech.io'}>`,
            to,
            subject: 'Verificación de correo electrónico - FactTech',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Verificación de correo electrónico</h2>
                    <p>Hola ${nombre},</p>
                    <p>Gracias por registrarte en FactTech. Para completar tu registro, necesitamos verificar tu dirección de correo electrónico.</p>
                    <p>Haz clic en el siguiente enlace para verificar tu cuenta:</p>
                    <p><a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 5px;">Verificar mi correo</a></p>
                    <p>Este enlace expirará en 24 horas.</p>
                    <p>Si no te registraste en FactTech o no solicitaste esta verificación, por favor ignora este mensaje.</p>
                    <p style="margin-top: 30px;">Saludos,<br>El equipo de FactTech</p>
                </div>
            `
        };
    
        return transporter.sendMail(mailOptions);
    },
    
    // Enviar confirmación de email verificado
    sendEmailVerifiedConfirmation: async (to, { nombre }) => {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'FactTech'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'info@facttech.io'}>`,
            to,
            subject: 'Correo verificado con éxito - FactTech',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>¡Correo verificado con éxito!</h2>
                    <p>Hola ${nombre},</p>
                    <p>Tu dirección de correo electrónico ha sido verificada correctamente.</p>
                    <p>Ya puedes acceder a todas las funcionalidades de FactTech.</p>
                    <p>Inicia sesión aquí: <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}">${process.env.FRONTEND_URL || 'http://localhost:3000'}</a></p>
                    <p style="margin-top: 30px;">Saludos,<br>El equipo de FactTech</p>
                </div>
            `
        };
    
        return transporter.sendMail(mailOptions);
    }
};

module.exports = emailService;