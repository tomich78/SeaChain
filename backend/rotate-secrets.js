// rotate-secrets-advanced.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const envPath = path.join(__dirname, ".env");

// Función para generar un secreto seguro
function generateSecret() {
  return crypto.randomBytes(64).toString("hex");
}

// Leer el archivo .env actual
let envContent = fs.readFileSync(envPath, "utf-8");

// Extraer secretos actuales (si existen)
const oldSession = envContent.match(/^SESSION_SECRET=(.*)$/m)?.[1];
const oldJwt = envContent.match(/^JWT_SECRET=(.*)$/m)?.[1];

// Generar nuevos secretos
const newSessionSecret = generateSecret();
const newJwtSecret = generateSecret();

// Actualizar valores en el .env
envContent = envContent.replace(
  /^SESSION_SECRET=.*$/m,
  `SESSION_SECRET=${newSessionSecret}`
);
envContent = envContent.replace(
  /^JWT_SECRET=.*$/m,
  `JWT_SECRET=${newJwtSecret}`
);

// Si había secretos viejos, guardarlos como *_OLD
if (oldSession) {
  if (/^SESSION_SECRET_OLD=/m.test(envContent)) {
    envContent = envContent.replace(
      /^SESSION_SECRET_OLD=.*$/m,
      `SESSION_SECRET_OLD=${oldSession}`
    );
  } else {
    envContent += `\nSESSION_SECRET_OLD=${oldSession}`;
  }
}

if (oldJwt) {
  if (/^JWT_SECRET_OLD=/m.test(envContent)) {
    envContent = envContent.replace(
      /^JWT_SECRET_OLD=.*$/m,
      `JWT_SECRET_OLD=${oldJwt}`
    );
  } else {
    envContent += `\nJWT_SECRET_OLD=${oldJwt}`;
  }
}

// Guardar cambios
fs.writeFileSync(envPath, envContent);

console.log("✅ Secrets rotados con éxito");
console.log("Nuevo SESSION_SECRET:", newSessionSecret);
console.log("Nuevo JWT_SECRET:", newJwtSecret);
console.log("⚠️ Recordá reiniciar tu servidor para aplicar los cambios.");
