const sql = require("mssql");

// Las credenciales se leen desde el archivo .env (nunca subas .env a GitHub)
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,                   // true para conexiones en la nube (somee)
    trustServerCertificate: true,    // necesario porque somee usa un certificado no verificado
    enableArithAbort: true,
  },
  port: parseInt(process.env.DB_PORT) || 1433,
};

let pool;

async function connectDB() {
  try {
    if (!pool) {
      pool = await sql.connect(config);
      console.log(`✅ Conectado a SQL Server (${process.env.DB_SERVER})`);
    }
    return pool;
  } catch (err) {
    console.error("❌ Error de conexión:", err.message);
    throw err;
  }
}

function getConnection() {
  return pool;
}

module.exports = { connectDB, getConnection };