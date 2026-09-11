require("dotenv").config();
// index.js (backend) — compatible con ejecución local/Render (app.listen)
// y con Vercel (exportado como función serverless)
const express = require("express");
const cors = require("cors");
const { connectDB, getConnection } = require("./db");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === "production";

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

/* ============================================================
   CONEXIÓN A LA BASE DE DATOS (lazy, compatible con serverless)
   Se inicia una sola vez; cada request espera a que esté lista
   antes de continuar. db.js ya evita reconectar si el pool
   ya existe (patrón singleton), así que en Render/local esto
   se resuelve una sola vez, y en Vercel se reutiliza mientras
   la instancia siga "caliente".
============================================================ */
const dbReady = connectDB().catch((err) => {
  console.error("❌ No se pudo conectar a la base de datos al iniciar:", err.message);
});

app.use(async (req, res, next) => {
  try {
    await dbReady;
    next();
  } catch (err) {
    res.status(500).json({ error: "⚠ Error de conexión a la base de datos" });
  }
});

/* ============================================================
   RUTA DE PRUEBA
============================================================ */
app.get("/", (req, res) => {
  res.send("✅ Servidor backend funcionando con SQL Server");
});

/* ============================================================
   SESIÓN
============================================================ */
app.get("/check-session", async (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.json({ loggedIn: false });

  try {
    const result = await getConnection()
      .request()
      .input("ID", token)
      .query("SELECT ID_Usuario, Nombre, Rol FROM Usuario WHERE ID_Usuario = @ID");

    if (result.recordset.length === 0) {
      return res.json({ loggedIn: false });
    }
    res.json({ loggedIn: true, user: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ loggedIn: false, error: err.message });
  }
});

