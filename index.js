// index.js
const express = require("express");
const cors = require("cors");
const { connectDB, getConnection } = require("./db");
const cookieParser = require("cookie-parser");

const app = express();

const PORT = process.env.PORT || 3001;

// Middlewares globales
app.use(express.json());
app.use(cookieParser());

// La configuración de CORS
app.use(
  cors({ origin: (origin, callback) => {
      if (!origin) return callback(null, true); // permite peticiones internas
      if (
        origin.endsWith(".ngrok-free.app") ||
        origin.includes("onrender.com") ||
        origin.includes("mapeo-frontend.vercel.app")
      ) {
        callback(null, true);
      } else {
        callback(new Error("No permitido por CORS"));
      }
    },
    credentials: true,
  })
);

// 🔹 Rutas de prueba
app.get("/", (req, res) => {
  res.send("✅ Backend funcionando correctamente en ocean, te kero 🚀");
});
  // 🔹 Verificar si hay sesión activa
  app.get("/check-session", async (req, res) => {
    console.log("Cookies en /check-session:", req.cookies);
    const token = req.cookies?.token;

    if (!token) {
      return res.json({ loggedIn: false });
    }

    try {
      const result = await getConnection()
        .request()
        .input("ID_Usuario", token)
        .query("SELECT ID_Usuario, Nombre, Rol FROM Usuario WHERE ID_Usuario = @ID_Usuario");

      if (result.recordset.length === 0) {
        return res.json({ loggedIn: false });
      }

      const user = result.recordset[0];
      res.json({ loggedIn: true, user });
    } catch (err) {
      console.error("⚠ Error en /check-session:", err.message);
      res.status(500).json({ loggedIn: false });
    }
  });

 
  // LOGIN USUARIO
  app.post("/login", async (req, res) => {
    const { Nombre, Contraseña } = req.body;
    console.log("🔑 Intento login:", Nombre);

    try {
      const result = await getConnection()
        .request()
        .input("Nombre", Nombre)
        .input("Contraseña", Contraseña).query(`
          SELECT ID_Usuario, Nombre, Rol 
          FROM Usuario 
          WHERE Nombre=@Nombre AND Contraseña=@Contraseña
        `);

      if (result.recordset.length === 0) {
        return res
          .status(401)
          .json({ error: "⚠ Usuario o contraseña incorrectos" });
      }

      const user = result.recordset[0];

      // Configuración de la cookie (DEV: sameSite 'lax' y secure false)
      res.cookie("token", String(user.ID_Usuario), {
        httpOnly: true,
        maxAge: 3600000,
        sameSite: "None",
        secure: true,
        path: "/",
      });


      res.json({ message: "✅ Login exitoso", user });
    } catch (err) {
      console.error("⚠ Error en login:", err.message);
      res.status(500).send("⚠ Error en login: " + err.message);
    }
  });

  // LOGOUT USUARIO
  app.post("/logout", (req, res) => {
    console.log("Cerrar sesión - cookies antes:", req.cookies);
    res.clearCookie("token", {
      httpOnly: true,
      sameSite: "None",
      secure: true,
      path: "/",
    });
    res.json({ message: "Sesión cerrada correctamente" });
  });

  /* ============================================================
     CRUD USUARIO
  ============================================================ */
    app.get("/usuarios", async (req, res) => {
      try {
        const result = await getConnection()
          .request()
          .query("SELECT * FROM Usuario");
        res.json(result.recordset);
      } catch (err) {
        res.status(500).send(err.message);
      }
    });

    app.post("/usuarios", async (req, res) => {
      const { Nombre, Contraseña, DPI, TELEFONO, Salt, Rol, CorreoElectronico } = req.body;
      try {
        const conn = await getConnection();
        const existing = await conn.request()
          .input("TELEFONO", TELEFONO)
          .query("SELECT COUNT(*) as count FROM Usuario WHERE TELEFONO = @TELEFONO");
        if (existing.recordset[0].count > 0) {
          return res.status(400).send("⚠ Algún dato único ya está registrado (Nombre, Correo, DPI o Teléfono).");
        }
        await conn.request()
          .input("Nombre", Nombre)
          .input("Contraseña", Contraseña)
          .input("DPI", DPI)
          .input("TELEFONO", TELEFONO)
          .input("Salt", Salt)
          .input("Rol", Rol)
          .input("CorreoElectronico", CorreoElectronico)
          .query(`
            INSERT INTO Usuario (Nombre, Contraseña, DPI, TELEFONO, Salt, Rol, CorreoElectronico)
            VALUES (@Nombre, @Contraseña, @DPI, @TELEFONO, @Salt, @Rol, @CorreoElectronico)
          `);

        res.status(201).send("Usuario creado correctamente");
      } catch (err) {
        res.status(500).send(err.message);
      }
    });


    app.put("/usuarios/:id", async (req, res) => {
      const { id } = req.params;
      const { Nombre, Contraseña, DPI, TELEFONO, Salt, Rol, CorreoElectronico } = req.body; // ✅ incluir
      try {
        await getConnection()
          .request()
          .input("ID_Usuario", id)
          .input("Nombre", Nombre)
          .input("Contraseña", Contraseña)
          .input("DPI", DPI)
          .input("TELEFONO", TELEFONO)
          .input("Salt", Salt)
          .input("Rol", Rol)
          .input("CorreoElectronico", CorreoElectronico)
          .query(`
            UPDATE Usuario
            SET Nombre=@Nombre, Contraseña=@Contraseña, DPI=@DPI, TELEFONO=@TELEFONO, Salt=@Salt, Rol=@Rol, CorreoElectronico=@CorreoElectronico
            WHERE ID_Usuario=@ID_Usuario
          `);
        res.send("Usuario actualizado correctamente");
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

        res.send("Usuario eliminado correctamente");
      } catch (err) {
        res.status(500).send(err.message);
      }
    });

    /* ============================================================
      CRUD DIRECCION
    ============================================================ */
    app.get("/direcciones", async (req, res) => {
      try {
        const result = await getConnection()
          .request()
          .query("SELECT * FROM Direccion");
        res.json(result.recordset);
      } catch (err) {
        res.status(500).send(err.message);
      }
    });

    app.post("/direcciones", async (req, res) => {
      const { Calle, Ciudad, Departamento, Latitud, Longitud, Zona, Avenida, NumeroCasa, Municipio } = req.body;

      try {
        const result = await getConnection()
          .request()
          .input("Calle", Calle)
          .input("Ciudad", Ciudad)
          .input("Departamento", Departamento)
          .input("Latitud", Latitud)
          .input("Longitud", Longitud)
          .input("Zona", Zona || null)
          .input("Avenida", Avenida || null)
          .input("NumeroCasa", NumeroCasa)
          .input("Municipio", Municipio)
          .query(`
            INSERT INTO Direccion (Calle, Ciudad, Departamento, Latitud, Longitud, Zona, Avenida, NumeroCasa, Municipio)
            OUTPUT INSERTED.ID_Direccion 
            VALUES (@Calle, @Ciudad, @Departamento, @Latitud, @Longitud, @Zona, @Avenida, @NumeroCasa, @Municipio)
          `);

        res.status(201).json({ ID_Direccion: result.recordset[0].ID_Direccion });
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

  // ====== REGISTRAR EMBARAZADA CON TRANSACCIÓN ======
  app.post("/embarazadas", async (req, res) => {
    const {
      Nombre,
      DPI,
      Edad,
      Telefono,
      Calle,
      Ciudad,
      Municipio,
      Departamento,
      Zona,
      Avenida,
      NumeroCasa,
      Latitud,
      Longitud,
    } = req.body;

    // ====== VALIDACIONES BACKEND ======
    
    // 1. Validar campos obligatorios
    if (!Nombre || !DPI || !Edad || !Telefono || !Calle || !Ciudad || 
        !Municipio || !Departamento || !NumeroCasa) {
      return res.status(400).json({ 
        error: "⚠ Todos los campos obligatorios deben estar completos" 
      });
    }

    // 2. Validar DPI (13 dígitos)
    if (!/^\d{13}$/.test(DPI)) {
      return res.status(400).json({ 
        error: "⚠ El DPI debe tener exactamente 13 dígitos numéricos" 
      });
    }

    // 3. Validar Teléfono (8 dígitos)
    if (!/^\d{8}$/.test(Telefono)) {
      return res.status(400).json({ 
        error: "⚠ El teléfono debe tener exactamente 8 dígitos numéricos" 
      });
    }

    // 4. Validar Número de Casa (solo números)
    if (!/^\d+$/.test(NumeroCasa)) {
      return res.status(400).json({ 
        error: "⚠ El número de casa debe contener solo números" 
      });
    }

    // 5. Validar Edad
    if (Edad <= 0 || Edad > 120) {
      return res.status(400).json({ 
        error: "⚠ La edad debe ser un número válido entre 1 y 120" 
      });
    }

    try {
      const pool = getConnection();
      const transaction = pool.transaction();

      await transaction.begin();

      try {
        // ====== VERIFICAR DUPLICADOS ======
        
        // 1. Verificar DPI duplicado
        const checkDPI = await transaction
          .request()
          .input("DPI", DPI)
          .query("SELECT 1 FROM Embarazada WHERE DPI = @DPI");

        if (checkDPI.recordset.length > 0) {
          await transaction.rollback();
          return res.status(409).json({ 
            error: "⚠ Ya existe una embarazada registrada con ese DPI" 
          });
        }

        // 2. Verificar Teléfono duplicado
        const checkTelefono = await transaction
          .request()
          .input("Telefono", Telefono)
          .query("SELECT 1 FROM Embarazada WHERE Telefono = @Telefono");

        if (checkTelefono.recordset.length > 0) {
          await transaction.rollback();
          return res.status(409).json({ 
            error: "⚠ Ya existe una embarazada registrada con ese teléfono" 
          });
        }

        // 3. Verificar dirección duplicada (Nombre + NumeroCasa en mismo municipio)
        const checkDireccion = await transaction
          .request()
          .input("Nombre", Nombre)
          .input("NumeroCasa", NumeroCasa)
          .input("Municipio", Municipio)
          .query(`
            SELECT 1 FROM Embarazada e
            INNER JOIN Direccion d ON e.ID_Direccion = d.ID_Direccion
            WHERE e.Nombre = @Nombre 
              AND d.NumeroCasa = @NumeroCasa
              AND d.Municipio = @Municipio
          `);

        if (checkDireccion.recordset.length > 0) {
          await transaction.rollback();
          return res.status(409).json({ 
            error: "⚠ Ya existe una embarazada con ese nombre y número de casa en este municipio" 
          });
        }

        // ====== INSERTAR DIRECCIÓN ======
        const direccionResult = await transaction
          .request()
          .input("Calle", Calle)
          .input("Ciudad", Ciudad)
          .input("Municipio", Municipio)
          .input("Departamento", Departamento)
          .input("Zona", Zona || null)
          .input("Avenida", Avenida || null)
          .input("NumeroCasa", NumeroCasa)
          .input("Latitud", Latitud || null)
          .input("Longitud", Longitud || null)
          .query(`
            INSERT INTO Direccion (Calle, Ciudad, Municipio, Departamento, Zona, Avenida, NumeroCasa, Latitud, Longitud)
            OUTPUT INSERTED.ID_Direccion
            VALUES (@Calle, @Ciudad, @Municipio, @Departamento, @Zona, @Avenida, @NumeroCasa, @Latitud, @Longitud)
          `);

        const idDireccion = direccionResult.recordset[0].ID_Direccion;

        // ====== INSERTAR EMBARAZADA ======
        const embarazadaResult = await transaction
          .request()
          .input("Nombre", Nombre)
          .input("DPI", DPI)
          .input("Edad", Edad)
          .input("Telefono", Telefono)
          .input("ID_Direccion", idDireccion)
          .query(`
            INSERT INTO Embarazada (Nombre, DPI, Edad, Telefono, ID_Direccion)
            OUTPUT INSERTED.ID_Embarazada
            VALUES (@Nombre, @DPI, @Edad, @Telefono, @ID_Direccion)
          `);

        // Confirmar transacción
        await transaction.commit();

        res.status(201).json({ 
          message: "✅ Embarazada registrada correctamente",
          data: {
            ID_Embarazada: embarazadaResult.recordset[0].ID_Embarazada,
            ID_Direccion: idDireccion
          }
        });

      } catch (err) {
        // Si hay error, deshacer todo
        await transaction.rollback();
        throw err;
      }

    } catch (err) {
      console.error("⚠ Error al registrar embarazada:", err);
      res.status(500).json({ 
        error: "⚠ Error interno del servidor: " + err.message 
      });
    }
  });


  // ====== ACTUALIZAR EMBARAZADA ======
  app.put("/embarazadas/:id", async (req, res) => {
    const { id } = req.params;
    const { Nombre, DPI, Edad, Telefono, ID_Direccion } = req.body;

    // Validaciones
    if (DPI && !/^\d{13}$/.test(DPI)) {
      return res.status(400).json({ 
        error: "⚠ El DPI debe tener exactamente 13 dígitos numéricos" 
      });
    }

    if (Telefono && !/^\d{8}$/.test(Telefono)) {
      return res.status(400).json({ 
        error: "⚠ El teléfono debe tener exactamente 8 dígitos numéricos" 
      });
    }

    try {
      const pool = getConnection();

      // Verificar duplicados (excluyendo el registro actual)
      if (DPI) {
        const checkDPI = await pool
          .request()
          .input("DPI", DPI)
          .input("ID", id)
          .query("SELECT 1 FROM Embarazada WHERE DPI = @DPI AND ID_Embarazada != @ID");

        if (checkDPI.recordset.length > 0) {
          return res.status(409).json({ 
            error: "⚠ Ya existe otra embarazada con ese DPI" 
          });
        }
      }

      if (Telefono) {
        const checkTelefono = await pool
          .request()
          .input("Telefono", Telefono)
          .input("ID", id)
          .query("SELECT 1 FROM Embarazada WHERE Telefono = @Telefono AND ID_Embarazada != @ID");

        if (checkTelefono.recordset.length > 0) {
          return res.status(409).json({ 
            error: "⚠ Ya existe otra embarazada con ese teléfono" 
          });
        }
      }

      // Actualizar
      await pool
        .request()
        .input("ID", id)
        .input("Nombre", Nombre)
        .input("DPI", DPI)
        .input("Edad", Edad)
        .input("Telefono", Telefono)
        .input("ID_Direccion", ID_Direccion)
        .query(`
          UPDATE Embarazada
          SET Nombre=@Nombre, DPI=@DPI, Edad=@Edad, Telefono=@Telefono, ID_Direccion=@ID_Direccion
          WHERE ID_Embarazada=@ID
        `);

      res.json({ message: "✅ Embarazada actualizada correctamente" });
    } catch (err) {
      console.error("Error al actualizar:", err);
      res.status(500).json({ error: "⚠ Error al actualizar: " + err.message });
    }
  });


  // ====== ELIMINAR EMBARAZADA + RELACIONES CON TRANSACCIÓN ======
  app.delete("/embarazadas/:id", async (req, res) => {
    const { id } = req.params;
    
    try {
      const pool = getConnection();
      const transaction = pool.transaction();

      await transaction.begin();

      try {
        // Obtener ID_Direccion antes de eliminar
        const getDireccion = await transaction
          .request()
          .input("ID", id)
          .query("SELECT ID_Direccion FROM Embarazada WHERE ID_Embarazada = @ID");

        const idDireccion = getDireccion.recordset[0]?.ID_Direccion;

        // 1. Eliminar de Riesgo
        await transaction
          .request()
          .input("ID", id)
          .query("DELETE FROM Riesgo WHERE ID_Embarazada = @ID");

        // 2. Eliminar de Seguimiento
        await transaction
          .request()
          .input("ID", id)
          .query("DELETE FROM Seguimiento WHERE ID_Embarazada = @ID");

        // 3. Eliminar a la embarazada
        await transaction
          .request()
          .input("ID", id)
          .query("DELETE FROM Embarazada WHERE ID_Embarazada = @ID");

        // 4. Eliminar dirección asociada (opcional)
        if (idDireccion) {
          await transaction
            .request()
            .input("ID_Direccion", idDireccion)
            .query("DELETE FROM Direccion WHERE ID_Direccion = @ID_Direccion");
        }

        await transaction.commit();

        res.json({ 
          message: "🗑️ Embarazada y todos sus registros relacionados eliminados correctamente" 
        });

      } catch (err) {
        await transaction.rollback();
        throw err;
      }

    } catch (err) {
      console.error("Error al eliminar:", err);
      res.status(500).json({ error: "⚠ Error al eliminar: " + err.message });
    }
  });


  /* ============================================================
     CRUD RIESGO
  ============================================================ */
    app.get("/riesgos", async (req, res) => {
      try {
        const result = await getConnection().request().query(`
        SELECT r.ID_Riesgo, r.ID_Embarazada, e.Nombre AS NombreEmbarazada, r.Fecha_Riesgo, r.Nivel
        FROM Riesgo r
        INNER JOIN Embarazada e ON r.ID_Embarazada = e.ID_Embarazada
      `);
        res.json(result.recordset);
      } catch (err) {
        res.status(500).send(err.message);
      }
    });

    // Obtener conteo de riesgos por nivel
    app.get("/reportes/riesgos", async (req, res) => {
      try {
        const result = await getConnection()
          .request()
          .query(`
            SELECT Nivel, COUNT(*) AS Cantidad
            FROM Riesgo
            GROUP BY Nivel
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
          .query("SELECT 1 FROM Embarazada WHERE ID_Embarazada=@ID");

        if (check.recordset.length === 0) {
          return res.status(400).send("⚠ Error: La embarazada no existe");
        }

        // Insertar riesgo
        await pool
          .request()
          .input("ID_Embarazada", ID_Embarazada)
          .input("Fecha_Riesgo", Fecha_Riesgo)
          .input("Nivel", Nivel)
          .query(
            "INSERT INTO Riesgo (ID_Embarazada, Fecha_Riesgo, Nivel) VALUES (@ID_Embarazada, @Fecha_Riesgo, @Nivel)"
          );

        res.status(201).send("✅ Riesgo registrado correctamente");
      } catch (err) {
        res.status(500).send("⚠ Error: " + err.message);
      }
    });

    app.put("/riesgos/:id", async (req, res) => {
    const { id } = req.params;
    const { ID_Embarazada, Fecha_Riesgo, Nivel } = req.body;

    try {
      const result = await getConnection()
        .request()
        .input("ID_Riesgo", id)
        .input("ID_Embarazada", ID_Embarazada)
        .input("Fecha_Riesgo", Fecha_Riesgo)
        .input("Nivel", Nivel)
        .query(`
          UPDATE Riesgo
          SET ID_Embarazada = @ID_Embarazada,
              Fecha_Riesgo = @Fecha_Riesgo,
              Nivel = @Nivel
          WHERE ID_Riesgo = @ID_Riesgo
        `);

      if (result.rowsAffected[0] === 0)
        return res.status(404).send("❌ Riesgo no encontrado");

      res.send("✅ Riesgo actualizado correctamente");
    } catch (err) {
      res.status(500).send(err.message);
    }
  });



  /* ============================================================
     INICIAR SERVIDOR
  ============================================================ */
  async function startServer() {
  try {
    await connectDB(); // Conectar a la BD solo UNA vez
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Error al iniciar servidor:", err);
    process.exit(1);
  }
}


startServer();
