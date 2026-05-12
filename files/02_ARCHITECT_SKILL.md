---
name: architect
agent: ARCHITECT_AGENT
role: Project scaffolding, configuration, and dependency setup
runs: STEP 1 — first agent to execute
---

# ARCHITECT AGENT — EVENTLINK CDM

You scaffold the entire project structure so every other agent can write into the correct locations without conflict.

## YOUR OUTPUT (must produce ALL of these)

### 1. `package.json`
```json
{
  "name": "eventlink-cdm",
  "version": "1.0.0",
  "description": "EVENTLINK CDM - Desktop Event Registration System",
  "main": "electron/main.js",
  "scripts": {
    "start": "concurrently \"npm run server\" \"wait-on http://localhost:5173 && electron .\"",
    "dev": "vite",
    "server": "node electron/server/app.js",
    "build": "vite build && electron-builder",
    "electron": "electron ."
  },
  "dependencies": {
    "better-sqlite3": "^9.4.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "express": "^4.18.3",
    "cors": "^2.8.5",
    "nodemailer": "^6.9.10",
    "puppeteer": "^22.4.1",
    "qrcode": "^1.5.3",
    "multer": "^1.4.5-lts.1",
    "dotenv": "^16.4.5",
    "axios": "^1.6.8",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.3",
    "react-hook-form": "^7.51.0",
    "zod": "^3.22.4",
    "@hookform/resolvers": "^3.3.4",
    "zustand": "^4.5.2",
    "lucide-react": "^0.363.0",
    "recharts": "^2.12.3",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "electron": "^29.1.5",
    "electron-builder": "^24.13.3",
    "vite": "^5.2.6",
    "@vitejs/plugin-react": "^4.2.1",
    "tailwindcss": "^3.4.3",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "concurrently": "^8.2.2",
    "wait-on": "^7.2.0"
  }
}
```

### 2. `vite.config.js`
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173 },
  build: { outDir: 'dist' }
});
```

### 3. `tailwind.config.js`
```javascript
export default {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a'
        }
      }
    }
  },
  plugins: []
};
```

### 4. `.env.example`
```
JWT_SECRET=your_jwt_secret_here_change_in_production
JWT_EXPIRES_IN=7d
PORT=3001

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=EVENTLINK CDM <your_email@gmail.com>

# App
APP_NAME=EVENTLINK CDM
NODE_ENV=development
```

### 5. Create all empty folders with `.gitkeep`
```
electron/
electron/server/
electron/server/db/
electron/server/db/migrations/
electron/server/routes/
electron/server/middleware/
electron/server/services/
electron/server/utils/
src/
src/store/
src/pages/
src/pages/Events/
src/pages/Registration/
src/pages/Attendance/
src/pages/Certificates/
src/pages/Admin/
src/pages/Settings/
src/components/
src/components/ui/
src/lib/
assets/
```

### 6. `src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }
body { margin: 0; font-family: 'Inter', system-ui, sans-serif; }
```

### 7. `src/main.jsx`
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);
```

### 8. `index.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EVENTLINK CDM</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

## VALIDATION CHECKLIST
- [ ] All folders exist
- [ ] package.json has no conflicting version ranges
- [ ] .env.example has all required keys
- [ ] No files reference absolute paths

## HANDOFF TO NEXT AGENT
After scaffold complete, signal: **DATABASE_AGENT may now begin.**
Export: folder structure map (above) as reference for all agents.
