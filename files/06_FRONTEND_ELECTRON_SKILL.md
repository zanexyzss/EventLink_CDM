---
name: frontend
agent: FRONTEND_AGENT
role: All React pages, components, routing, and UI
runs: STEP 8
depends_on: BACKEND_AGENT (needs API contract finalized)
---

# FRONTEND AGENT — EVENTLINK CDM

You build the complete React UI inside the Electron shell. Every page must be functional — no lorem ipsum, no placeholder buttons that do nothing. All API calls use `src/lib/api.js`.

## DESIGN SYSTEM

```
Primary Blue:   #1e3a8a  (brand, CTAs, headers)
Secondary Gold: #c7a84e  (accents, highlights)
Success:        #16a34a
Warning:        #d97706
Error:          #dc2626
Background:     #f8fafc
Surface:        #ffffff
Text:           #0f172a
Subtle text:    #64748b
Border:         #e2e8f0
```

Font: Inter (imported via Google Fonts in index.html)

## ROUTING — `src/App.jsx`

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useEffect } from 'react';
import ProtectedRoute from './components/ProtectedRoute';

// Pages (lazy import for performance)
import Login from './pages/Login';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import EventList from './pages/Events/EventList';
import EventDetail from './pages/Events/EventDetail';
import CreateEvent from './pages/Events/CreateEvent';
import AttendanceScanner from './pages/Attendance/AttendanceScanner';
import CertificateManager from './pages/Certificates/CertificateManager';
import AdminDashboard from './pages/Admin/AdminDashboard';
import ManageUsers from './pages/Admin/ManageUsers';
import Reports from './pages/Admin/Reports';
import Settings from './pages/Settings/Settings';
import Layout from './components/Layout';

