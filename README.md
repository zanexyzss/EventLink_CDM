# EventLink CDM

EventLink CDM is a comprehensive, full-stack event and certificate management platform designed for Colegio de Montalban. The system streamlines the registration, attendance tracking, and automated certificate generation for institutional events.

## 🚀 Features

- **Event Management**: Create and manage events with customizable details, banners, and capacity limits.
- **Attendance Tracking**: Real-time attendance check-ins using manual overrides, dynamically generated PINs, and personalized QR codes.
- **Automated Certificates**: Generate high-quality, customized PDF certificates for all attendees automatically.
- **Email Integration**: Bulk email certificates directly to attendees using integrated SMTP services.
- **Admin Dashboard**: Comprehensive analytics, reporting, and CSV exports for event organizers and system administrators.
- **Role-Based Access**: Secure login system with distinct privileges for Administrators, Organizers, and Students.

## 💻 Tech Stack

- **Frontend Engine**: React + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **Icons & UI**: Lucide React, Framer Motion
- **Backend API**: Node.js + Express.js
- **Database Engine**: MySQL (mysql2 connection pool) / XAMPP
- **PDF Generation**: Puppeteer
- **Email Service**: Nodemailer

## 🛠️ Recent Major Updates
- **v2.0 Database Migration**: Successfully migrated the embedded SQLite database engine to an asynchronous, robust MySQL/XAMPP architecture capable of handling higher concurrent loads.
- **Async Refactoring**: Completely overhauled the backend API routes and queries to utilize full asynchronous database operations (`async/await`) for improved reliability and non-blocking performance.
- **Automated Provisioning**: The backend now automatically initializes the `eventlink_cdm` database schema and seeds default administrator accounts if they do not exist.

## ⚙️ Local Development Setup

1. **Prerequisites**: Ensure you have Node.js (v18+) and XAMPP (for MySQL) installed.
2. **Database**: Start the MySQL module in your XAMPP Control Panel.
3. **Environment Variables**: Create a `.env` file in the root directory.
   ```env
   PORT=3001
   JWT_SECRET=your_super_secret_jwt_key
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   DB_HOST=127.0.0.1
   DB_USER=root
   DB_PASS=
   DB_NAME=eventlink_cdm
   ```
4. **Install Dependencies**:
   ```bash
   npm install
   ```
5. **Start Servers**:
   ```bash
   npm run dev:full
   ```
   *This command leverages concurrently to start both the Vite frontend on port 5173 and the Express API on port 3001 simultaneously.*