app.post("/login", async (req, res) => {
  const { Nombre, Contraseña } = req.body;
  console.log("🔑 Intento login:", Nombre);
  try {
    const result = await getConnection()
      .request()
      .input("Nombre", Nombre)
      .input("Contraseña", Contraseña)
      .query(`
        SELECT ID_Usuario, Nombre, Rol 
        FROM Usuario 
        WHERE Nombre = @Nombre AND Contraseña = @Contraseña
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: "⚠ Usuario o contraseña incorrectos" });
    }

    const user = result.recordset[0];
    res.cookie("token", String(user.ID_Usuario), {
      httpOnly: true,
      maxAge: 3600000,
      sameSite: "lax",
      secure: isProd,
      path: "/",
    });
    res.json({ message: "✅ Login exitoso", user });
  } catch (err) {
    console.error("⚠ Error en login:", err.message);
    res.status(500).send("⚠ Error en login: " + err.message);
  }
});

app.post("/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, sameSite: "lax", secure: isProd, path: "/" });
  res.json({ message: "Sesión cerrada correctamente" });
});

/* ============================================================
   CRUD USUARIO
============================================================ */
app.get("/usuarios", async (req, res) => {
  try {
    const result = await getConnection().request().query("SELECT * FROM Usuario");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/usuarios", async (req, res) => {
  const { Nombre, Contraseña, CorreoElectronico, DPI, TELEFONO, Salt, Rol } = req.body;
  try {
    await getConnection()
      .request()
      .input("Nombre", Nombre)
      .input("Contraseña", Contraseña)
      .input("CorreoElectronico", CorreoElectronico)
      .input("DPI", DPI)
      .input("TELEFONO", TELEFONO)
      .input("Salt", Salt || "")
      .input("Rol", Rol || "usuario")
      .query(`
        INSERT INTO Usuario (Nombre, Contraseña, CorreoElectronico, DPI, TELEFONO, Salt, Rol)
        VALUES (@Nombre, @Contraseña, @CorreoElectronico, @DPI, @TELEFONO, @Salt, @Rol)
      `);
    res.status(201).send("✅ Usuario creado correctamente");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.put("/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  const { Nombre, Contraseña, CorreoElectronico, DPI, TELEFONO, Salt, Rol } = req.body;
  try {
    await getConnection()
      .request()
      .input("ID_Usuario", id)
      .input("Nombre", Nombre)
      .input("Contraseña", Contraseña)
      .input("CorreoElectronico", CorreoElectronico)
      .input("DPI", DPI)
      .input("TELEFONO", TELEFONO)
      .input("Salt", Salt || "")
      .input("Rol", Rol)
      .query(`
        UPDATE Usuario
        SET Nombre=@Nombre, Contraseña=@Contraseña, CorreoElectronico=@CorreoElectronico,
            DPI=@DPI, TELEFONO=@TELEFONO, Salt=@Salt, Rol=@Rol
        WHERE ID_Usuario = @ID_Usuario
      `);
    res.send("✅ Usuario actualizado correctamente");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.delete("/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await getConnection()
      .request()
      .input("ID_Usuario", id)
      .query("DELETE FROM Usuario WHERE ID_Usuario = @ID_Usuario");
    res.sendStatus(204);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/* ============================================================
   CRUD DIRECCION
============================================================ */
app.get("/direcciones", async (req, res) => {
  try {
    const result = await getConnection().request().query("SELECT * FROM Direccion");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/direcciones", async (req, res) => {
  const { Calle, Ciudad, Municipio, Departamento, Zona, Avenida, NumeroCasa, Latitud, Longitud } = req.body;
  try {
    const result = await getConnection()
      .request()
      .input("Calle", Calle)
      .input("Ciudad", Ciudad)
      .input("Municipio", Municipio)
      .input("Departamento", Departamento)
      .input("Zona", Zona || null)
      .input("Avenida", Avenida || null)
      .input("NumeroCasa", NumeroCasa || null)
      .input("Latitud", Latitud || null)
      .input("Longitud", Longitud || null)
      .query(`
        INSERT INTO Direccion (Calle, Ciudad, Municipio, Departamento, Zona, Avenida, NumeroCasa, Latitud, Longitud)
        OUTPUT INSERTED.ID_Direccion
        VALUES (@Calle, @Ciudad, @Municipio, @Departamento, @Zona, @Avenida, @NumeroCasa, @Latitud, @Longitud)
      `);
    res.status(201).json({ ID_Direccion: result.recordset[0].ID_Direccion });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.put("/direcciones/:id", async (req, res) => {
  const { id } = req.params;
  const { Calle, Ciudad, Municipio, Departamento, Zona, Avenida, NumeroCasa, Latitud, Longitud } = req.body;
  try {
    await getConnection()
      .request()
      .input("ID_Direccion", id)
      .input("Calle", Calle)
      .input("Ciudad", Ciudad)
      .input("Municipio", Municipio)
      .input("Departamento", Departamento)
      .input("Zona", Zona || null)
      .input("Avenida", Avenida || null)
      .input("NumeroCasa", NumeroCasa || null)
      .input("Latitud", Latitud || null)
      .input("Longitud", Longitud || null)
      .query(`
        UPDATE Direccion
        SET Calle=@Calle, Ciudad=@Ciudad, Municipio=@Municipio, Departamento=@Departamento,
            Zona=@Zona, Avenida=@Avenida, NumeroCasa=@NumeroCasa,
            Latitud=@Latitud, Longitud=@Longitud
        WHERE ID_Direccion = @ID_Direccion
      `);
    res.send("✅ Dirección actualizada correctamente");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.delete("/direcciones/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await getConnection()
      .request()
      .input("ID_Direccion", id)
      .query("DELETE FROM Direccion WHERE ID_Direccion = @ID_Direccion");
    res.sendStatus(204);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/* ============================================================
   CRUD EMBARAZADA
   POST /embarazadas — inserta dirección y embarazada en una
   transacción dentro del backend
============================================================ */
app.get("/embarazadas", async (req, res) => {
  try {
    const result = await getConnection().request().query("SELECT * FROM Embarazada");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/embarazadas-con-direccion", async (req, res) => {
  try {
    const result = await getConnection().request().query(`
      SELECT e.ID_Embarazada, e.Nombre, e.Edad, d.Latitud, d.Longitud, d.Municipio, r.Nivel
      FROM Embarazada e
      INNER JOIN Direccion d ON e.ID_Direccion = d.ID_Direccion
      INNER JOIN Riesgo r ON e.ID_Embarazada = r.ID_Embarazada
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("⚠ Error: " + err.message);
  }
});

app.get("/embarazadas/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await getConnection()
      .request()
      .input("ID", id)
      .query("SELECT * FROM Embarazada WHERE ID_Embarazada = @ID");

    if (result.recordset.length === 0) {
      return res.status(404).send("⚠ Embarazada no encontrada");
    }
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).send("⚠ Error: " + err.message);
  }
});

