CREATE TABLE IF NOT EXISTS profesores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nombre TEXT
);

CREATE TABLE IF NOT EXISTS estudiantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    grupo TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS asistencias (
    estudiante_id INTEGER,
    fecha DATE NOT NULL,
    estado TEXT NOT NULL,
    PRIMARY KEY (estudiante_id, fecha),
    FOREIGN KEY(estudiante_id) REFERENCES estudiantes(id)
);

-- Crear tu cuenta de profesor
INSERT OR IGNORE INTO profesores (username, password, nombre) VALUES ('cifra', 'chemlist2026', 'Profesor Cifra');

-- Insertar los alumnos de prueba
INSERT OR IGNORE INTO estudiantes (nombre, grupo) VALUES ('Juan', '6A'), ('Pedro', '6A'), ('Mario', '6A');
