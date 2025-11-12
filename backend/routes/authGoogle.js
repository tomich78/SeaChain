const express = require('express');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const pool = require('../db');
const { refrescarSesion } = require('../utils/session');
const jwt = require("jsonwebtoken");
const {
  aceptarInvitacionEmpresa,
  aceptarInvitacionTripulante
} = require('../utils/aceptacionesNotificaciones');

const router = express.Router();

// ======================================================
// 1️⃣ Estrategia de Google OAuth2
// ======================================================
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const nombre = profile.displayName;

        if (!email) return done(null, false, { message: "No se obtuvo email de Google." });

        // 🔎 Buscar usuario existente
        const existente = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);

        let usuario;
        if (existente.rows.length > 0) {
          usuario = existente.rows[0];
        } else {
          // 🆕 Crear usuario nuevo con email verificado y tipo por defecto
          const nuevo = await pool.query(
            `INSERT INTO usuarios (nombre, email, tipo, email_verificado, metodo_login)
             VALUES ($1, $2, 'persona', true, 'google') RETURNING *`,
            [nombre, email]
          );
          usuario = nuevo.rows[0];
        }

        return done(null, usuario);
      } catch (error) {
        console.error("❌ Error en autenticación Google:", error);
        return done(error, null);
      }
    }
  )
);

// ======================================================
// 2️⃣ Serialización y deserialización de sesión
// ======================================================
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const res = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    done(null, res.rows[0]);
  } catch (err) {
    done(err, null);
  }
});

// ======================================================
// 3️⃣ Middlewares base de Passport
// ======================================================
router.use(passport.initialize());
router.use(passport.session());

// ======================================================
// 4️⃣ Rutas de autenticación con Google
// ======================================================

// 🔹 Iniciar login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 🔹 Callback después de aceptar Google
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html' }),
  async (req, res) => {
    try {
      const usuario = req.user;

      // 🔹 Si venía del flujo de registro
      const isRegisterFlow = req.session.isRegisterFlow;
      delete req.session.isRegisterFlow;

      // 🔄 Refrescar sesión (crea req.session.user con toda la info)
      await refrescarSesion(req, usuario.id);

      // 🔹 Si es un registro nuevo, redirigimos a una pantalla diferente
      if (isRegisterFlow) {
        return res.redirect('/bienvenida.html'); // o tu pantalla de configuración inicial
      }

      // 🔹 Login normal
      const pendingToken = req.session.pendingToken;
      let invitacionAceptada = false;
      let rol = null;

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
          await refrescarSesion(req, usuario.id);
        } catch (err) {
          console.error("❌ Error procesando invitación Google:", err.message);
        }
      }

      const tipo = req.session.user?.tipo || 'persona';
      let destino = '/mural.html';

      if (invitacionAceptada) {
        destino = rol === 'operador'
          ? '/empresa-panel.html?inv=ok'
          : '/index-buque.html?inv=ok';
      }

      res.redirect(destino);

    } catch (error) {
      console.error("❌ Error al manejar callback de Google:", error);
      res.redirect('/login.html?error=google');
    }
  }
);


// 🔹 Logout (opcional)
router.get('/google/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.redirect('/login.html');
    });
  });
});

// 🔹 Registro con Google (nuevo)
router.get('/google/register', (req, res, next) => {
  // Guardamos un flag temporal en la sesión
  req.session.isRegisterFlow = true;
  next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

module.exports = router;
