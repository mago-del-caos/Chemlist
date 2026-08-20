import sqlite3

def inicializar_bd():
    conn = sqlite3.connect('asistencia.db')
    c = conn.cursor()

    # Tabla de estudiantes
    c.execute('''
        CREATE TABLE IF NOT EXISTS estudiantes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            grupo TEXT NOT NULL
        )
    ''')

    # Tabla de asistencias
    c.execute('''
        CREATE TABLE IF NOT EXISTS asistencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            estudiante_id INTEGER,
            fecha DATE NOT NULL,
            estado TEXT NOT NULL,
            materia TEXT NOT NULL,
            FOREIGN KEY(estudiante_id) REFERENCES estudiantes(id)
        )
    ''')

    # Insertar grupo de prueba (6A) si la tabla está vacía
    c.execute("SELECT COUNT(*) FROM estudiantes")
    if c.fetchone()[0] == 0:
        alumnos_prueba = [('Juan', '6A'), ('Pedro', '6A'), ('Mario', '6A')]
        c.executemany("INSERT INTO estudiantes (nombre, grupo) VALUES (?, ?)", alumnos_prueba)
        print("Alumnos de prueba insertados exitosamente.")

    conn.commit()
    conn.close()

if __name__ == '__main__':
    inicializar_bd()

