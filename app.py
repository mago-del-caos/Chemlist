import streamlit as st
import sqlite3
import pandas as pd
from datetime import date

# Configuración de la página
st.set_page_config(page_title="Aracknia - Pase de Lista", layout="wide")
st.title("Sistema de Asistencia - Aracknia")

def get_connection():
    return sqlite3.connect('asistencia.db', check_same_thread=False)

# Pestañas de navegación
tab1, tab2, tab3 = st.tabs(["📝 Pasar Lista", "📊 Consultar Reportes", "⚙️ Añadir Alumnos"])

# --- PESTAÑA 1: PASAR LISTA ---
with tab1:
    st.header("Materia: Derecho | Grupo: 6A")
    fecha_actual = st.date_input("Fecha de registro", date.today())
    
    conn = get_connection()
    estudiantes = pd.read_sql_query("SELECT * FROM estudiantes WHERE grupo='6A'", conn)
    
    with st.form("form_asistencia"):
        asistencias = {}
        for index, row in estudiantes.iterrows():
            estado = st.radio(f"{row['nombre']}", ["Presente", "Ausente", "Retardo"], horizontal=True, key=row['id'])
            asistencias[row['id']] = estado
        
        submit = st.form_submit_button("Guardar Asistencia")
        
        if submit:
            c = conn.cursor()
            for est_id, est_estado in asistencias.items():
                c.execute("SELECT id FROM asistencias WHERE estudiante_id=? AND fecha=? AND materia='Derecho'", (est_id, fecha_actual))
                if c.fetchone():
                    c.execute("UPDATE asistencias SET estado=? WHERE estudiante_id=? AND fecha=? AND materia='Derecho'", (est_estado, est_id, fecha_actual))
                else:
                    c.execute("INSERT INTO asistencias (estudiante_id, fecha, estado, materia) VALUES (?, ?, ?, 'Derecho')", (est_id, fecha_actual, est_estado))
            conn.commit()
            st.success("¡Asistencia guardada correctamente!")

# --- PESTAÑA 2: REPORTES ---
with tab2:
    st.header("Historial de Asistencias")
    query = '''
        SELECT a.fecha, e.nombre, e.grupo, a.estado 
        FROM asistencias a 
        JOIN estudiantes e ON a.estudiante_id = e.id 
        WHERE a.materia = 'Derecho'
        ORDER BY a.fecha DESC
    '''
    df_reporte = pd.read_sql_query(query, conn)
    if not df_reporte.empty:
        st.dataframe(df_reporte, use_container_width=True)
    else:
        st.info("Aún no hay registros de asistencia.")

# --- PESTAÑA 3: GESTIÓN DE ALUMNOS ---
with tab3:
    st.header("Añadir nuevo alumno")
    with st.form("form_nuevo_alumno"):
        nuevo_nombre = st.text_input("Nombre del alumno")
        nuevo_grupo = st.selectbox("Grupo", ["4A", "4B", "4C", "5A", "5B", "5C", "6A", "6B", "6D"])
        btn_add = st.form_submit_button("Añadir")
        
        if btn_add and nuevo_nombre:
            c = conn.cursor()
            c.execute("INSERT INTO estudiantes (nombre, grupo) VALUES (?, ?)", (nuevo_nombre, nuevo_grupo))
            conn.commit()
            st.success(f"¡{nuevo_nombre} añadido al grupo {nuevo_grupo}! Ve a Pasar Lista para comprobarlo.")
