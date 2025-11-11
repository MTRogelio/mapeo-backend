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
        CRUD SEGUIMIENTO
      ============================================================ */
      app.get("/seguimientos", async (req, res) => {
        try {
          const result = await getConnection()
            .request()
            .query("SELECT * FROM Seguimiento");
          res.json(result.recordset);
        } catch (err) {
          res.status(500).send(err.message);
        }
      });

      app.post("/seguimientos", async (req, res) => {
        const {
          ID_Embarazada,
          ID_Usuario,
          Fecha_Seguimiento,
          Observaciones,
          Signos_Alarma,
        } = req.body;
        try {
          await getConnection()
            .request()
            .input("ID_Embarazada", ID_Embarazada)
            .input("ID_Usuario", ID_Usuario)
            .input("Fecha_Seguimiento", Fecha_Seguimiento)
            .input("Observaciones", Observaciones)
            .input("Signos_Alarma", Signos_Alarma)
            .query(`INSERT INTO Seguimiento (ID_Embarazada, ID_Usuario, Fecha_Seguimiento, Observaciones, Signos_Alarma)
                    VALUES (@ID_Embarazada, @ID_Usuario, @Fecha_Seguimiento, @Observaciones, @Signos_Alarma)`);
          res.status(201).send("✅ Seguimiento registrado correctamente");
        } catch (err) {
          res.status(500).send(err.message);
        }
      });

      // ACTUALIZAR SEGUIMIENTO
      app.put("/seguimientos/:id", async (req, res) => {
        const { id } = req.params;
        const { ID_Embarazada, ID_Usuario, Fecha_Seguimiento, Observaciones, Signos_Alarma } = req.body;

        try {
          const result = await getConnection()
            .request()
            .input("ID_Seguimiento", id)
            .input("ID_Embarazada", ID_Embarazada)
            .input("ID_Usuario", ID_Usuario)
            .input("Fecha_Seguimiento", Fecha_Seguimiento)
            .input("Observaciones", Observaciones)
            .input("Signos_Alarma", Signos_Alarma)
            .query(`
              UPDATE Seguimiento
              SET ID_Embarazada = @ID_Embarazada,
                  ID_Usuario = @ID_Usuario,
                  Fecha_Seguimiento = @Fecha_Seguimiento,
                  Observaciones = @Observaciones,
                  Signos_Alarma = @Signos_Alarma
              WHERE ID_Seguimiento = @ID_Seguimiento
            `);
          
          if (result.rowsAffected[0] === 0) {
            return res.status(404).send("Seguimiento no encontrado");
          }

          res.send("✅ Seguimiento actualizado correctamente");
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
