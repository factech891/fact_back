// services/email.service.js
const nodemailer = require('nodemailer');

// Configurar transporte de email
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

const emailService = {
    // Enviar email de bienvenida con credenciales
    sendWelcomeEmail: async (to, { nombre, email, password, companyName, role }) => {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'FactTech'}" <${process.env.EMAIL_FROM || 'noreply@facttech.com'}>`,
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
                    <p style="margin-top: 30px;">Saludos,<br>El equipo de FactTech</p>
                </div>
            `
        };

        return transporter.sendMail(mailOptions);
    },
    
    // Enviar email de recuperación de contraseña
    sendPasswordResetEmail: async (to, resetLink) => {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'FactTech'}" <${process.env.EMAIL_FROM || 'noreply@facttech.com'}>`,
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
            from: `"${process.env.EMAIL_FROM_NAME || 'FactTech'}" <${process.env.EMAIL_FROM || 'noreply@facttech.com'}>`,
            to,
            subject: 'Contraseña actualizada - FactTech',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Contraseña actualizada</h2>
                    <p>Tu contraseña ha sido actualizada correctamente.</p>
                    <p>Si no realizaste este cambio, por favor contacta inmediatamente con el administrador.</p>
                    <p style="margin-top: 30px;">Saludos,<br>El equipo de FactTech</p>
                </div>
            `
        };

        return transporter.sendMail(mailOptions);
    },
    
    // Enviar email con nueva contraseña (reset por admin)
    sendPasswordResetByAdminEmail: async (to, { nombre, email, password, companyName, adminName }) => {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'FactTech'}" <${process.env.EMAIL_FROM || 'noreply@facttech.com'}>`,
            to,
            subject: `Nueva contraseña - ${companyName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Nueva contraseña establecida</h2>
                    <p>Hola ${nombre},</p>
                    <p>El administrador ${adminName} ha restablecido tu contraseña en la plataforma de facturación de <strong>${companyName}</strong>.</p>
                    <p>Tus credenciales de acceso son:</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Nueva contraseña:</strong> ${password}</p>
                    </div>
                    <p>Por favor, inicia sesión y cambia tu contraseña lo antes posible.</p>
                    <p style="margin-top: 30px;">Saludos,<br>El equipo de FactTech</p>
                </div>
            `
        };

        return transporter.sendMail(mailOptions);
    }
};

module.exports = emailService;