require('dotenv').config()

const { Telegraf, session } = require('telegraf')
const db = require('./src/database/connection')
const initializeBot = require('./src/bot/index')

// Initialize Telegram Bot
const bot = new Telegraf(process.env.BOT_TOKEN)

// Bot session configuration - MUST be before initializeBot
bot.use(session({
  defaultSession: () => ({
    navigationStack: [{ type: 'main_menu' }],
    orderData: {},
    __scenes: {}
  })
}))

// Initialize bot handlers
initializeBot(bot)

// Import and start admin panel
const adminApp = require('./src/admin/index')

// Start both services
async function startServer() {
  try {
    // Connect to database
    await db.connect()
    console.log('Database connected successfully')
    
    // Start bot
    console.log('Starting Vidoma Telegram Bot...')
    await bot.launch()
    console.log('Bot started successfully!')
    
    console.log('Admin panel running on http://localhost:3001')
    console.log('🎉 Server started successfully!')
    
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('Shutting down...')
  bot.stop('SIGINT')
  process.exit(0)
})

process.once('SIGTERM', () => {
  console.log('Shutting down...')
  bot.stop('SIGTERM')
  process.exit(0)
})

// Start the server
startServer()

module.exports = { bot, adminApp }