const { mainReplyKeyboard } = require('../keyboards/mainKeyboard')

const messages = {
  welcome: `🏠 Вітаємо в магазині Vidoma! 🏠

Я допоможу вам обрати ідеальний домашній одяг або піжаму.

Як я можу вам допомогти сьогодні?`,

  help: `🆘 Допомога

Команди бота:
/start - Почати роботу з ботом
/help - Показати цю довідку

Кнопки меню:
🛍 Browse Products - Переглянути товари
📦 Order Status - Статус замовлення
💬 Manager - Зв'язатися з менеджером
❓ Help - Допомога`
}

function setupStartHandlers(bot) {
  // Start command - show main menu with reply keyboard
  bot.start(async(ctx) => {
    ctx.session.navigationStack = [{ type: 'main_menu' }]
    await ctx.reply(messages.welcome, mainReplyKeyboard)
  })

  // Help command
  bot.help(async(ctx) => {
    await ctx.reply(messages.help, mainReplyKeyboard)
  })

  // Handle reply keyboard buttons
  bot.hears('❓ Help', async(ctx) => {
    await ctx.reply(messages.help, mainReplyKeyboard)
  })
}

module.exports = { setupStartHandlers }