export default function App() {
  const { restoreToken } = useAuthStore();
  useEffect(() => { restoreToken(); }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="events" element={<EventList />} />
          <Route path="events/:id" element={<EventDetail />} />
          <Route path="events/create" element={<ProtectedRoute roles={['admin','organizer']}><CreateEvent /></ProtectedRoute>} />
          <Route path="attendance/:id" element={<ProtectedRoute roles={['admin','organizer']}><AttendanceScanner /></ProtectedRoute>} />
          <Route path="certificates/:id" element={<ProtectedRoute roles={['admin','organizer']}><CertificateManager /></ProtectedRoute>} />
          <Route path="admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="admin/users" element={<ProtectedRoute roles={['admin']}><ManageUsers /></ProtectedRoute>} />
          <Route path="admin/reports" element={<ProtectedRoute roles={['admin','organizer']}><Reports /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}
```

## LAYOUT — `src/components/Layout.jsx`

Must include:
- **Sidebar** with navigation links (role-aware — students don't see admin links)
- **Top bar** with user info + logout button
- **Main content area** with `<Outlet />`
- Active link highlighting

Sidebar links:
```
All roles:
  🏠 Dashboard          /dashboard
  📅 Events             /events

Organizer + Admin:
  ✅ Attendance         /attendance (links to event list first)
  🏆 Certificates       /certificates (links to event list first)
  📊 Reports            /admin/reports

Admin only:
  ⚙️ Manage Users       /admin/users
  🔧 Settings           /settings
```

## PAGES TO BUILD

### `pages/Login.jsx`
- Email + password fields
- "Sign in" button with loading state
- Link to register
- Show error toast on failure
- Redirect to /dashboard on success

### `pages/RegisterPage.jsx`
- Fields: full_name, email, student_id, department, year_level, password, confirm_password
- Validate with React Hook Form + Zod
- Redirect to dashboard on success

### `pages/Dashboard.jsx`
- Welcome header with user's name
- Stats row: My Registrations count, Upcoming Events count, (Admin: Total Students)
- "Upcoming Events" cards grid (next 5 events)
- "My Recent Registrations" table (student view)
- Quick actions: "Browse Events" button

### `pages/Events/EventList.jsx`
- Search bar + filter by type + filter by status
- Event cards grid: title, date, venue, slots remaining, status badge
- "Create Event" button (organizer+)
- Registration deadline countdown badge
- Clicking a card → EventDetail

### `pages/Events/EventDetail.jsx`
- Full event info (title, description, date, venue, type, organizer)
- Slots remaining / total
- Status badge
- "Register" button (student) — disabled if: closed, deadline passed, already registered, no slots
- Registration confirmation dialog
- Registrations count (visible to organizer+)
- "Manage Attendance" button (organizer+)
- "Generate Certificates" button (organizer+)

### `pages/Events/CreateEvent.jsx`
- Fields: title, description, event_type (seminar/workshop/sports/cultural/academic/other), venue, event_date, registration_deadline, max_slots
- Publish immediately toggle (sets status to 'open')
- Submit creates event, optionally opens it

### `pages/Attendance/AttendanceScanner.jsx`
- Shows event info at top
- Attendance stats: present/total
- Tabs: QR Scanner | Manual Search
- QR Scanner: uses browser camera to scan QR (use `react-qr-reader` or HTML5 camera)
- Manual Search: search by name or student ID → click "Mark Present"
- Attendees list below with check-in timestamps

### `pages/Certificates/CertificateManager.jsx`
- Event info header
- Attendance stats
- "Generate All Certificates" button → calls API → shows progress
- "Email All Certificates" button → bulk send
- Certificates table: student name, generated?, emailed?, download link

### `pages/Admin/AdminDashboard.jsx`
- System stats: total users, total events, total registrations, emails sent
- Recent events table
- Quick links to all admin functions
- BarChart: registrations per event (Recharts)

### `pages/Admin/ManageUsers.jsx`
- Searchable, sortable users table
- Filter by role
- Edit user role (dropdown in row)
- Deactivate user button

### `pages/Admin/Reports.jsx`
- Event selector dropdown
- Report card: registrations, attendance rate, certificates sent
- "Export CSV" button
- LineChart: registrations over time

### `pages/Settings/Settings.jsx`
- Email configuration form: HOST, PORT, USER, PASS, FROM
- "Test Email" button → sends test to admin email
- Institution name field
- Save settings button

## UI COMPONENTS TO BUILD

### `components/ui/Button.jsx`
```jsx
// variants: primary, secondary, danger, ghost
// sizes: sm, md, lg
// props: loading (shows spinner), disabled
```

### `components/ui/Input.jsx`
```jsx
// With label, error message, icon slot
```

### `components/ui/Modal.jsx`
```jsx
// backdrop blur, close on ESC, close on backdrop click
```

### `components/ui/Badge.jsx`
```jsx
// variants: open (green), closed (red), draft (gray), completed (blue)
```

### `components/ui/Toast.jsx`
```jsx
// Global toast system, use context
// success (green), error (red), warning (yellow)
// auto-dismiss after 4s
```

### `components/EventCard.jsx`
```jsx
// Props: event object
// Shows: banner/placeholder gradient, title, date, venue, slots, status badge, type icon
// Hover: slight lift effect
```

### `components/ui/Spinner.jsx`
```jsx
// Animated spinner, sizes: sm/md/lg
```

## FRONTEND RULES
- Every API call → try/catch → show toast on error
- Loading states on all async operations
- Empty states with helpful message (not blank screens)
- Confirm dialogs before destructive actions (cancel registration, delete)
- Mobile-responsive (though this is desktop, screens can vary)
- Never expose raw error objects to users — show human-readable messages
- Dates always formatted with `date-fns` format functions
- All forms use React Hook Form — no uncontrolled inputs

## VALIDATION CHECKLIST
- [ ] All 10 pages built and functional
- [ ] Routing works, ProtectedRoute guards role access
- [ ] Sidebar navigation is role-aware
- [ ] All API calls have loading + error states
- [ ] Toast notifications work globally
- [ ] Forms validate before submit
- [ ] Empty states present on all list pages

---
---

# ELECTRON AGENT — EVENTLINK CDM

---
name: electron
agent: ELECTRON_AGENT
role: Electron main process, preload, IPC, app packaging
runs: STEP 9
depends_on: ALL other agents
---

## `electron/main.js`

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initDatabase } = require('./server/db/database');
require('dotenv').config();

// Start Express server
require('./server/app');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false
  });

  // Load React app
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// IPC: open file dialog for certificate download
const { dialog, shell } = require('electron');
ipcMain.handle('open-file', async (_, filePath) => {
  await shell.openPath(filePath);
});

ipcMain.handle('save-dialog', async (_, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  return result;
});
```

## `electron/preload.js`

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  saveDialog: (defaultName) => ipcRenderer.invoke('save-dialog', defaultName)
});
```

## `electron-builder` config in `package.json`

```json
"build": {
  "appId": "com.cdm.eventlink",
  "productName": "EVENTLINK CDM",
  "directories": { "output": "release" },
  "win": { "target": "nsis", "icon": "assets/icon.ico" },
  "mac": { "target": "dmg", "icon": "assets/icon.icns" },
  "linux": { "target": "AppImage" },
  "files": ["dist/**/*", "electron/**/*", "assets/**/*", ".env"]
}
```

## VALIDATION CHECKLIST
- [ ] `initDatabase()` called before window opens
- [ ] Express server starts before React loads
- [ ] `contextBridge` exposes only needed APIs (not full Node)
- [ ] App shows splash/loading while server starts
- [ ] Window size is comfortable for desktop use
- [ ] App icon set (create placeholder if no asset provided)
