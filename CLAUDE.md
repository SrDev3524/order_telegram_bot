# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Vidoma E-commerce Telegram Bot** - a complete e-commerce solution with:
- **Customer Bot**: AI-powered product consultation, catalog browsing, order processing
- **Admin Panel**: Product/order management, analytics dashboard
- **Integrations**: OpenAI GPT-4, SalesDrive CRM, Nova Poshta API

## Development Commands

### Core Development
```bash
npm start              # Start both bot and admin panel
npm run dev            # Development mode with auto-reload
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

## Project Architecture

### Core Structure
```
src/
├── bot/              # Telegram Bot (Telegraf.js)
│   ├── handlers/     # Message/callback handlers
│   ├── keyboards/    # Inline/reply keyboards
│   ├── messages/     # Ukrainian localized messages
│   └── scenes/       # Multi-step conversations (Wizard scenes)
├── admin/            # Express.js admin panel
│   ├── routes/       # Admin API routes
│   ├── views/        # EJS templates
│   └── middleware/   # Authentication middleware
├── services/         # Business logic layer
│   ├── ai.js         # OpenAI GPT-4 integration
│   ├── product.js    # Product operations
│   └── csv.js        # CSV import/export
└── database/         # SQLite database layer
    └── connection.js # Database setup/queries
```

### Key Technologies
- **Bot Framework**: Telegraf.js (Telegram Bot API)
- **Admin Panel**: Express.js + EJS templates
- **Database**: SQLite3 with async/await patterns
- **AI**: OpenAI GPT-4 for customer consultation
- **Session Management**: Express sessions + Telegraf sessions
- **File Processing**: Multer (uploads), Sharp (images), CSV parsing

## Navigation System

The bot implements sophisticated back navigation using session-based navigation stacks:

```javascript
// Navigation states tracked in ctx.session.navigationStack
ctx.session.navigationStack = [
  { type: 'main_menu' },
  { type: 'categories' },
  { type: 'category_products', categoryId: 1 }
];

// Back button logic
ctx.goBack() // Returns to previous navigation state
```

Navigation states include: `main_menu`, `categories`, `category_products`, `product_details`, `size_help`, `order_flow`

## Order Processing Flow

Multi-step order collection using Telegraf Wizard scenes:
1. **Product Selection** → Size selection
2. **Customer Info** → Name and phone validation
3. **Delivery Details** → Address and Nova Poshta
4. **Payment Method** → Bank transfer or COD
5. **Order Confirmation** → Summary display
6. **CRM Integration** → Automatic SalesDrive submission

## Configuration

### Environment Setup
Copy `.env.example` to `.env` and configure:
- `BOT_TOKEN` - Telegram bot token from @BotFather
- `OPENAI_API_KEY` - OpenAI API key for AI consultation
- `CRM_API_KEY` - SalesDrive CRM integration
- `ADMIN_PASSWORD` - Admin panel authentication

### Database Schema
Core tables: `products`, `categories`, `orders`, `order_items`, `users`, `customer_inquiries`

Database initializes automatically on first run using `src/database/init.sql`.

## AI Integration

OpenAI GPT-4 handles customer consultation with context about:
- Product recommendations based on user queries
- Size guidance and fitting advice
- Style suggestions
- Fallback responses for general questions

## Admin Panel

Web interface at `http://localhost:3000` with features:
- Product management (CRUD operations)
- CSV bulk import/export
- Order processing and status updates
- Customer inquiry management
- Sales analytics dashboard

Authentication: username `admin`, password from `ADMIN_PASSWORD` env var.

## Testing Strategy

- **Jest** for unit testing
- **Supertest** for API endpoint testing
- Test database isolation
- Mock external services (OpenAI, CRM)

## CSV Import Format

Products CSV structure:
```csv
post_title,sku,regular_price,sale_price,categories,post_content,stock,images
"Product Name","SKU123",1200,1000,"Category","Description",10,"[""image1.jpg""]"
```

## Security Considerations

- Input validation using Joi schemas
- Rate limiting on bot and admin endpoints
- Session security with secure cookies
- SQL injection prevention with parameterized queries
- File upload restrictions (type, size)
- Admin authentication for sensitive operations

## Development Notes

- Ukrainian language throughout bot interface
- Comprehensive error handling and logging (Winston)
- Session state management for complex flows
- Image processing with Sharp for uploads
- CORS and Helmet for admin panel security