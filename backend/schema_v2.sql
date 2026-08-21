DROP TABLE IF EXISTS profesores;
CREATE TABLE profesores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nombre TEXT,
    rol TEXT,
    grupos TEXT
);
CREATE TABLE IF NOT EXISTS reportes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha DATE NOT NULL,
    estudiante_nombre TEXT,
    grupo TEXT,
    profesor_nombre TEXT,
    motivo TEXT
);

-- Cuentas por defecto
INSERT INTO profesores (username, password, nombre, rol, grupos) VALUES ('cifra', 'chemlist2026', 'Admin Cifra', 'admin', 'ALL');
INSERT INTO profesores (username, password, nombre, rol, grupos) VALUES ('prefecto', '1234', 'Prefectura', 'prefecto', 'ALL');
INSERT INTO profesores (username, password, nombre, rol, grupos) VALUES ('profe_mate', '1234', 'Profesor de Mate', 'profesor', '6A,6B');
