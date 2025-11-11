require("dotenv").config(); // 👈 Cargar variables de entorno
const sql = require("mssql");

// Configuración usando variables de entorno
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

let pool;

async function connectDB() {
  try {
    if (!pool) {
      pool = await sql.connect(config);
      console.log("✅ Conectado a la base de datos:", process.env.DB_DATABASE);
    }
    return pool;
  } catch (err) {
    console.error("❌ Error de conexión:", err.message);
    throw err;
  }
}

function getConnection() {
  if (!pool) throw new Error("❌ La conexión no está inicializada. Llama a connectDB() primero.");
  return pool;
}

module.exports = { connectDB, getConnection };
