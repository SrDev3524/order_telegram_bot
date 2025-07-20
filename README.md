# 🛍️ Vidoma E-commerce Telegram Bot

A complete e-commerce Telegram bot for **Vidoma** - home and sleepwear store. Features AI-powered customer consultation, automated order processing, CRM integration, and comprehensive back navigation.

## ✨ Features

### 🤖 Customer Bot Features
- **AI-Powered Consultation** - OpenAI GPT-4 integration for product recommendations
- **Smart Navigation** - Complete back button logic throughout the bot
- **Product Catalog** - Browse by categories with product images and details
- **Size Assistant** - Interactive size guide and recommendations
- **Order Processing** - Multi-step order collection with validation
- **Order Tracking** - Check delivery status via phone/TTN
- **Customer Support** - Direct messaging to managers
- **Ukrainian Language** - Fully localized for Ukrainian customers

### 🔧 Admin Features
- **Product Management** - Add, edit, delete products
- **CSV Import/Export** - Bulk product management
- **Order Management** - View and process orders
- **Category Management** - Organize product hierarchy
- **Customer Support** - Manage customer inquiries
- **Analytics Dashboard** - Sales and user statistics

### 🎯 Integrations
- **SalesDrive CRM** - Automatic order submission
- **OpenAI GPT-4** - AI customer consultation
- **Nova Poshta API** - Delivery tracking (ready for integration)
- **SQLite Database** - Lightweight data storage

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 16+ 
- npm 8+
- Telegram Bot Token ([Get from @BotFather](https://t.me/BotFather))
- OpenAI API Key ([Get from OpenAI](https://platform.openai.com/api-keys))

### 2. Installation

```bash
# Clone repository
git clone https://github.com/your-repo/vidoma-bot.git
cd vidoma-bot

# Install dependencies
npm install

# Run setup wizard
npm run setup
```

### 3. Configuration

The setup wizard will guide you through configuration, or manually edit `.env`:

```bash
# Required configurations
TELEGRAM_BOT_TOKEN=your_bot_token
OPENAI_API_KEY=your_openai_key
CRM_API_KEY=your_crm_key (provided)
```

### 4. Import Products

Place your `products.csv` file in the `data/` folder:

```bash
# Import products from CSV
npm run import-csv
```

CSV format:
```csv
post_title,sku,regular_price,sale_price,categories,post_content,stock,images
"Product Name","SKU123",1200,1000,"Category","Description",10,"[""image1.jpg""]"
```

### 5. Start the Bot

```bash
# Start the bot
npm start

# Or with auto-reload during development
npm run dev

# Start admin panel (separate terminal)
npm run admin
```

## 📱 Bot Usage

### Customer Flow

1. **Start** - `/start` command shows welcome message
2. **Browse Products** - View categories and products
3. **AI Consultation** - Ask questions about products
4. **Order Process** - Multi-step order collection:
   - Product selection
   - Customer name
   - Phone number
   - Delivery address
   - Payment method
   - Order confirmation
5. **Order Tracking** - Check status via phone/TTN
6. **Customer Support** - Contact manager directly

### Admin Panel

Access at `http://localhost:3000`:
- **Username:** `admin`
- **Password:** `admin123` (configurable)

Features:
- Product management
- Order processing
- Customer inquiries
- Analytics dashboard

## 🗂️ Project Structure

```
vidoma-bot/
├── src/
│   ├── bot/                    # Telegram Bot Components
│   │   ├── handlers/           # Message handlers
│   │   ├── keyboards/          # Keyboard layouts
│   │   ├── messages/           # Ukrainian messages
│   │   └── scenes/             # Multi-step flows
│   ├── services/               # Business Logic
│   │   ├── ai.js              # OpenAI integration
│   │   ├── crm.js             # SalesDrive CRM
│   │   ├── product.js         # Product operations
│   │   └── csv.js             # CSV import/export
│   ├── database/               # Database Layer
│   └── admin/                  # Admin Panel (future)
├── data/                       # Data Storage
│   ├── database.sqlite         # SQLite database
│   ├── products.csv           # Product import file
│   └── uploads/               # Image uploads
├── scripts/                    # Utility Scripts
└── logs/                      # Application logs
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | ✅ |
| `OPENAI_API_KEY` | OpenAI API key | ✅ |
| `CRM_API_KEY` | SalesDrive CRM key | ✅ |
| `ADMIN_CHAT_ID` | Admin Telegram ID for notifications | ❌ |
| `ADMIN_PASSWORD` | Admin panel password | ❌ |

### Features Toggle

```bash
AI_ENABLED=true           # Enable AI consultation
CRM_ENABLED=true          # Enable CRM integration
CSV_IMPORT_ENABLED=true   # Enable CSV import
ADMIN_PANEL_ENABLED=true  # Enable admin panel
```

## 🎯 Bot Commands

### Customer Commands
- `/start` - Start the bot
- `/help` - Show help information
- **Browse Products** - View product catalog
- **Order Status** - Track delivery
- **Contact Manager** - Customer support

### Admin Commands (in admin chat)
- `/stats` - User and order statistics
- `/orders` - Recent orders
- `/inquiries` - Customer messages

## 📊 Database Schema

### Core Tables
- **products** - Product catalog
- **categories** - Product categories
- **orders** - Customer orders
- **order_items** - Order details
- **users** - Bot users
- **customer_inquiries** - Support messages

## 🔄 Back Navigation Logic

The bot implements comprehensive back navigation:

```javascript
// Navigation stack tracks user journey
ctx.session.navigationStack = [
  { type: 'main_menu' },
  { type: 'categories' },
  { type: 'category_products', categoryId: 1 },
  { type: 'product_details', productId: 123 }
];

// Back button returns to previous state
ctx.goBack() // Returns to category_products
```

States handled:
- `main_menu` - Main bot menu
- `categories` - Category selection
- `category_products` - Products in category
- `product_details` - Product information
- `size_help` - Size assistance
- `order_flow` - Order process steps

## 🤖 AI Integration

The bot uses OpenAI GPT-4 for customer consultation:

```javascript
// AI consultation example
User: "Мені потрібна піжама для сну"
AI: "Рекомендую переглянути нашу колекцію піжам! 
У нас є комфортні костюми з м'яких тканин. 
🛍️ Переглянути піжами в каталозі"
```

AI capabilities:
- Product recommendations
- Size consultation  
- Style advice
- General assistance
- Fallback responses

## 📦 Order Processing

### Order Flow
1. **Product Selection** - Choose item and size
2. **Customer Info** - Name and phone validation
3. **Delivery** - Address and Nova Poshta details
4. **Payment** - Method selection
5. **Confirmation** - Order summary
6. **CRM Submission** - Automatic processing
7. **Confirmation** - Success message

### Payment Methods
- Bank transfer
- Cash on delivery

### Delivery Options
- Nova Poshta (warehouse pickup)
- Nova Poshta (courier delivery)

## 🛠️ Development

### Development Mode
```bash
npm run dev  # Auto-reload on changes
```

### Testing
```bash
npm test    # Run test suite
```

### CSV Import
```bash
npm run import-csv  # Import products from data/products.csv
```

### Logging
Logs are written to `logs/` directory:
- `error.log` - Error messages
- `combined.log` - All messages
- Console output during development

## 🚀 Deployment

### Production Setup
1. Set `NODE_ENV=production`
2. Configure webhook (optional)
3. Set up SSL certificates
4. Configure admin notifications
5. Set up monitoring

### Webhook Mode
```bash
WEBHOOK_DOMAIN=yourdomain.com
WEBHOOK_PORT=8443
WEBHOOK_PATH=/webhook
```

### Process Management
```bash
# Using PM2
pm2 start bot.js --name vidoma-bot
pm2 start server.js --name vidoma-admin
```

## 🔒 Security

- Input validation on all user inputs
- Rate limiting on API calls
- Secure session management
- CORS protection
- SQL injection prevention
- Admin authentication

## 📈 Monitoring

### Statistics Available
- User registrations
- Active users
- Order conversions
- Popular products
- AI consultation usage
- Error rates

### Health Checks
- Database connectivity
- CRM API status
- OpenAI API status
- Bot responsiveness

## 🆘 Troubleshooting

### Common Issues

**Bot not responding:**
```bash
# Check bot token
node -e "console.log(process.env.TELEGRAM_BOT_TOKEN)"

# Test bot connection
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"
```

**Database errors:**
```bash
# Reinitialize database
rm data/database.sqlite
npm start  # Will recreate tables
```

**CRM integration issues:**
```bash
# Test CRM connection
node -e "
const crm = require('./src/services/crm');
crm.testConnection().then(console.log);
"
```

### Log Analysis
```bash
# View recent errors
tail -f logs/error.log

# Search for specific issues
grep "CRM" logs/combined.log
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file.

## 🔗 Support

- 📧 Email: support@vidoma.com
- 💬 Telegram: @vidoma_support
- 🐛 Issues: [GitHub Issues](https://github.com/your-repo/vidoma-bot/issues)

---

**Ready to launch your Vidoma bot! 🚀**

Start with `npm run setup` and follow the wizard.