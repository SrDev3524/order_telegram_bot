const db = require('../../database/connection')
const { Telegram } = require('telegraf')

// Admin bot for forwarding messages
const ADMIN_BOT_TOKEN = process.env.ADMIN_BOT_TOKEN
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID
function setupSupportHandlers(bot) {
  // Initialize admin bot if token is provided
  let adminBot = null
  if (ADMIN_BOT_TOKEN) {
    try {
      adminBot = new Telegram(ADMIN_BOT_TOKEN)
    } catch (error) {
      console.error('Failed to initialize admin bot:', error)
    }
  }

  // Handle "Manager" button - show contact info only
  bot.hears('💬 Manager', async(ctx) => {
    const contactInfo = `💬 Зв'язок з менеджером

📞 Телефон: +38 (095) 412-61-00
📧 Email: support@vidoma.com.ua

💬 Для швидкого зв'язку напишіть нашому менеджеру:
👉 @vidoma_manager_bot

🕐 Графік роботи:
Пн-Пт: 9:00 - 18:00
Сб: 10:00 - 16:00
Нд: вихідний

Ми завжди раді вам допомогти!`

    await ctx.reply(contactInfo)
  })
}

module.exports = { setupSupportHandlers }
