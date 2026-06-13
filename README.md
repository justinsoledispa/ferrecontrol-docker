# FerreControl — Sistema de Inventario Distribuido con Docker y Tailscale

> Sistema distribuido para la gestión de inventario de una ferretería, desplegado con contenedores Docker y conectado mediante una red privada Tailscale.

---

## Descripción

FerreControl es una aplicación de inventario distribuida desarrollada como proyecto académico. El sistema permite registrar, consultar, actualizar y eliminar productos de inventario desde una aplicación web. La base de datos y el sistema de reportes se ejecutan en contenedores separados, permitiendo probar comunicación entre servicios distribuidos.

La aplicación principal se conecta a una base de datos MySQL ubicada en otra máquina mediante la IP privada asignada por Tailscale. Además, se integra visualmente con un sistema de reportes independiente, ejecutado en otro contenedor, que permite consultar alertas de bajo stock, productos de mayor valor y resumen general del inventario.

---

## Flujo del Proyecto

```text
Aplicación Web Express + EJS
        ↓
Variables de entorno (.env)
        ↓
Red privada Tailscale
        ↓
Base de Datos MySQL en Docker
        ↓
Sistema de Reportes en contenedor independiente
```

---

## Stack Tecnológico

| Capa / Módulo            | Tecnología                          |
| ------------------------ | ----------------------------------- |
| Aplicación de inventario | Node.js · Express · EJS             |
| Base de datos            | MySQL 8                             |
| Conexión a BD            | mysql2/promise                      |
| Contenerización          | Docker                              |
| Red privada              | Tailscale                           |
| Interfaz                 | HTML · CSS · EJS                    |
| Comunicación distribuida | IP Tailscale + variables de entorno |

---

## Estructura del Repositorio

```text
ferrecontrol-app/
├── bin/
│   └── www                         # Arranque del servidor Express
├── config/
│   └── db.js                       # Conexión MySQL mediante variables de entorno
├── db/
│   └── init.sql                    # Script de inicialización de la base local de prueba
├── public/
│   └── stylesheets/
│       └── style.css               # Estilos de la aplicación
├── routes/
│   ├── index.js                    # Redirección inicial
│   └── productos.js                # Rutas del módulo de inventario
├── views/
│   ├── error.ejs                   # Vista personalizada de errores
│   └── productos/
│       ├── index.ejs               # Listado y búsqueda de productos
│       ├── nuevo.ejs               # Registro de productos
│       ├── detalle.ejs             # Detalle e historial de movimientos
│       └── editar-stock.ejs        # Entrada, salida y ajuste de stock
├── Dockerfile                      # Imagen Docker de la aplicación
├── .dockerignore                   # Exclusiones para la imagen Docker
├── .env.example                    # Variables de entorno de ejemplo
├── docker-compose.db.yml           # Base MySQL local de prueba
├── package.json
└── README.md
```

---

## Modelo de Base de Datos

El sistema usa un modelo relacional básico orientado a inventario.

Tablas principales:

* `categorias`
* `proveedores`
* `productos`
* `movimientos_stock`

La tabla central es `productos`, ya que almacena la información principal del inventario:

* `id`
* `nombre`
* `descripcion`
* `cantidad`
* `precio`
* `stock_minimo`
* `activo`
* `categoria_id`
* `proveedor_id`
* `created_at`

La tabla `movimientos_stock` permite registrar cambios en el inventario mediante tres tipos de movimiento:

* `entrada`
* `salida`
* `ajuste`

---

## Funcionalidades de la Aplicación

La aplicación de inventario permite:

* Registrar productos.
* Listar productos activos.
* Buscar productos por ID o nombre.
* Consultar el detalle de un producto.
* Actualizar stock mediante entrada, salida o ajuste.
* Registrar automáticamente movimientos de stock.
* Eliminar productos de forma lógica usando `activo = 0`.
* Acceder al sistema externo de reportes mediante Tailscale.

---

## Lógica de Stock

La actualización de stock maneja tres tipos de movimiento:

| Tipo      | Comportamiento                                             |
| --------- | ---------------------------------------------------------- |
| `entrada` | Suma la cantidad ingresada al stock actual                 |
| `salida`  | Resta la cantidad ingresada del stock actual               |
| `ajuste`  | Establece la cantidad ingresada como stock final corregido |

La aplicación no permite registrar salidas mayores al stock disponible.

---

## Rutas de la Aplicación

| Ruta                   | Método | Descripción                                        |
| ---------------------- | -----: | -------------------------------------------------- |
| `/`                    |    GET | Redirige al módulo de productos                    |
| `/productos/prueba/db` |    GET | Verifica conexión con MySQL                        |
| `/productos`           |    GET | Lista productos y permite búsqueda por ID o nombre |
| `/productos/nuevo`     |    GET | Muestra formulario de registro                     |
| `/productos`           |   POST | Registra un nuevo producto                         |
| `/productos/:id`       |    GET | Muestra detalle del producto                       |
| `/productos/:id/stock` |    GET | Muestra formulario de actualización de stock       |
| `/productos/:id/stock` |    PUT | Actualiza stock y registra movimiento              |
| `/productos/:id`       | DELETE | Elimina lógicamente un producto                    |

