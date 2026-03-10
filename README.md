# 🏎️ JIT Logistics Monitor - VW Puebla Plant / DHL

![Version](https://img.shields.io/badge/version-1.0.0--beta-blue?style=for-the-badge)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

## 📌 Project Overview
Este proyecto es una **Torre de Control Logística** de alto rendimiento diseñada específicamente para la operación **Just-In-Time (JIT)** en la planta de **Volkswagen Puebla**, operada por **DHL**. 

El dashboard centraliza la telemetría de rutas, el cumplimiento de ventanas de tiempo y la geolocalización de unidades en una interfaz de usuario industrial de nivel premium (HUD style), permitiendo a los supervisores tomar decisiones críticas en segundos.

---

## 🚀 Key Features

### 1. Central Intelligence Dashboard
- **KPI Analytics**: Visualización en tiempo real de cumplimiento (Compliance Matrix), retrasos promedio y consumo de diesel.
* **Smart Exception Monitor**: Listado dinámico de excepciones críticas con prioridad de respuesta.

### 2. High-Precision Geolocation
* **Satellite/Map Views**: Capacidad de alternar entre vista de mapa estándar y satelital real.
* **Precise Nodes**: Marcadores específicos para **Nave 21, Puerto 3 y Nave 25**.
* **Live Fleet Tracker**: Seguimiento de unidades con estados dinámicos (Moving, Stopped, Alert) y trazo de rutas JIT.

### 3. JIT Route Cycle Analysis
* **Timeline View**: Visualización interactiva del ciclo de vida de la ruta (Recolección -> Tránsito -> Descarga).
* **Variance Tracking**: Monitoreo de deltas de tiempo contra la ventana programada.

### 4. Operational Ingestion
* **Excel Data Import**: Módulo integrado para cargar archivos `.xlsx` del BESI JIS y actualizar automáticamente el dashboard.

---

## 🛠️ Technology Stack

*   **Frontend**: React 18 + TypeScript.
*   **Build Tool**: Vite (Ultra-fast development).
*   **Styling**: Tailwind CSS v4 (Modern HUD aesthetic).
*   **Animations**: Framer Motion (Seamless transitions).
*   **Maps**: Leaflet + React-Leaflet (GIS integration).
*   **Charts**: Recharts (Operational data visualization).
*   **Auth (complemento)**: Supabase en el frontend para sesión de usuario; el backend Express no se modifica. Ver [SUPABASE.md](./SUPABASE.md).

---

## 📂 Project Structure

```bash
├── src/
│   ├── assets/         # Official Branding (VW Logo, etc.)
│   ├── components/     # UI Elements (StatCards, NavItems, Tables)
│   ├── data/           # Mock Data & Configurations
│   ├── hooks/          # Custom Hooks (Theme Management)
│   ├── pages/          # Core Views (Dashboard, Geolocation, etc.)
│   ├── types/          # TypeScript Interfaces
│   └── App.tsx         # Root Logic & Layout
└── README.md
```

---

## ⚡ Setup & Installation

Para correr este proyecto localmente:

1.  **Clonar el repositorio**:
    ```bash
    git clone https://github.com/tu-usuario/vw-dhl-jit-monitor.git
    cd vw-dhl-jit-monitor
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```

3.  **Iniciar modo desarrollo**:
    ```bash
    npm run dev
    ```

4.  **Generar Build de Producción**:
    ```bash
    npm run build
    ```

## 🌐 Deploy Híbrido (Frontend en Vercel + Backend local SQLite)

Este repo ya quedó configurado para mantener **SQLite en local** y desplegar solo el frontend en Vercel.

1. **Backend local (Express + Prisma + SQLite)**  
   ```bash
   cd server
   cp .env.example .env
   npm install
   npm run dev
   ```
   API por defecto: `http://localhost:4000`.

2. **Configurar CORS del backend (opcional, recomendado en producción)**  
   En `server/.env`, usa:
   ```env
   CORS_ORIGINS=https://tu-proyecto.vercel.app,https://*.vercel.app
   ```
   Si no defines `CORS_ORIGINS`, el backend permite todos los orígenes.

3. **Desplegar frontend en Vercel**  
   - Importa este repo en Vercel.
   - Vercel construye con `npm run build` y sirve `dist` (configurado en `vercel.json`).
   - Define la variable `VITE_API_URL` en Vercel:
     - Uso personal (solo en tu máquina): `http://localhost:4000`
     - Uso externo/compartido: URL HTTPS pública de un túnel hacia tu backend local.

4. **(Opcional) Exponer backend local con túnel HTTPS**  
   Ejemplo con Cloudflare Tunnel:
   ```bash
   cloudflared tunnel --url http://localhost:4000
   ```
   Luego usa esa URL como `VITE_API_URL` en Vercel.

---

## 📁 Data Compliance
Este sistema está diseñado para ser compatible con la estructura de datos del documento **BESI JIS AKSYS CW 09** y el **Control de Ciclos T28**.

---
**Desarrollado para la Excelencia Logística en VW Puebla | 2026**
