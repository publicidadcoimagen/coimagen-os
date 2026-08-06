# n8n en el VPS de IONOS — acceso y estado (P-70)

## Estado

- n8n está instalado y corriendo vía Docker en el VPS, arranca correctamente
  (`docker ps` muestra el contenedor `n8n-n8n-1` como `Up`).
- **Sin credenciales reales conectadas** (Gmail, Notion, etc.) — instalación
  limpia, tal como pidió el ticket.
- La app está protegida: no se puede usar sin antes crear una cuenta owner
  (pantalla "Set up owner account" — email, nombre, contraseña). Esa cuenta
  **falta crearla — le toca a Camila**, no se generó con datos inventados.
- La variable `N8N_BASIC_AUTH_ACTIVE` que pedía el ticket original **no
  aplica en esta versión de n8n** (2.33.4) — esa app la reemplazó hace tiempo
  por su sistema propio de cuentas/login, que es el que efectivamente
  protege el acceso ahora. No se dejó configurada porque no tenía efecto.

## Bloqueador pendiente: firewall de IONOS

El puerto 5678 (donde escucha n8n) **no es alcanzable desde fuera del VPS
todavía**, aunque el contenedor funciona bien internamente
(`curl localhost:5678` responde 200 dentro del servidor). Se comprobó con
pruebas TCP directas que el puerto 22 (SSH) responde al instante y el
puerto 5678 se queda "colgado" sin respuesta — es la firma típica de un
firewall a nivel de proveedor (fuera del sistema operativo) que por
default solo permite SSH.

**Esto no se puede arreglar por SSH.** Hace falta entrar al Cloud Panel de
IONOS y agregar una regla de firewall permitiendo tráfico entrante TCP en
el puerto 5678 hacia este VPS (74.208.193.184).

El firewall del propio sistema operativo (`ufw`) ya está configurado
correctamente del lado del servidor — activo, solo permite 22 y 5678 — así
que en cuanto se abra el puerto en IONOS debería quedar accesible de
inmediato sin pasos adicionales.

## Cómo entrar

- **URL una vez abierto el puerto:** `http://74.208.193.184:5678`
  (sin HTTPS todavía — no hay dominio apuntando al VPS; se dejó pendiente
  a propósito, según instrucción del ticket).
- **SSH al VPS:** acceso por llave (no por contraseña) usando una llave
  ed25519 dedicada generada para esta tarea, guardada localmente en la
  máquina donde se hizo la instalación (`~/.ssh/id_ed25519_ionos_n8n`). La
  contraseña de root que se compartió para el setup inicial ya no hace
  falta — se usó una sola vez para instalar la llave y no se guardó en
  ningún archivo del repo ni en texto plano después de usarla.
- **Deploy de n8n:** `/opt/n8n/docker-compose.yml` en el VPS. Para
  reiniciar: `cd /opt/n8n && docker compose restart`. Los datos de n8n
  persisten en `/opt/n8n/data` (volumen montado).

## Pendiente antes de dar por cerrado

1. Camila (o quien vaya a administrar n8n) abre el puerto 5678 en el
   firewall de IONOS Cloud Panel.
2. Entra a `http://74.208.193.184:5678/setup` y crea la cuenta owner con
   su propio correo y contraseña.
3. Cuando haya un dominio disponible para n8n, avisar para configurar
   HTTPS con Let's Encrypt (pendiente, ver ticket original).
