const mainReplyKeyboard = {
  reply_markup: {
    keyboard: [
      ['🛍 Переглянути товари', '📦 Статус замовлення'],
      ['💬 Менеджер', '❓ Допомога']
    ],
    resize_keyboard: true,
    persistent: true
  }
}

const removeKeyboard = {
  reply_markup: {
    remove_keyboard: true
  }
}

module.exports = {
  mainReplyKeyboard,
  removeKeyboard
}
