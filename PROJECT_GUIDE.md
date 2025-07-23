# Vidoma E-commerce Telegram Bot - Project Guide

## 📋 Project Overview

**Vidoma E-commerce Telegram Bot** is a complete e-commerce solution featuring:
- **Customer Bot**: AI-powered product consultation, catalog browsing, order processing
- **Admin Panel**: Product/order management, analytics dashboard  
- **Integrations**: OpenAI GPT-4, SalesDrive CRM, Nova Poshta API

## 📁 Project Structure

```
D:\workspace\ongoing\Upwork-projects\order_telegram_bot\
├── src/
│   ├── bot/
│   │   ├── index.js                    # Main bot initialization (integrates all handlers)
│   │   ├── keyboards/
│   │   │   └── mainKeyboard.js         # Reply keyboard definitions
│   │   ├── handlers/
│   │   │   ├── start.js               # Start command, help handling
│   │   │   ├── products.js            # Product browsing, size help
│   │   │   ├── orders.js              # Order status, TTN tracking
│   │   │   └── support.js             # Manager contact information
│   │   └── scenes/
│   │       └── orderWizard.js         # Nova Poshta integrated order process
│   ├── services/
│   │   ├── ai.js                      # OpenAI GPT-4 consultation
│   │   ├── crm.js                     # SalesDrive CRM integration
│   │   ├── csv.js                     # CSV import functionality
│   │   ├── product.js                 # Product management
│   │   └── novaPoshta.js              # Nova Poshta API integration
│   ├── admin/                         # Express.js admin panel
│   │   ├── index.js
│   │   ├── routes/                    # Admin routes
│   │   └── views/                     # EJS templates
│   └── database/
│       ├── connection.js              # SQLite connection
│       └── init.sql                   # Database schema
├── data/
│   └── database.sqlite                # SQLite database
├── public/                            # Static files
├── .env                              # Environment variables
└── server.js                         # Main server (bot + admin panel)
```

## 🔄 Current Workflow

### 1. Main Menu (Reply Keyboard)
```
[🛍 Browse Products] [📦 Order Status]
[💬 Manager]          [❓ Help]
```

### 2. Product Browsing Flow
```
Browse Products → Category Selection → Product List → Product Details
└── [📏 Size Help] [🛒 Order] [⬅ Back]
```

### 3. Nova Poshta Integrated Order Process
```
Order Click → 
Step 1: Name Input →
Step 2: Phone Number Input →  
Step 3: Size Selection →
Step 4: Delivery Method Selection [Nova Poshta/Courier] →

Nova Poshta Selection:
Step 5: City Input →
Step 6: City Search/Selection (Nova Poshta API) →
Step 7: Warehouse Selection (Nova Poshta API) →
Step 8: Payment Method Selection →
Step 9: Order Confirmation → CRM Submission (with Nova Poshta parameters)

Courier Selection:
Step 5: Address Input → Jump to Step 8
```

### 4. Order Status Tracking
```
Order Status → TTN Input or Phone Number → Nova Poshta API Query → Delivery Status Display
or
Order Status → [📋 My Orders] → Database Order History Display
```

### 5. Manager Contact
```
Manager → Contact Information Display (@vidoma_manager_bot guidance)
```

## 🛠 Technology Stack & Integrations

**Backend:**
- Node.js + Telegraf.js (Telegram Bot)
- Express.js (Admin Panel)
- SQLite3 (Database)

**External API Integrations:**
- ✅ OpenAI GPT-4 (AI Consultation)
- ✅ SalesDrive CRM (Order Submission)
- ✅ Nova Poshta API (Delivery Management)

## ⚙️ Environment Configuration

### Required Environment Variables (.env)
```env
# Telegram Bot Configuration
BOT_TOKEN=
BOT_USERNAME=vidoma_bot
ADMIN_BOT_TOKEN=

# Nova Poshta API
NOVA_POSHTA_API_KEY=

# OpenAI API
OPENAI_API_KEY=

# SalesDrive CRM
CRM_API_KEY=s
CRM_API_URL=
CRM_PROJECT_ID=

# Admin Panel
PORT=
ADMIN_USERNAME=
ADMIN_PASSWORD=
SESSION_SECRET=

# Database
DATABASE_PATH=./data/database.sqlite

# File Upload
UPLOAD_PATH=./data/uploads
MAX_FILE_SIZE=10485760

# Application
NODE_ENV=development
LOG_LEVEL=info

# Features
AI_ENABLED=true
CRM_ENABLED=true

# Security
CORS_ORIGIN=http://localhost:3000
```

