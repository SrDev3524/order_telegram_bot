const mainReplyKeyboard = {
  reply_markup: {
    keyboard: [
      ['🛍 Browse Products', '📦 Order Status'],
      ['💬 Manager', '❓ Help']
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
