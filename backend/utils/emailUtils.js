import nodemailer from 'nodemailer';

// Carga las variables de entorno
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

class EmailUtils {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: GMAIL_USER,
                clientId: GMAIL_CLIENT_ID,
                clientSecret: GMAIL_CLIENT_SECRET,
                refreshToken: GMAIL_REFRESH_TOKEN,
            },
        });
    }

    /**
     * Genera un código numérico aleatorio de 6 dígitos.
     */
    generateVerificationCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Envía un correo con el código de verificación.
     * @param {string} destinatario - La dirección de correo del usuario.
     * @param {string} codigo - El código de 6 dígitos a enviar.
     */
    async enviarCodigo2FA(destinatario, codigo) {
        const mailOptions = {
            from: `"Tu App" <${GMAIL_USER}>`,
            to: destinatario,
            subject: 'Tu código de verificación de dos factores',
            text: `Hola,\n\nTu código de verificación es: ${codigo}\n\nEste código expirará en 10 minutos.\n\nSi no solicitaste este código, puedes ignorar este correo.`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <h2>Tu código de verificación</h2>
                    <p>Hola,</p>
                    <p>Tu código de verificación de dos factores es:</p>
                    <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; background-color: #f2f2f2; padding: 10px; border-radius: 5px; display: inline-block;">${codigo}</p>
                    <p>Este código expirará en 10 minutos.</p>
                    <hr>
                    <p><small>Si no solicitaste este código, puedes ignorar este correo.</small></p>
                </div>
            `,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Correo de 2FA enviado exitosamente:', info.response);
            return true;
        } catch (error) {
            console.error('Error al enviar el correo de 2FA:', error);
            throw new Error('No se pudo enviar el correo de verificación.');
        }
    }
}

export default new EmailUtils();