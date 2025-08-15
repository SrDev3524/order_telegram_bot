const { Scenes } = require('telegraf')
const aiService = require('../services/ai')
const orderWizard = require('./scenes/orderWizard')

const { setupStartHandlers } = require('./handlers/start')
const { setupProductHandlers } = require('./handlers/products')
const { setupOrderHandlers } = require('./handlers/orders')
const { setupSupportHandlers } = require('./handlers/support')

function initializeBot(bot) {
  const stage = new Scenes.Stage([orderWizard])
  bot.use(stage.middleware())

  bot.use(async(ctx, next) => {
    if (ctx.from) {
      ctx.user = {
        id: ctx.from.id,
        username: ctx.from.username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name
      }
    }
    return next()
  })

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

  setupStartHandlers(bot)
  setupProductHandlers(bot)
  setupOrderHandlers(bot)
  setupSupportHandlers(bot)

  bot.on('text', async(ctx) => {
    if (ctx.session.supportMessage) {
      return
    }

    if (ctx.session.__scenes?.current && !ctx.scene?.state?.completed) {
      return
    }

    if (ctx.session.aiSearchMode) {
      try {
        await ctx.sendChatAction('typing')

        const aiResponse = await aiService.getProductRecommendations(
          ctx.message.text,
          ctx.user.id
        )

        const keyboard = aiService.createRecommendationKeyboard(aiResponse.recommendedProducts)
        await ctx.reply(aiResponse.text, keyboard)
      } catch (error) {
        console.error('Error in AI consultation:', error)
        await ctx.reply(`❌ Вибачте, виникла помилка з AI помічником.

Щоб повернутися до головного меню, використайте /start`)
        ctx.session.aiSearchMode = false
      }
      return
    }

    await ctx.reply(`📝 Дякуємо за повідомлення!

Щоб переглянути товари або використати AI помічник, натисніть 🛍 Переглянути товари.
Для повернення до головного меню використайте /start`)
  })

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