## 📊 Database Schema

### Core Tables
- **users** - Telegram users information
- **categories** - Product categories
- **products** - Product information and inventory
- **orders** - Order records
- **order_items** - Order item details
- **customer_inquiries** - Customer support messages

### Database Initialization
The database automatically initializes on first run using `src/database/init.sql`.

## 🚀 Development Commands

### Core Development
```bash
npm start              # Start both bot and admin panel
npm run dev            # Development mode with auto-reload (nodemon)
npm run bot            # Start bot only
npm run admin          # Start admin panel only (port 3000)
```

### Quality Assurance
```bash
npm run build          # Run lint + tests (CI pipeline)
npm run lint           # ESLint code checking
npm run lint:fix       # Auto-fix ESLint issues
npm test               # Run Jest test suite
npm run test:watch     # Tests in watch mode
```

### Database Operations
```bash
npm run migrate        # Run database migrations
npm run seed           # Seed database with sample data
npm run backup         # Create database backup
```

### CSV Operations
```bash
# Place products.csv in data/ folder first
npm run import-csv     # Import products from CSV
```

### Production
```bash
npm run prod           # Production mode
```

## 🎯 Core Features

### 1. AI Consultation
- GPT-4 powered product recommendations
- Natural language understanding
- Context-aware responses

### 2. Product Catalog
- Category-based browsing
- Product search functionality
- Size guide integration
- Image display support

### 3. Nova Poshta Integration
- Real-time city search via API
- Warehouse selection with live data
- Automatic delivery parameter generation
- TTN tracking functionality

### 4. Order Management
- Multi-step order wizard
- Size selection assistance
- Payment method options
- Order confirmation system

### 5. CRM Integration
- Automatic order submission to SalesDrive
- Customer data synchronization
- Order status tracking
- Nova Poshta parameters included

### 6. Delivery Tracking
- TTN-based tracking
- Phone number lookup
- Real-time status updates
- Nova Poshta API integration

### 7. Admin Panel
- Web-based product management
- Order processing interface
- Customer inquiry management
- Sales analytics dashboard

## 📋 Setup Instructions

### 1. Installation
```bash
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env` and configure all required variables.

### 3. Database Setup
Database will be automatically created on first run.

### 4. Start Development
```bash
npm run dev  # Starts with nodemon for auto-reload
```

### 5. Access Points
- **Bot**: Available via Telegram @vidoma_bot
- **Admin Panel**: http://localhost:3000
- **Manager Bot**: @vidoma_manager_bot

## 🔧 Architecture Details

### Bot Handler Structure
- **Modular Design**: Each feature has its own handler file
- **Scene Management**: Complex flows use Telegraf scenes
- **Navigation Stack**: Proper back button functionality
- **Session Management**: Persistent user state

### API Integration Pattern
- **Service Layer**: All external APIs abstracted into service classes
- **Error Handling**: Comprehensive error handling and fallbacks
- **Rate Limiting**: Built-in rate limiting for API calls
- **Caching**: Intelligent caching for frequently accessed data

### Security Features
- **Input Validation**: All user inputs validated
- **SQL Injection Prevention**: Parameterized queries
- **Session Security**: Secure session management
- **File Upload Security**: Type and size restrictions
- **Admin Authentication**: Protected admin routes

## 📈 Current Status

**Status**: Fully functional e-commerce Telegram bot ✅

**Completed Features**:
- ✅ Complete product catalog system
- ✅ AI-powered customer consultation
- ✅ Nova Poshta delivery integration
- ✅ Order processing and CRM integration
- ✅ TTN tracking functionality
- ✅ Admin panel for management
- ✅ Modular, maintainable codebase

**Ready for Production**: Yes, with proper environment configuration.

## 🤝 Support

For technical support or questions:
- **Manager Contact**: @vidoma_manager_bot
- **Email**: support@vidoma.com.ua
- **Phone**: +38 (095) 412-61-00

---

*Generated with Claude Code - A comprehensive e-commerce Telegram bot solution.*