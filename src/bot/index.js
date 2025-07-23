const { Scenes } = require('telegraf')
const db = require('../database/connection')
const aiService = require('../services/ai')
const orderWizard = require('./scenes/orderWizard')

// Import handlers
const { setupStartHandlers } = require('./handlers/start')
const { setupProductHandlers } = require('./handlers/products')
const { setupOrderHandlers } = require('./handlers/orders')
const { setupSupportHandlers } = require('./handlers/support')

function initializeBot(bot) {
  // Setup scenes (session already configured in server.js)
  const stage = new Scenes.Stage([orderWizard])
  bot.use(stage.middleware())

  // Middleware to register/update user
  bot.use(async(ctx, next) => {
    if (ctx.from) {
      try {
        const existingUser = await db.get(
          'SELECT * FROM users WHERE telegram_id = ?',
          [ctx.from.id]
        )

        if (!existingUser) {
          await db.run(`
            INSERT INTO users (telegram_id, username, first_name, last_name)
            VALUES (?, ?, ?, ?)
          `, [
            ctx.from.id,
            ctx.from.username || null,
            ctx.from.first_name || null,
            ctx.from.last_name || null
          ])
          
          // Get the newly created user with ID
          ctx.user = await db.get(
            'SELECT * FROM users WHERE telegram_id = ?',
            [ctx.from.id]
          )
        } else {
          await db.run(`
            UPDATE users 
            SET username = ?, first_name = ?, last_name = ?, updated_at = datetime('now')
            WHERE telegram_id = ?
          `, [
            ctx.from.username || null,
            ctx.from.first_name || null,
            ctx.from.last_name || null,
            ctx.from.id
          ])
          ctx.user = existingUser
        }
      } catch (error) {
        console.error('Error handling user:', error)
      }
    }
    return next()
  })

  // Navigation helpers
  bot.context.goBack = function() {
    if (this.session.navigationStack && this.session.navigationStack.length > 1) {
      this.session.navigationStack.pop()
      return this.session.navigationStack[this.session.navigationStack.length - 1]
    }
    return { type: 'main_menu' }
  }

  bot.context.pushNavigation = function(state) {
    if (!this.session.navigationStack) {
      this.session.navigationStack = []
    }
    this.session.navigationStack.push(state)
  }

  // Setup handlers
  setupStartHandlers(bot)
  setupProductHandlers(bot)
  setupOrderHandlers(bot)
  setupSupportHandlers(bot)

  // Handle text messages (AI consultation) - fallback
  bot.on('text', async(ctx) => {
    // Skip if in special modes
    if (ctx.session.supportMessage || ctx.session.orderTracking) {
      return
    }

    try {
      const user = await db.get(
        'SELECT id FROM users WHERE telegram_id = ?',
        [ctx.from.id]
      )

      if (user) {
        // Save inquiry for admin review
        await db.run(`
          INSERT INTO customer_inquiries (user_id, message)
          VALUES (?, ?)
        `, [user.id, ctx.message.text])

        // Show typing indicator
        await ctx.sendChatAction('typing')

        // Get AI consultation
        const aiResponse = await aiService.getProductRecommendations(
          ctx.message.text,
          user.id
        )

        // Send AI response with product recommendations
        const keyboard = aiService.createRecommendationKeyboard(aiResponse.recommendedProducts)
        await ctx.reply(aiResponse.text, keyboard)
      }
    } catch (error) {
      console.error('Error in AI consultation:', error)
      await ctx.reply(`❌ Вибачте, виникла помилка. Ваше повідомлення збережено, і ми відповімо вручну.

Щоб повернутися до головного меню, використайте /start`)
    }
  })

  // Error handling
  bot.catch((err, ctx) => {
    console.error('Bot error:', err)
    try {
      ctx.reply('❌ Виникла помилка. Спробуйте пізніше або використайте /start')
    } catch (e) {
      console.error('Failed to send error message:', e)
    }
  })
}

module.exports = initializeBot