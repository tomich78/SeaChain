const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const pool = require('../db');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require("jsonwebtoken");
const validator = require('validator');
const { registrarIntentoFallido } = require('../utils/loginAttempts');

const MAX_ATTEMPTS = 5;        // Máximo intentos permitidos 
const BLOCK_TIME = 15;
const {
  aceptarInvitacionEmpresa,
  aceptarInvitacionTripulante
} = require('../utils/aceptacionesNotificaciones');

const { refrescarSesion } = require('../utils/session');

// Registro
router.post('/registro', async (req, res) => {
  const { nombre, email, password, tipo } = req.body;

  try {
    if (!email || !password || !nombre || !tipo) {
      return res.status(400).json({ mensaje: 'Faltan datos obligatorios' });
    }

    if (!validator.isStrongPassword(password, {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1
    })) {
      return res.status(400).json({
        mensaje: 'La contraseña es demasiado débil. Usa mayúsculas, minúsculas, números y símbolos.'
      });
    }

    // ¿Existe ya?
    const existente = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email]
    );
    if (existente.rows.length > 0) {
      return res.status(409).json({ mensaje: 'Este correo ya está registrado' });
    }

    // 🔑 Hash de la contraseña
    const password_hash = await bcrypt.hash(password, 12); // cost 12 recomendado

    // Token de verificación de email
    const token = crypto.randomBytes(32).toString('hex');
    const sendVerificationEmail = require('../utils/sendEmail.js');

    try {
      await sendVerificationEmail(email, token);
    } catch (error) {
      console.error('❌ Error al enviar email:', error);
      return res
        .status(500)
        .json({ error: 'No se pudo enviar el email de verificación' });
    }

    // Guardar en la base
    await pool.query(
      `
      INSERT INTO usuarios (nombre, email, password_hash, tipo, email_verificado, token_verificacion)
      VALUES ($1, $2, $3, $4, false, $5)
    `,
      [nombre, email, password_hash, tipo, token]
    );

    res
      .status(201)
      .json({ message: 'Usuario registrado. Por favor verifica tu email.' });
  } catch (error) {
    console.error('❌ Error en registro:', error);
    res.status(500).json({ message: 'Error al registrar usuario.' });
  }
});


// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {

    // 🔹 1. Buscar intentos previos
    const intentos = await pool.query(
      'SELECT * FROM login_attempts WHERE email = $1',
      [email]
    );

    if (intentos.rows.length > 0) {
      const { attempts, last_attempt } = intentos.rows[0];
      const ahora = new Date();
      const diffMin = (ahora - new Date(last_attempt)) / (1000 * 60);

      // 🚫 Usuario bloqueado
      if (attempts >= MAX_ATTEMPTS && diffMin < BLOCK_TIME) {
        return res.status(429).json({
          mensaje: `Cuenta bloqueada por demasiados intentos fallidos. Intenta de nuevo en ${Math.ceil(BLOCK_TIME - diffMin)} minutos.`
        });
      }
    }


    // 🔹 2. Buscar Usuario
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.tipo, u.email_verificado, u.password_hash,
       eu.empresa_id, eu.rol AS empresa_rol
        FROM usuarios u
        LEFT JOIN empresa_usuarios eu ON u.id = eu.usuario_id
        WHERE u.email = $1;`,
      [email]
    );

    

    if (result.rows.length === 0) {
      await registrarIntentoFallido(email);
      return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos' });
    }
    
    const usuario = result.rows[0];

    if (!usuario.email_verificado) {
      return res.status(403).json({ error: 'Debes verificar tu correo electrónico antes de iniciar sesión' });
    }

    // 🔑 Verificar contraseña con bcrypt
    const passwordOK = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordOK) {
      await registrarIntentoFallido(email);
      return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos' });
    }

    // ✅ Login correcto → resetear intentos
    await pool.query('DELETE FROM login_attempts WHERE email = $1', [email]);

    // Guardar token antes de regenerar
    const pendingToken = req.session.pendingToken;
    // 🔐 Regenerar sesión
    req.session.regenerate(async (err) => {
      if (err) {
        console.error("❌ Error regenerando sesión:", err);
        return res.status(500).json({ mensaje: 'Error interno' });
      }

      try {
        // 👉 refrescamos sesión inicial con datos del usuario
        await refrescarSesion(req, usuario.id);

        let invitacionAceptada = false;
        let rol = null;

        // 🔹 Si había una invitación pendiente en la sesión
        if (pendingToken) {

          try {
            const payload = jwt.verify(pendingToken, process.env.JWT_SECRET);
            rol = payload.rol;

            if (rol === 'operador') {
              await aceptarInvitacionEmpresa(payload, usuario.id, req);
            } else if (rol === 'tripulante') {
              await aceptarInvitacionTripulante(payload, usuario.id, req);
            }

            invitacionAceptada = true;

            // 🔄 refrescar sesión de nuevo por si la invitación modificó empresa_id
            await refrescarSesion(req, usuario.id);

          } catch (err) {
            console.error('❌ Error procesando invitación:', err.message);
          }
        }

        // ✅ Respuesta final con sesión actualizada
        return res.json({
          mensaje: 'Login exitoso',
          ...req.session.user, // contiene id, nombre, tipo, email_verificado, empresa_id
          rol,
          invitacionAceptada,
        });

      } catch (error) {
        console.error("❌ Error en login:", error);
        return res.status(500).json({ mensaje: 'Error interno' });
      }
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ mensaje: 'Error interno' });
  }
});




router.post('/logout', (req, res) => {
  let responded = false;

  req.session.destroy(err => {
    if (responded) return; // 👈 evita enviar dos veces
    responded = true;

    if (err) {
      console.error("❌ Error cerrando sesión:", err);
      return res.status(500).json({ mensaje: 'Error al cerrar sesión' });
    }

    res.clearCookie('connect.sid');
    return res.json({ mensaje: 'Sesión cerrada correctamente' });
  });
});


router.get('/verificar-email/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE token_verificacion = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).send('Token inválido o ya fue usado.');
    }

    // Marcar como verificado
    await pool.query(`
      UPDATE usuarios
      SET email_verificado = true, token_verificacion = NULL
      WHERE token_verificacion = $1
    `, [token]);

    // Redirigir o mostrar mensaje
    res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>SeaChain - Verificación</title>
      <link rel="stylesheet" href="/css/styles.css">
    </head>
    <body>
      <div class="login-container">
        <h1 data-i18n="account.email_verified"></h1>
        <p>Tu correo fue verificado correctamente.</p>
        <a href="/login.html" class="boton-login">Ir a Iniciar Sesión</a>
      </div>
    </body>
    </html>
    `);
  } catch (error) {
    console.error('❌ Error al verificar email:', error);
    res.status(500).send('Error del servidor al verificar el email');
  }
});

//Verificar sesion
router.get('/session', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ mensaje: 'No hay sesión activa' });
  }
});

module.exports = router;

