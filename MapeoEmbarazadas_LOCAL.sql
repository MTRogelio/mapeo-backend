-- ============================================================
--  MapeoEmbarazadas - Script de creación LOCAL para SSMS
--  Ejecuta este script en SQL Server Management Studio
--  conectado a tu instancia local (localhost o .\SQLEXPRESS)
-- ============================================================

USE master;
GO

-- Crear la base de datos si no existe
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'MapeoEmbarazadas')
BEGIN
    CREATE DATABASE MapeoEmbarazadas;
    PRINT '✅ Base de datos MapeoEmbarazadas creada.';
END
ELSE
    PRINT '⚠ La base de datos ya existía.';
GO

USE MapeoEmbarazadas;
GO

-- ============================================================
--  TABLA: Usuario
-- ============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Usuario' AND xtype='U')
BEGIN
    CREATE TABLE Usuario (
        ID_Usuario  INT IDENTITY(1,1) PRIMARY KEY,
        Nombre      NVARCHAR(100) NOT NULL,
        Contraseña  NVARCHAR(255) NOT NULL,
        DPI         NVARCHAR(20)  NULL,
        TELEFONO    NVARCHAR(15)  NULL,
        Salt        NVARCHAR(255) NULL,
        Rol         NVARCHAR(50)  NOT NULL DEFAULT 'usuario'
    );
    PRINT '✅ Tabla Usuario creada.';
END
GO

-- ============================================================
--  TABLA: Direccion
-- ============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Direccion' AND xtype='U')
BEGIN
    CREATE TABLE Direccion (
        ID_Direccion  INT IDENTITY(1,1) PRIMARY KEY,
        Calle         NVARCHAR(200) NULL,
        Ciudad        NVARCHAR(100) NULL,
        Departamento  NVARCHAR(100) NULL,
        Latitud       FLOAT         NULL,
        Longitud      FLOAT         NULL
    );
    PRINT '✅ Tabla Direccion creada.';
END
GO

-- ============================================================
--  TABLA: Embarazada
-- ============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Embarazada' AND xtype='U')
BEGIN
    CREATE TABLE Embarazada (
        ID_Embarazada  INT IDENTITY(1,1) PRIMARY KEY,
        Nombre         NVARCHAR(150) NOT NULL,
        Edad           INT           NULL,
        Telefono       NVARCHAR(15)  NULL,
        ID_Direccion   INT           NULL,
        CONSTRAINT FK_Embarazada_Direccion
            FOREIGN KEY (ID_Direccion) REFERENCES Direccion(ID_Direccion)
    );
    PRINT '✅ Tabla Embarazada creada.';
END
GO

-- ============================================================
--  TABLA: Riesgo
-- ============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Riesgo' AND xtype='U')
BEGIN
    CREATE TABLE Riesgo (
        ID_Riesgo      INT IDENTITY(1,1) PRIMARY KEY,
        ID_Embarazada  INT           NOT NULL,
        Fecha_Riesgo   DATE          NULL,
        Nivel          NVARCHAR(50)  NULL,   -- Ej: 'Alto', 'Medio', 'Bajo'
        CONSTRAINT FK_Riesgo_Embarazada
            FOREIGN KEY (ID_Embarazada) REFERENCES Embarazada(ID_Embarazada)
    );
    PRINT '✅ Tabla Riesgo creada.';
END
GO

-- ============================================================
--  TABLA: Seguimiento
-- ============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Seguimiento' AND xtype='U')
BEGIN
    CREATE TABLE Seguimiento (
        ID_Seguimiento    INT IDENTITY(1,1) PRIMARY KEY,
        ID_Embarazada     INT            NOT NULL,
        ID_Usuario        INT            NULL,
        Fecha_Seguimiento DATE           NULL,
        Observaciones     NVARCHAR(MAX)  NULL,
        Signos_Alarma     NVARCHAR(MAX)  NULL,
        CONSTRAINT FK_Seguimiento_Embarazada
            FOREIGN KEY (ID_Embarazada) REFERENCES Embarazada(ID_Embarazada),
        CONSTRAINT FK_Seguimiento_Usuario
            FOREIGN KEY (ID_Usuario) REFERENCES Usuario(ID_Usuario)
    );
    PRINT '✅ Tabla Seguimiento creada.';
