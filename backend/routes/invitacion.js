// ====== Imports y configuración inicial ======
const express = require("express");
const router = express.Router();
const pool = require("../db"); // ajusta si tu pool está en otro archivo
const jwt = require("jsonwebtoken");

const {
  aceptarInvitacionEmpresa,
  aceptarInvitacionTripulante
} = require('../utils/aceptacionesNotificaciones');

//Verificado
router.get("/", async (req, res) => {
  const { token } = req.query;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (!req.session.user) {
      req.session.pendingToken = token;
      return req.session.save(() => {
        res.redirect("/login.html");
      });
    }

    try {
      if (payload.rol === 'operador') {
        await aceptarInvitacionEmpresa(
          {
            invitacionId: payload.invitacionId,
            empresaId: payload.empresaId,
            contratoId: payload.contratoId,
            enviado_por: payload.enviado_por
          },
          req.session.user.id,
          req
        );
      } else if (payload.rol === 'tripulante') {
        await aceptarInvitacionTripulante(
          {
            invitacionId: payload.invitacionId,
            empresaId: payload.empresaId,
            contratoId: payload.contratoId,
            enviado_por: payload.enviado_por
          },
          req.session.user.id,
          req
        );
      } else {
        console.warn(`⚠️ Rol no reconocido en invitación: ${payload.rol}`);
      }
    } catch (err) {
      console.error("❌ Error aceptando invitación:", err.message);
    }

    if (payload.rol === 'operador') {
    return res.redirect(`/empresa-panel.html?inv=ok`);
    } else if (payload.rol === 'tripulante') {
    return res.redirect(`/index-buque.html?inv=ok`);
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
    return res.status(400).send("❌ Link inválido o expirado");
  }
});


// ====== Exportar router ======
module.exports = router;