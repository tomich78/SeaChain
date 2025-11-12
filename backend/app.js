const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./db');
const helmet = require("helmet");
const passport = require('passport'); // 👈 NUEVO
const { requireLogin, requireEmpresa } = require('./middlewares/auth');
const rateLimit = require("express-rate-limit");

const app = express();

// 🔐 Límite para login, register y password reset
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: "⚠️ Demasiados intentos, prueba más tarde.",
  standardHeaders: true,
  legacyHeaders: false,
});

// ✅ Usar Helmet en toda la app
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdn.datatables.net",
          "https://code.jquery.com",
          "https://cdn.socket.io",
          "https://unpkg.com",
          "https://accounts.google.com",
          "https://apis.google.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdn.jsdelivr.net",
          "https://cdn.datatables.net",
          "https://cdnjs.cloudflare.com",
          "https://accounts.google.com"  // ✅ agregado
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https:"
        ],
        connectSrc: [
          "'self'",
          "wss:",
          "https://cdn.socket.io",
          "https://cdn.jsdelivr.net",
          "https://accounts.google.com",  // ✅ agregado (opcional)
          "https://apis.google.com"
        ],
        frameSrc: [
          "'self'",
          "https://accounts.google.com",  // ✅ necesario para el iframe
          "https://apis.google.com",
          "https://ssl.gstatic.com"
        ],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    referrerPolicy: { policy: "no-referrer" },
    frameguard: { action: "deny" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
  })
);

// 👉 Forzar HTTPS en producción
app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === "production" &&
    !req.secure &&
    req.get("x-forwarded-proto") !== "https"
  ) {
    return res.redirect("https://" + req.get("host") + req.originalUrl);
  }
  next();
});

// 🔐 Necesario en producción detrás de proxy (Railway, Heroku, Nginx, etc.)
app.set('trust proxy', 1);

// Sesiones seguras
const sessionMiddleware = session({
  store: new pgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 1000 * 60 * 60 * 2 // 2 horas
  },
  name: 'sc.sid'
});

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(sessionMiddleware);

// 🔹 Inicializar Passport (debe ir después de session)
app.use(passport.initialize());
app.use(passport.session());

// Archivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/css', express.static(path.join(__dirname, '../css')));
app.use('/js', express.static(path.join(__dirname, '../js')));
app.use('/imagenes', express.static(path.join(__dirname, '../archivos/SistemaBuques/imagenes')));
app.use('/temporales', express.static(path.join(__dirname, '../archivos/plantillas/temporales')));
app.use('/plantillas', express.static(path.join(__dirname, '../archivos/plantillas')));
app.use('/empresas', express.static(path.join(__dirname, '../archivos/empresas')));
app.use('/archivos', express.static(path.join(__dirname, '../archivos')));

// 🔌 Rutas externas
const authRoutes = require('./routes/auth');
const authGoogle = require('./routes/authGoogle'); // 👈 NUEVO
const adminRoutes = require('./routes/admin');
const actualizacionesRoutes = require('./routes/actualizaciones');
const operadorRoutes = require('./routes/operador');
const contratosRoutes = require('./routes/contratos');
const platillasRoutes = require('./routes/plantilla');
const empresaRoutes = require('./routes/empresa');
const notificacionesRoutes = require('./routes/notificaciones');
const empresaMiembros = require('./routes/empresaMiembros');
const empresaConfig = require('./routes/empresaConfig');
const clientes = require('./routes/clientes');
const zonas = require('./routes/zonas');
const buques = require('./routes/buques');
const cargas = require('./routes/cargas');
const descargas = require('./routes/descargas');
const usuarios = require('./routes/usuarios');
const conexiones = require('./routes/conexiones');
const mural = require('./routes/mural');
const mensajes = require('./routes/mensajes');
const invitacion = require('./routes/invitacion');
const sof = require('./routes/sof');
const estadisticas = require("./routes/estadisticas");

// 👉 Rate limiting solo en /auth/login y /auth/register
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);

// 📌 Rutas públicas
app.use('/auth', authRoutes);
app.use('/auth', authGoogle); // 👈 Ruta de Google integrada aquí
app.use('/invitacion', invitacion);

// 📌 Middleware global para todo lo demás
app.use(requireLogin);

// Rutas protegidas
app.use('/admin', adminRoutes);
app.use('/actualizaciones', actualizacionesRoutes);
app.use('/operador', operadorRoutes);
app.use('/contratos', contratosRoutes);
app.use('/plantilla', platillasRoutes);
app.use('/empresa', empresaRoutes);
app.use('/notificaciones', notificacionesRoutes);
app.use('/empresaMiembros', empresaMiembros);
app.use('/empresaConfig', empresaConfig);
app.use('/clientes', clientes);
app.use('/zonas', zonas);
app.use('/buques', buques);
app.use('/cargas', cargas);
app.use('/descargas', descargas);
app.use('/usuarios', usuarios);
app.use('/conexiones', conexiones);
app.use('/mural', mural);
app.use('/mensajes', mensajes);
app.use('/sof', sof);
app.use("/estadisticas", estadisticas);

// 🌐 Página pública principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 🛠️ Tareas periódicas
const consolidarActualizaciones = require('./utils/consolidarActualizaciones');
setInterval(() => consolidarActualizaciones(pool, fs, path), 30 * 1000);

const limpiarNotificaciones = require('./utils/limpiarNotificaciones');
limpiarNotificaciones(pool);

module.exports = { app, sessionMiddleware };
