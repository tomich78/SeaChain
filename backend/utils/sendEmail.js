// ====== Índice de secciones ======
// 1. Imports y configuración inicial
// 2. Configuración de transporter con nodemailer
// 3. Bloque de verificación de conexión
// 4. sendVerificationEmail - Enviar email de verificación
// 5. Exportar función


// ====== Imports y configuración inicial ======
const nodemailer = require('nodemailer');
require('dotenv').config();


// ====== Configuración de transporter con nodemailer ======
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true para 465
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false  // ✅ Acepta certificados autofirmados
  }
});

// 🔍 BLOQUE DE PRUEBA DE CONEXIÓN

// ====== Bloque de verificación de conexión ======
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Error en conexión:', error);
  } else {
    console.log('✅ Conexión exitosa, listo para enviar correo');
  }
});


// ====== sendVerificationEmail - Enviar email de verificación ======
const sendVerificationEmail = async (email, token) => {
  const url = `${process.env.BASE_URL}/auth/verificar-email/${token}`;

  const mailOptions = {
    from: `SeaChain <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Verificá tu cuenta en SeaChain',
    html: `
      <h2>Gracias por registrarte en SeaChain</h2>
      <p>Para activar tu cuenta, hacé clic en el siguiente enlace:</p>
      <a href="${url}">Verificar Email</a>
    `
  };

  await transporter.sendMail(mailOptions);
};


// ====== Exportar función ======
module.exports = sendVerificationEmail;
