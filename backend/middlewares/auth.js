const pool = require('../db');

// middlewares/auth.js
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'No autorizado, debes iniciar sesión' });
  }
  next();
}

function requireRoles(roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    if (!roles.includes(req.session.user.tipo)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
  };
}

function requireEmpresa(req, res, next) {
  if (!req.session.user?.empresa_id) {
    return res.status(403).json({ error: 'No tienes empresa asociada' });
  }
  next();
}

async function checkEmpresa(req, empresaId) {
  if (
    req.session.user.empresa_id &&
    req.session.user.empresa_id !== empresaId
  ) {
    throw { status: 403, message: 'No tienes permiso para acceder a este recurso (empresa incorrecta).' };
  }
  return true; // todo OK
}

async function checkContratoEmpresa(req, contratoId) {
  // 1. Buscar empresa_id del contrato
  const result = await pool.query(
    'SELECT id, empresa_id FROM contratos WHERE id = $1',
    [contratoId]
  );

  if (result.rows.length === 0) {
    throw { status: 404, message: 'Contrato no encontrado' };
  }

  const contrato = result.rows[0];

  // 2. Validar empresa
  if (
    req.session.user.empresa_id &&
    req.session.user.empresa_id !== contrato.empresa_id
  ) {
    throw { status: 403, message: 'No tienes permiso para acceder a este contrato (empresa incorrecta).' };
  }

  return contrato; // devolvemos solo lo básico
}



module.exports = { requireLogin, requireEmpresa, requireRoles, checkContratoEmpresa, checkEmpresa };