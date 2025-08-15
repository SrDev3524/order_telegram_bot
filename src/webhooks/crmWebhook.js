async function handleCRMWebhook(bot, webhookData) {
  try {
    console.log('CRM Webhook received:', JSON.stringify(webhookData, null, 2))

    const data = webhookData.data || webhookData

    if (!data.id && !data.externalId && !webhookData.externalId) {
      console.log('No order ID in webhook data')
      return { success: false, message: 'No order ID provided' }
    }

    // Generate proper order number instead of using Telegram user ID
    let orderId = data.id || webhookData.id
    if (!orderId || orderId.toString().length > 8) {
      // If no proper ID or if ID looks like a Telegram user ID (very long), generate one
      orderId = Date.now().toString().slice(-6) // Use last 6 digits of timestamp
    }
    console.log('Full webhook data:', JSON.stringify(data, null, 2))

    // Extract Telegram user ID for messaging (separate from order ID)
    const customerTelegram = data.externalId || webhookData.externalId

    if (customerTelegram) {
      console.log('Found Telegram ID in externalId:', customerTelegram)
    }

    if (!customerTelegram && data.contacts && data.contacts[0]) {
      console.log('First contact:', JSON.stringify(data.contacts[0], null, 2))
      const contact = data.contacts[0]
      if (contact.telegram) {
        console.log('Found telegram username:', contact.telegram)
      }
    }

    if (!customerTelegram) {
      console.log(`No Telegram contact found in webhook data for order: ${orderId}`)
      console.log('Available contact fields:', data.contacts && data.contacts[0] ? Object.keys(data.contacts[0]) : 'No contacts')
      return { success: false, message: 'No Telegram contact found' }
    }

    console.log(`Found customer Telegram: ${customerTelegram}`)

    let ttn = null

    if (data.ttn || data.TTN) {
      ttn = data.ttn || data.TTN
    } else if (data.trackingNumber) {
      ttn = data.trackingNumber
    } else if (data.ord_novaposhta) {
      ttn = data.ord_novaposhta.EN || data.ord_novaposhta.en || data.ord_novaposhta.ttn || data.ord_novaposhta.TTN
    } else if (data.novaposhta) {
      ttn = data.novaposhta.EN || data.novaposhta.en || data.novaposhta.ttn || data.novaposhta.TTN
    }

    console.log('TTN check:', {
      ttn,
      hasOrdNovaposhta: !!data.ord_novaposhta,
      hasNovaposhta: !!data.novaposhta,
      allFields: Object.keys(data)
    })

    if (ttn) {
      await bot.telegram.sendMessage(
        customerTelegram,
        `📦 Ваше замовлення #${orderId} відправлено!\n\n` +
        `🚚 Номер накладної (ТТН): ${ttn}\n\n` +
        `Відслідкувати посилку: https://novaposhta.ua/tracking/?cargo_number=${ttn}`
      )

      console.log(`TTN ${ttn} sent to customer ${customerTelegram}`)
      return { success: true, message: 'TTN notification sent' }
    }

    if (data.statusId && webhookData.meta?.fields?.statusId?.options) {
      const statusOption = webhookData.meta.fields.statusId.options.find(opt => opt.value === data.statusId)
      const statusText = statusOption ? statusOption.text : `Статус ID: ${data.statusId}`

      let message = `📋 Оновлення замовлення #${orderId}\n\n`
      message += `📊 Статус: ${statusText}\n`
      message += `📅 Час замовлення: ${data.orderTime}\n\n`

      if (data.products && data.products.length > 0) {
        message += '🛍 Товари:\n'
        data.products.forEach((product, index) => {
          message += `${index + 1}. ${product.name}\n`
          message += `   💰 Ціна: ${product.price}₴\n`
          message += `   📦 Кількість: ${product.amount}\n\n`
        })
      }

      if (data.shipping_address) {
        message += `📍 Адреса доставки: ${data.shipping_address}\n`
      }

      if (data.payment_method && webhookData.meta?.fields?.payment_method?.options) {
        const paymentOption = webhookData.meta.fields.payment_method.options.find(opt => opt.value === data.payment_method)
        const paymentText = paymentOption ? paymentOption.text : `Метод ID: ${data.payment_method}`
        message += `💳 Спосіб оплати: ${paymentText}\n`
      }

      if (data.ord_novaposhta) {
        message += '\n🚚 Інформація Nova Poshta:\n'
        if (data.ord_novaposhta.cityName) {
          message += `📍 Місто: ${data.ord_novaposhta.cityName}\n`
        }
        if (data.ord_novaposhta.branchName) {
          message += `📦 Відділення: ${data.ord_novaposhta.branchName}\n`
        }
        if (data.ord_novaposhta.EN) {
          message += `📮 ТТН: ${data.ord_novaposhta.EN}\n`
          message += `🔗 Відслідкувати: https://novaposhta.ua/tracking/?cargo_number=${data.ord_novaposhta.EN}\n`
        }
      }

      if (data.paymentAmount) {
        message += `\n💰 Загальна сума: ${data.paymentAmount}₴`
      }

      await bot.telegram.sendMessage(
        customerTelegram,
        message
      )

      console.log(`Status ${statusText} sent to customer ${customerTelegram}`)
      return { success: true, message: 'Status notification sent' }
    }

    if (data.confirmed) {
      await bot.telegram.sendMessage(
        customerTelegram,
        `✅ Ваше замовлення #${orderId} підтверджено менеджером!\n\n` +
        'Очікуйте на відправку. Ми повідомимо вас про номер накладної.'
      )

      return { success: true, message: 'Confirmation notification sent' }
    }

    return { success: false, message: 'No action taken' }
  } catch (error) {
    console.error('Webhook handler error:', error)
    return { success: false, message: error.message }
  }
}

module.exports = { handleCRMWebhook }
