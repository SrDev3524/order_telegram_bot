function setupSupportHandlers(bot) {
  // Handle "Менеджер" button - show contact info only
  bot.hears('💬 Менеджер', async(ctx) => {
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
