# EventLink CDM

EventLink CDM is a comprehensive, full-stack event and certificate management platform designed for Colegio de Montalban. The system streamlines the registration, attendance tracking, and automated certificate generation for institutional events.

## 🚀 Features

- **Event Management**: Create and manage events with customizable details, banners, and capacity limits.
- **Attendance Tracking**: Real-time attendance check-ins using manual overrides, dynamically generated PINs, and personalized QR codes.
- **Automated Certificates**: Generate high-quality, customized PDF certificates for all attendees automatically.
- **Email Integration**: Reliable bulk email delivery using Brevo API / Resend.
- **Admin Dashboard**: Comprehensive analytics, reporting, and CSV exports for event organizers and Admins.
- **Role-Based Access**: Secure login system with distinct privileges for Administrators, Organizers, and Students.

## 💻 Tech Stack

- **Frontend Engine**: React + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **Icons & UI**: Lucide React, Framer Motion
- **Backend API**: Node.js + Express.js
- **Database Engine**: PostgreSQL (Supabase)
- **PDF Generation**: PDFKit
- **Email Service**: Brevo API

## 🏗️ OOP Architecture

The backend codebase is structured using Object-Oriented Programming (OOP) principles for maintainability and scalability:

- **Inheritance**: Abstract `BaseService` and `BaseModel` classes are extended by concrete entities (e.g., `EmailService`, `User` model).
- **Encapsulation**: Private class fields (e.g., `#apiKey`, `#tableName`) and private helper methods hide internal complexity and configuration.
- **Polymorphism**: Subclasses override core methods (like `initialize()`, `validate()`, `serialize()`) to provide entity-specific behaviors.
- **Abstraction**: Complex operations like PDF drawing and SQL query building are abstracted behind clean, readable interfaces like `generateCertificate()` and `findById()`.

## 🛠️ Recent Major Updates

- **OOP Refactoring**: Completely refactored backend services and models to strictly adhere to OOP principles.
- **Cloud-Native Architecture**: Successfully migrated the platform for production deployment on Vercel (Frontend) and Render (Backend API).
- **Database Migration**: Transitioned from local MySQL to a robust Supabase PostgreSQL database for stable cloud data management.
- **Email Delivery Optimization**: Migrated to the Brevo API for reliable, high-deliverability automated emails.

## ⚙️ Local Development Setup

1. **Prerequisites**: Ensure you have Node.js (v18+) installed.
2. **Database**: A PostgreSQL database (e.g., Supabase) is required.
3. **Environment Variables**: Create a `.env` file in the root directory.
   ```env
   PORT=3001
   JWT_SECRET=your_super_secret_jwt_key
   EMAIL_USER=your_email_or_api_key
   EMAIL_PASS=your_app_password_or_api_secret
   DB_HOST=your_postgres_host
   DB_USER=your_postgres_user
   DB_PASS=your_postgres_password
   DB_NAME=your_postgres_db
   ```
4. **Install Dependencies**:
   ```bash
   npm install
   ```
5. **Start Servers**:
   ```bash
   npm run dev:full
   ```
   _This command leverages concurrently to start both the Vite frontend on port 5173 and the Express API on port 3001 simultaneously._
