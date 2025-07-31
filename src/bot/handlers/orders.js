const db = require('../../database/connection')
const axios = require('axios')

function setupOrderHandlers(bot) {
  // Handle "Order Status" button
  bot.hears('📦 Order Status', async(ctx) => {
    ctx.session.orderTracking = true

    await ctx.reply(
      '📦 Відстеження замовлення\n\n' +
      'Введіть номер ТТН або номер телефону для перевірки статусу доставки:',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Мої замовлення', callback_data: 'my_orders' }],
            [{ text: '❌ Скасувати', callback_data: 'cancel_tracking' }]
          ]
        }
      }
    )
  })

  // My orders list
  bot.action('my_orders', async(ctx) => {
    try {
      const orders = await db.all(`
        SELECT o.*, 
               GROUP_CONCAT(p.name || ' x' || oi.quantity) as items
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.user_id = ?
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT 10
      `, [ctx.user.id])

      if (orders.length === 0) {
        await ctx.editMessageText(
          '📦 Мої замовлення\n\nУ вас поки немає замовлень.\n\nПочніть покупки в каталозі товарів! 🛍'
        )
        return
      }

      const statusEmojis = {
        pending: '⏳',
        confirmed: '✅',
        shipped: '🚚',
        delivered: '📦',
        cancelled: '❌'
      }

      const statusNames = {
        pending: 'В обробці',
        confirmed: 'Підтверджено',
        shipped: 'Відправлено',
        delivered: 'Доставлено',
        cancelled: 'Скасовано'
      }

      let ordersList = '📦 Мої замовлення\n\n'

      orders.forEach((order) => {
        const emoji = statusEmojis[order.status] || '❓'
        const status = statusNames[order.status] || order.status
        const date = new Date(order.created_at).toLocaleDateString('uk-UA')

        ordersList += `${emoji} Замовлення #${order.order_number || order.id}\n`
        ordersList += `📅 ${date}\n`
        ordersList += `💰 ${order.total_amount}₴\n`
        ordersList += `📋 ${status}\n`
        if (order.items) {
          ordersList += `🛍 ${order.items}\n`
        }
        if (order.ttn) {
          ordersList += `📮 ТТН: ${order.ttn}\n`
        }
        ordersList += '\n'
      })

      await ctx.editMessageText(ordersList)
    } catch (error) {
      console.error('Error loading orders:', error)
      await ctx.editMessageText('❌ Помилка завантаження замовлень.')
    }
  })

  // Cancel tracking
  bot.action('cancel_tracking', async(ctx) => {
    ctx.session.orderTracking = false
    await ctx.deleteMessage()
  })

  // Handle TTN tracking input
  bot.on('text', async(ctx, next) => {
    if (!ctx.session.orderTracking) {
      return next()
    }

    const input = ctx.message.text.trim()

    // Check if it's TTN (20 digits) or phone number
    const isTTN = /^\d{14}$/.test(input)
    const isPhone = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{4,6}$/.test(input)

    if (!isTTN && !isPhone) {
      await ctx.reply('❌ Неправильний формат. Введіть номер ТТН (14 цифр) або номер телефону.')
      return
    }

    await ctx.reply('⏳ Перевіряємо статус доставки...')

    try {
      if (isTTN) {
        // Track by TTN using Nova Poshta API
        const trackingData = await trackByTTN(input)
        await ctx.reply(formatTrackingInfo(trackingData))
      } else {
        // Find orders by phone number
        const orders = await db.all(`
          SELECT * FROM orders 
          WHERE customer_phone LIKE ? 
          ORDER BY created_at DESC 
          LIMIT 5
        `, [`%${input.replace(/\D/g, '')}%`])

        if (orders.length === 0) {
          await ctx.reply('❌ Замовлення з таким номером телефону не знайдено.')
        } else {
          let result = '📦 Знайдені замовлення:\n\n'
          for (const order of orders) {
            result += `Замовлення #${order.order_number || order.id}\n`
            result += `Статус: ${order.status}\n`
            if (order.ttn) {
              result += `ТТН: ${order.ttn}\n`
            }
            result += '\n'
          }
          await ctx.reply(result)
        }
      }
    } catch (error) {
      console.error('Tracking error:', error)
      await ctx.reply('❌ Помилка при перевірці статусу. Спробуйте пізніше.')
    }

    ctx.session.orderTracking = false
  })
}

// Track by TTN using Nova Poshta API
async function trackByTTN(ttn) {
  const apiKey = process.env.NOVA_POSHTA_API_KEY
  
  if (!apiKey) {
    throw new Error('Nova Poshta API key not configured')
  }

  try {
    const response = await axios.post('https://api.novaposhta.ua/v2.0/json/', {
      apiKey,
      modelName: 'TrackingDocument',
      calledMethod: 'getStatusDocuments',
      methodProperties: {
        Documents: [{ DocumentNumber: ttn }]
      }
    })

    if (response.data.success && response.data.data[0]) {
      return response.data.data[0]
    } else {
      throw new Error('TTN not found')
    }
  } catch (error) {
    throw error
  }
}

// Format tracking information
function formatTrackingInfo(data) {
  if (!data || !data.Status) {
    return '❌ Інформація про відправлення не знайдена.'
  }

  let result = '📦 Статус доставки\n\n'
  result += `📮 ТТН: ${data.Number}\n`
  result += `📋 Статус: ${data.Status}\n`

  if (data.WarehouseSender) {
    result += `📍 Відправлення: ${data.WarehouseSender}\n`
  }

  if (data.WarehouseRecipient) {
    result += `📍 Отримання: ${data.WarehouseRecipient}\n`
  }

  if (data.DateCreated) {
    result += `📅 Дата створення: ${new Date(data.DateCreated).toLocaleDateString('uk-UA')}\n`
  }

  if (data.ScheduledDeliveryDate) {
    result += `🚚 Очікувана доставка: ${new Date(data.ScheduledDeliveryDate).toLocaleDateString('uk-UA')}\n`
  }

  return result
}

module.exports = { setupOrderHandlers }
