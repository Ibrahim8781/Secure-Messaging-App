# Secure End-to-End Encrypted Messaging & File-Sharing System

## Information Security Semester Project

A complete implementation of a secure messaging system with end-to-end encryption for both text messages and file sharing.

## 🚀 Features

- **End-to-End Encryption**: Messages and files are encrypted client-side before transmission
- **Secure Key Exchange**: Custom ECDH + digital signature protocol
- **Attack Protection**: MITM and replay attack prevention
- **Security Logging**: Comprehensive audit trails
- **Client-Side Crypto**: All encryption happens in the browser using Web Crypto API

## 🛠 Tech Stack

### Backend
- Node.js + Express
- MongoDB + Mongoose
- JWT for authentication
- bcrypt for password hashing

### Frontend
- React.js
- Web Crypto API
- IndexedDB for secure key storage
- Axios for API calls

## 📦 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Modern browser with Web Crypto API support

### 1. Clone the repository
```bash
git clone <repository-url>
cd secure-messaging-app