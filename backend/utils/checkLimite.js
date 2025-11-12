// utils/checkLimite.js
const pool = require("../db");

async function checkLimite(empresaId, accion) {
  const { rows } = await pool.query(`
    SELECT p.*, 
           (SELECT COUNT(*) FROM empresa_usuarios WHERE empresa_id = e.id) AS usuarios_actuales,
           (SELECT COUNT(*) FROM contratos WHERE empresa_id = e.id) AS contratos_totales,
           (SELECT COUNT(*) FROM contratos WHERE empresa_id = e.id AND fecha_fin = NULL) AS contratos_activos
    FROM empresas e
    JOIN planes p ON e.plan_id = p.id
    WHERE e.id = $1
  `, [empresaId]);

  if (rows.length === 0) throw new Error("Empresa no encontrada");
  const empresa = rows[0];

  switch (accion) {
    case "nuevo_usuario":
      if (empresa.max_usuarios && empresa.usuarios_actuales >= empresa.max_usuarios) {
        throw new Error("Límite de usuarios alcanzado para este plan");
      }
      break;

    case "nuevo_contrato":
      if (empresa.max_contratos_total && empresa.contratos_totales >= empresa.max_contratos_total) {
        throw new Error("Límite de contratos alcanzado para este plan");
      }
      break;

    case "activar_contrato":
      if (empresa.max_contratos_activos && empresa.contratos_activos >= empresa.max_contratos_activos) {
        throw new Error("Demasiados contratos activos para este plan");
      }
      break;

    case "estadisticas":
      if (!empresa.ver_estadisticas) {
        throw new Error("Tu plan no incluye acceso a estadísticas");
      }
      break;

    default:
      // nada
  }

  return true;
}

module.exports = checkLimite;
