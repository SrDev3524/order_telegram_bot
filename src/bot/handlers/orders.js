const crmService = require('../../services/crm')

function setupOrderHandlers(bot) {
  // Handle "Order Status" button
  bot.hears('📦 Order Status', async(ctx) => {
    const telegramUserId = ctx.from.id.toString()
    
    await ctx.reply('🔍 Завантажую ваші замовлення...')

    try {
      const result = await crmService.getUserOrders(telegramUserId)
      
      if (!result.success) {
        await ctx.reply('❌ Помилка при завантаженні замовлень. Спробуйте пізніше.')
        return
      }

      if (result.orders.length === 0) {
        await ctx.reply('📦 У вас поки немає замовлень.')
        return
      }

      const ordersMessage = formatOrdersList(result.orders, result.statusOptions, result.totals)
      await ctx.reply(ordersMessage, { parse_mode: 'HTML' })

    } catch (error) {
      console.error('Order status error:', error)
      await ctx.reply('❌ Помилка при завантаженні замовлень. Спробуйте пізніше.')
    }
  })


}

// Format orders list for display
function formatOrdersList(orders, statusOptions, totals) {
  let message = `📦 <b>Ваші замовлення (${totals.count || orders.length})</b>\n\n`
  
  orders.forEach((order) => {
    // Get status text
    const statusOption = statusOptions.find(s => s.value === order.statusId)
    const statusText = statusOption ? statusOption.text : `Статус ID: ${order.statusId}`
    
    message += `<b>🔢 Замовлення #${order.id}</b>\n`
    message += `📅 Дата: ${formatDate(order.orderTime)}\n`
    message += `📊 Статус: <b>${statusText}</b>\n`
    message += `💰 Сума: ${order.paymentAmount}₴\n`
    
    // Products
    if (order.products && order.products.length > 0) {
      message += `🛍 Товари:\n`
      order.products.forEach(product => {
        message += `   • ${product.text} - ${product.amount} шт. × ${product.price}₴\n`
      })
    }
    
    // Delivery info
    if (order.ord_delivery_data && order.ord_delivery_data[0]) {
      const delivery = order.ord_delivery_data[0]
      message += `📍 Доставка: ${delivery.cityName}, ${delivery.address}\n`
      
      // TTN if available
      if (delivery.trackingNumber) {
        message += `🚚 ТТН: <code>${delivery.trackingNumber}</code>\n`
        message += `🔗 Відслідкувати: https://novaposhta.ua/tracking/?cargo_number=${delivery.trackingNumber}\n`
      }
    }
    
    message += '\n'
  })
  
  // Summary
  if (totals.paymentAmount) {
    message += `💰 <b>Загальна сума всіх замовлень: ${totals.paymentAmount}₴</b>`
  }
  
  return message
}

// Format date helper
function formatDate(dateString) {
  if (!dateString) return 'Невідомо'
  const date = new Date(dateString)
  return date.toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

module.exports = { setupOrderHandlers }
