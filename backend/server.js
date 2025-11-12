require('dotenv').config();
const http = require('http');
const { app, sessionMiddleware } = require('./app'); // 👈 importamos ambos
const { Server } = require('socket.io');
const pool = require('./db');

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || '*',
    credentials: true
  }
});

// 🔄 conectar sesiones a sockets
const wrap = (middleware) => (socket, next) =>
  middleware(socket.request, {}, next);

io.use(wrap(sessionMiddleware));

app.set('io', io);

// WebSockets
io.on('connection', (socket) => {
  const sess = socket.request.session;   // 👈 acá obtenés la sesión
  const user = sess?.user;

  if (user) {

  // 🔄 Cada vez que se recibe un evento desde el cliente
  socket.onAny((event, ...args) => {
    if (sess) {
      sess.touch();   // 👈 renueva el maxAge de la cookie
      sess.save((err) => {
        if (err) console.error("❌ Error al renovar sesión en socket:", err);
      });
    }
  });

    // 🔹 Sala privada por usuario
    socket.join(String(user.id));

    // 🔹 Sala de empresa (si tiene empresa asociada)
    if (user.empresa_id) {
      socket.join(`empresa-${user.empresa_id}`);
    }
  }

  // 🔹 Join manual a empresa
  socket.on("joinEmpresa", ({ empresaId }) => {
    socket.join(`empresa-${empresaId}`);
  });

  // ⚓️ NUEVO: joinContrato
  socket.on("joinContrato", async ({ contratoId }) => {
    try {
      if (!user) return;
      const cid = parseInt(contratoId, 10);
      if (!cid) return;

      const { rows } = await pool.query(`
        SELECT 1
        FROM contratos c
        WHERE c.id = $1
          AND (
            EXISTS (
              SELECT 1 FROM empresa_usuarios eu
              WHERE eu.empresa_id = c.empresa_id
                AND eu.usuario_id = $2
            )
            OR EXISTS (
              SELECT 1 FROM contrato_tripulante ct
              WHERE ct.contrato_id = c.id
                AND ct.usuario_id = $2
            )
          )
        LIMIT 1;
      `, [cid, user.id]);

      if (rows.length === 0) {
        socket.emit("errorContrato", { contratoId: cid, message: "No autorizado para este contrato." });
        return;
      }

      socket.join(`contrato-${cid}`);
      socket.emit("joinedContrato", { contratoId: cid });
    } catch (err) {
      console.error("joinContrato error:", err);
      socket.emit("errorContrato", { contratoId, message: "Error al unirse al contrato." });
    }
  });

  socket.on("leaveContrato", ({ contratoId }) => {
    const cid = parseInt(contratoId, 10);
    if (!cid) return;
    socket.leave(`contrato-${cid}`);
  });

  socket.on("disconnect", () => {
  });
});



const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});
