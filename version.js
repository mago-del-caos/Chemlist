const CHEMLIST_VERSION = "v42-2026.09.04";
console.log("Chemlist cargado correctamente en la versión: " + CHEMLIST_VERSION);

// Mostrar la versión automáticamente en la interfaz si existe un contenedor para ello
window.addEventListener('DOMContentLoaded', () => {
    const headerTitle = document.querySelector('header h1');
    if (headerTitle && !document.getElementById('version-badge')) {
        const badge = document.createElement('span');
        badge.id = 'version-badge';
        badge.style.cssText = 'font-size: 0.6rem; background: #FFC107; color: #000; padding: 2px 6px; border-radius: 4px; vertical-align: middle; margin-left: 5px;';
        badge.innerText = CHEMLIST_VERSION;
        headerTitle.appendChild(badge);
    }
});