END
GO

-- ============================================================
--  TABLA: Ubicacion
-- ============================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Ubicacion' AND xtype='U')
BEGIN
    CREATE TABLE Ubicacion (
        ID_Ubicacion   INT IDENTITY(1,1) PRIMARY KEY,
        ID_Embarazada  INT  NOT NULL,
        ID_Direccion   INT  NOT NULL,
        Fecha_Registro DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_Ubicacion_Embarazada
            FOREIGN KEY (ID_Embarazada) REFERENCES Embarazada(ID_Embarazada),
        CONSTRAINT FK_Ubicacion_Direccion
            FOREIGN KEY (ID_Direccion) REFERENCES Direccion(ID_Direccion)
    );
    PRINT '✅ Tabla Ubicacion creada.';
END
GO

-- ============================================================
--  STORED PROCEDURE: sp_InsertarEmbarazadaConDireccion
--  (usado en POST /embarazadas)
-- ============================================================
IF OBJECT_ID('sp_InsertarEmbarazadaConDireccion', 'P') IS NOT NULL
    DROP PROCEDURE sp_InsertarEmbarazadaConDireccion;
GO

CREATE PROCEDURE sp_InsertarEmbarazadaConDireccion
    @Nombre       NVARCHAR(150),
    @Edad         INT,
    @Telefono     NVARCHAR(15),
    @Calle        NVARCHAR(200),
    @Ciudad       NVARCHAR(100),
    @Departamento NVARCHAR(100),
    @Latitud      FLOAT = NULL,
    @Longitud     FLOAT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Insertar dirección
    INSERT INTO Direccion (Calle, Ciudad, Departamento, Latitud, Longitud)
    VALUES (@Calle, @Ciudad, @Departamento, @Latitud, @Longitud);

    DECLARE @ID_Direccion INT = SCOPE_IDENTITY();

    -- 2. Insertar embarazada apuntando a la dirección recién creada
    INSERT INTO Embarazada (Nombre, Edad, Telefono, ID_Direccion)
    VALUES (@Nombre, @Edad, @Telefono, @ID_Direccion);

    DECLARE @ID_Embarazada INT = SCOPE_IDENTITY();

    -- 3. Retornar los IDs generados
    SELECT @ID_Embarazada AS ID_Embarazada, @ID_Direccion AS ID_Direccion;
END
GO

PRINT '✅ Stored Procedure sp_InsertarEmbarazadaConDireccion creado.';
GO

-- ============================================================
--  DATOS DE PRUEBA (opcional - comenta si no los necesitas)
-- ============================================================

-- Usuario admin de prueba (contraseña: admin123)
IF NOT EXISTS (SELECT 1 FROM Usuario WHERE Nombre = 'admin')
BEGIN
    INSERT INTO Usuario (Nombre, Contraseña, DPI, TELEFONO, Salt, Rol)
    VALUES ('admin', 'admin123', '1234567890101', '50212345678', '', 'admin');
    PRINT '✅ Usuario admin de prueba insertado.';
END
GO

-- Dirección de prueba
IF NOT EXISTS (SELECT 1 FROM Direccion WHERE Ciudad = 'Guatemala')
BEGIN
    INSERT INTO Direccion (Calle, Ciudad, Departamento, Latitud, Longitud)
    VALUES ('6a Avenida 1-22', 'Guatemala', 'Guatemala', 14.6349, -90.5069);
    PRINT '✅ Dirección de prueba insertada.';
END
GO

PRINT '';
PRINT '============================================';
PRINT ' ✅ Base de datos lista para usar en local';
PRINT '============================================';
GO