app.post("/embarazadas", async (req, res) => {
  const {
    Nombre, Edad, Telefono, DPI, NumSemanas,
    Calle, Ciudad, Municipio, Departamento, Zona, Avenida, NumeroCasa,
    Latitud, Longitud,
  } = req.body;

  const pool = getConnection();
  const transaction = pool.transaction();

  try {
    await transaction.begin();

    // 1. Insertar dirección y obtener su ID
    const dirResult = await transaction
      .request()
      .input("Calle", Calle)
      .input("Ciudad", Ciudad)
      .input("Municipio", Municipio)
      .input("Departamento", Departamento)
      .input("Zona", Zona || null)
      .input("Avenida", Avenida || null)
      .input("NumeroCasa", NumeroCasa || null)
      .input("Latitud", Latitud || null)
      .input("Longitud", Longitud || null)
      .query(`
        INSERT INTO Direccion (Calle, Ciudad, Municipio, Departamento, Zona, Avenida, NumeroCasa, Latitud, Longitud)
        OUTPUT INSERTED.ID_Direccion
        VALUES (@Calle, @Ciudad, @Municipio, @Departamento, @Zona, @Avenida, @NumeroCasa, @Latitud, @Longitud)
      `);

    const ID_Direccion = dirResult.recordset[0].ID_Direccion;

    // 2. Insertar embarazada vinculada a esa dirección
    const embResult = await transaction
      .request()
      .input("Nombre", Nombre)
      .input("Edad", Edad)
      .input("Telefono", Telefono || null)
      .input("ID_Direccion", ID_Direccion)
      .input("DPI", DPI)
      .input("NumSemanas", NumSemanas)
      .query(`
        INSERT INTO Embarazada (Nombre, Edad, Telefono, ID_Direccion, DPI, NumSemanas)
        OUTPUT INSERTED.ID_Embarazada
        VALUES (@Nombre, @Edad, @Telefono, @ID_Direccion, @DPI, @NumSemanas)
      `);

    const ID_Embarazada = embResult.recordset[0].ID_Embarazada;

    await transaction.commit();

    res.status(201).json({
      message: "✅ Embarazada y dirección registradas correctamente",
      data: { ID_Embarazada, ID_Direccion },
    });
  } catch (err) {
    await transaction.rollback();
    console.error("⚠ Error al registrar embarazada:", err);
    res.status(500).send("⚠ Error al registrar embarazada: " + err.message);
  }
});