---

## Sistema de Reportes

El sistema de reportes es un servicio independiente ejecutado en otro contenedor y administrado por el segundo integrante del equipo.

Reportes disponibles:

* Productos con bajo stock.
* Top 5 productos con mayor valor en inventario.
* Resumen general del inventario.
* Productos sin movimiento reciente.
* Exportación en JSON y CSV.

La aplicación de inventario no duplica la lógica de reportes. Solo integra un acceso visual mediante la variable:

```env
REPORTES_URL=http://IP_TAILSCALE_DEL_SERVICIO_REPORTES:8080
```

---

## Variables de Entorno

Crear un archivo `.env` tomando como base `.env.example`.

```env
PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=ferrecontrol_db
DB_USER=ferrecontrol_user
DB_PASSWORD=ferrecontrol_pass

REPORTES_URL=http://100.93.188.110:8080
```

Para conexión real por Tailscale, `DB_HOST` debe ser la IP Tailscale de la máquina donde se ejecuta la base de datos.

Ejemplo:

```env
DB_HOST=100.xx.xx.xx
DB_PORT=3306
```

---

## Ejecución Local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Levantar MySQL local de prueba

```bash
docker compose -f docker-compose.db.yml up -d
```

### 3. Ejecutar aplicación

```bash
npm start
```

La aplicación queda disponible en:

```text
http://localhost:3000/productos
```

---

## Ejecución con Docker

### 1. Construir la imagen

```bash
docker build -t ferrecontrol-app .
```

### 2. Ejecutar el contenedor usando variables de entorno

Para conectarse a MySQL local desde Docker:

```bash
docker run --rm --name ferrecontrol_app_local -p 3000:3000 --env-file .env -e DB_HOST=host.docker.internal -e DB_PORT=3307 ferrecontrol-app
```

La aplicación queda disponible en:

```text
http://localhost:3000/productos
```

---

## Prueba de Comunicación por Tailscale

### 1. Verificar máquinas conectadas

```powershell
& "C:\Program Files\Tailscale\tailscale.exe" status
```

### 2. Probar puerto de la base de datos remota

```powershell
Test-NetConnection IP_TAILSCALE_COMPAÑERO -Port 3306
```

Debe mostrar:

```text
TcpTestSucceeded : True
```

### 3. Configurar `.env.tailscale`

```env
PORT=3000

DB_HOST=IP_TAILSCALE_COMPAÑERO
DB_PORT=3306
DB_NAME=ferrecontrol_db
DB_USER=ferrecontrol_user
DB_PASSWORD=ferrecontrol_pass

REPORTES_URL=http://IP_TAILSCALE_COMPAÑERO:8080
```

### 4. Ejecutar aplicación con configuración Tailscale

```powershell
Copy-Item .env.tailscale .env -Force
npm start
```

---

## Capturas de Pantalla

Las capturas recomendadas para evidenciar la entrega son:

```text
screenshots/
├── 01-tailscale-status.png
├── 02-docker-ps-mysql.png
├── 03-test-netconnection-db.png
├── 04-prueba-db.png
├── 05-listado-productos.png
├── 06-nuevo-producto.png
├── 07-detalle-producto.png
├── 08-actualizar-stock.png
├── 09-historial-movimientos.png
├── 10-sistema-reportes.png
└── 11-app-docker.png
```

### Aplicación de Inventario

* Listado de productos.
* Registro de producto.
* Detalle del producto.
* Actualización de stock.
* Historial de movimientos.

### Sistema de Reportes

* Resumen general.
* Bajo stock.
* Top 5 productos por valor.
* Productos sin movimiento.

### Docker y Tailscale

* Contenedores activos.
* Conexión por Tailscale.
* Prueba de puerto remoto.
* Aplicación ejecutándose en contenedor.

---

## Evidencias Técnicas

Comandos útiles para la entrega:

```bash
docker ps
```

```powershell
& "C:\Program Files\Tailscale\tailscale.exe" status
```

```powershell
Test-NetConnection IP_TAILSCALE_COMPAÑERO -Port 3306
```

```bash
docker build -t ferrecontrol-app .
```

```bash
docker run --rm --name ferrecontrol_app_tailscale -p 3000:3000 --env-file .env.tailscale ferrecontrol-app
```

---

## Integrantes

| Integrante   | Responsabilidad                                                            |
| ------------ | -------------------------------------------------------------------------- |
| Justin Soledispa | Aplicación de inventario con Express, EJS, Docker y conexión por Tailscale |
| José Luis Hidalgo | Base de datos MySQL y sistema de reportes en contenedores Docker           |

---

Proyecto académico — Sistema de Inventario Distribuido con Docker y Tailscale · 2026
