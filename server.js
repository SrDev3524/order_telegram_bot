require('dotenv').config()

const express = require('express')
const { Telegraf, session } = require('telegraf')
const db = require('./src/database/connection')
const initializeBot = require('./src/bot/index')

const bot = new Telegraf(process.env.BOT_TOKEN)

bot.use(session({
  defaultSession: () => ({
    navigationStack: [{ type: 'main_menu' }],
    orderData: {},
    __scenes: {}
  })
}))

initializeBot(bot)

const adminApp = require('./src/admin/index')
const mainApp = express()

async function startServer() {
  try {
    await db.connect()
    console.log('Database connected successfully')
    
    console.log('Starting Vidoma Telegram Bot...')
    
    // Set bot instance first
    adminApp.setBotInstance(bot)
    
    // Mount admin app
    mainApp.use('/', adminApp)
    
    // Start the combined server
    const PORT = process.env.PORT || 80
    mainApp.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`)
    })
    
    // Launch bot after server starts
    await bot.launch()
    console.log('Bot launched successfully!')
    console.log('🎉 Server started successfully!')
    
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

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

startServer()

module.exports = { bot, mainApp }