app.put("/embarazadas/:id", async (req, res) => {
  const { id } = req.params;
  const { Nombre, Edad, ID_Direccion } = req.body;
  try {
    await getConnection()
      .request()
      .input("ID", id)
      .input("Nombre", Nombre)
      .input("Edad", Edad)
      .input("ID_Direccion", ID_Direccion)
      .query(`
        UPDATE Embarazada
        SET Nombre=@Nombre, Edad=@Edad, ID_Direccion=@ID_Direccion
        WHERE ID_Embarazada = @ID
      `);
    res.send("✅ Embarazada actualizada correctamente");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Eliminar embarazada + todas sus relaciones
app.delete("/embarazadas/:id", async (req, res) => {
  const { id } = req.params;
  const pool = getConnection();
  const transaction = pool.transaction();

  try {
    await transaction.begin();

    await transaction.request().input("ID", id)
      .query("DELETE FROM Ubicacion WHERE ID_Embarazada = @ID");

    await transaction.request().input("ID", id)
      .query("DELETE FROM Riesgo WHERE ID_Embarazada = @ID");

    await transaction.request().input("ID", id)
      .query("DELETE FROM Seguimiento WHERE ID_Embarazada = @ID");

    await transaction.request().input("ID", id)
      .query("DELETE FROM Embarazada WHERE ID_Embarazada = @ID");

    await transaction.commit();
    res.send("🗑️ Embarazada y registros relacionados eliminados correctamente");
  } catch (err) {
    await transaction.rollback();
    res.status(500).send("⚠ Error al eliminar: " + err.message);
  }
});

/* ============================================================
   CRUD SEGUIMIENTO
============================================================ */
app.get("/seguimientos", async (req, res) => {
  try {
    const result = await getConnection().request().query("SELECT * FROM Seguimiento");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/seguimientos", async (req, res) => {
  const { ID_Embarazada, ID_Usuario, Fecha_Seguimiento, Observaciones, Signos_Alarma } = req.body;
  try {
    const pool = getConnection();

    // Verificar que no exista ya un seguimiento para esta embarazada
    const duplicado = await pool
      .request()
      .input("ID", ID_Embarazada)
      .query("SELECT 1 FROM Seguimiento WHERE ID_Embarazada = @ID");

    if (duplicado.recordset.length > 0) {
      return res.status(409).send("⚠ Esta embarazada ya tiene un seguimiento registrado. Solo se permite uno por embarazada.");
    }

    await pool
      .request()
      .input("ID_Embarazada", ID_Embarazada)
      .input("ID_Usuario", ID_Usuario)
      .input("Fecha_Seguimiento", Fecha_Seguimiento)
      .input("Observaciones", Observaciones)
      .input("Signos_Alarma", Signos_Alarma)
      .query(`
        INSERT INTO Seguimiento (ID_Embarazada, ID_Usuario, Fecha_Seguimiento, Observaciones, Signos_Alarma)
        VALUES (@ID_Embarazada, @ID_Usuario, @Fecha_Seguimiento, @Observaciones, @Signos_Alarma)
      `);
    res.status(201).send("✅ Seguimiento registrado correctamente");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.put("/seguimientos/:id", async (req, res) => {
  const { id } = req.params;
  const { ID_Embarazada, ID_Usuario, Fecha_Seguimiento, Observaciones, Signos_Alarma } = req.body;
  try {
    await getConnection()
      .request()
      .input("ID_Seguimiento", id)
      .input("ID_Embarazada", ID_Embarazada)
      .input("ID_Usuario", ID_Usuario)
      .input("Fecha_Seguimiento", Fecha_Seguimiento)
      .input("Observaciones", Observaciones)
      .input("Signos_Alarma", Signos_Alarma)
      .query(`
        UPDATE Seguimiento
        SET ID_Embarazada=@ID_Embarazada, ID_Usuario=@ID_Usuario,
            Fecha_Seguimiento=@Fecha_Seguimiento, Observaciones=@Observaciones,
            Signos_Alarma=@Signos_Alarma
        WHERE ID_Seguimiento = @ID_Seguimiento
      `);
    res.send("✅ Seguimiento actualizado correctamente");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.delete("/seguimientos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await getConnection()
      .request()
      .input("ID_Seguimiento", id)
      .query("DELETE FROM Seguimiento WHERE ID_Seguimiento = @ID_Seguimiento");
    res.sendStatus(204);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/* ============================================================
   CRUD UBICACION
============================================================ */
app.get("/ubicaciones", async (req, res) => {
  try {
    const result = await getConnection().request().query(`
      SELECT u.ID_Ubicacion,
             u.ID_Embarazada,
             e.Nombre AS NombreEmbarazada,
             e.Edad,
             u.ID_Direccion,
             d.Calle, d.Ciudad, d.Departamento,
             u.Fecha_Registro
      FROM Ubicacion u
      INNER JOIN Embarazada e ON u.ID_Embarazada = e.ID_Embarazada
      INNER JOIN Direccion d ON u.ID_Direccion = d.ID_Direccion
      ORDER BY u.ID_Ubicacion
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/ubicaciones", async (req, res) => {
  const { ID_Embarazada, ID_Direccion } = req.body;
  try {
    await getConnection()
      .request()
      .input("ID_Embarazada", ID_Embarazada)
      .input("ID_Direccion", ID_Direccion)
      .query(`
        INSERT INTO Ubicacion (ID_Embarazada, ID_Direccion)
        VALUES (@ID_Embarazada, @ID_Direccion)
      `);
    res.status(201).send("✅ Ubicación registrada correctamente");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.put("/ubicaciones/:id", async (req, res) => {
  const { id } = req.params;
  const { ID_Embarazada, ID_Direccion } = req.body;
  try {
    await getConnection()
      .request()
      .input("ID_Ubicacion", id)
      .input("ID_Embarazada", ID_Embarazada)
      .input("ID_Direccion", ID_Direccion)
      .query(`
        UPDATE Ubicacion
        SET ID_Embarazada=@ID_Embarazada, ID_Direccion=@ID_Direccion
        WHERE ID_Ubicacion = @ID_Ubicacion
      `);
    res.send("✅ Ubicación actualizada correctamente");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.delete("/ubicaciones/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await getConnection()
      .request()
      .input("ID_Ubicacion", id)
      .query("DELETE FROM Ubicacion WHERE ID_Ubicacion = @ID_Ubicacion");
    res.sendStatus(204);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/* ============================================================
   CRUD RIESGO
============================================================ */
app.get("/riesgos", async (req, res) => {
  try {
    const result = await getConnection().request().query(`
      SELECT r.ID_Riesgo, r.ID_Embarazada, e.Nombre AS NombreEmbarazada,
             r.Fecha_Riesgo, r.Nivel
      FROM Riesgo r
      INNER JOIN Embarazada e ON r.ID_Embarazada = e.ID_Embarazada
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/riesgos", async (req, res) => {
  const { ID_Embarazada, Fecha_Riesgo, Nivel } = req.body;
  try {
    const pool = getConnection();

    // Verificar que la embarazada exista
    const check = await pool
      .request()
      .input("ID", ID_Embarazada)
      .query("SELECT 1 FROM Embarazada WHERE ID_Embarazada = @ID");

    if (check.recordset.length === 0) {
      return res.status(400).send("⚠ Error: La embarazada no existe");
    }

    // Verificar que no exista ya un riesgo para esta embarazada
    const duplicado = await pool
      .request()
      .input("ID", ID_Embarazada)
      .query("SELECT 1 FROM Riesgo WHERE ID_Embarazada = @ID");

    if (duplicado.recordset.length > 0) {
      return res.status(409).send("⚠ Esta embarazada ya tiene un riesgo registrado. Solo se permite uno por embarazada.");
    }

    await pool
      .request()
      .input("ID_Embarazada", ID_Embarazada)
      .input("Fecha_Riesgo", Fecha_Riesgo)
      .input("Nivel", Nivel)
      .query(`
        INSERT INTO Riesgo (ID_Embarazada, Fecha_Riesgo, Nivel)
        VALUES (@ID_Embarazada, @Fecha_Riesgo, @Nivel)
      `);

    res.status(201).send("✅ Riesgo registrado correctamente");
  } catch (err) {
    res.status(500).send("⚠ Error: " + err.message);
  }
});

app.put("/riesgos/:id", async (req, res) => {
  const { id } = req.params;
  const { Fecha_Riesgo, Nivel } = req.body;
  try {
    await getConnection()
      .request()
      .input("ID_Riesgo", id)
      .input("Fecha_Riesgo", Fecha_Riesgo)
      .input("Nivel", Nivel)
      .query(`
        UPDATE Riesgo
        SET Fecha_Riesgo=@Fecha_Riesgo, Nivel=@Nivel
        WHERE ID_Riesgo = @ID_Riesgo
      `);
    res.send("✅ Riesgo actualizado correctamente");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.delete("/riesgos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await getConnection()
      .request()
      .input("ID_Riesgo", id)
      .query("DELETE FROM Riesgo WHERE ID_Riesgo = @ID_Riesgo");
    res.sendStatus(204);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/* ============================================================
   INICIAR SERVIDOR
   - Local (node index.js) y Render: arranca un servidor normal.
   - Vercel: NO ejecuta este bloque (Vercel importa "app" como
     función serverless y nunca lo corre como script principal),
     así que simplemente exportamos "app" al final.
============================================================ */
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;