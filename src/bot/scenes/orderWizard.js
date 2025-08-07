const { Scenes, Markup } = require('telegraf')
const db = require('../../database/connection')
const crmService = require('../../services/crm')
const novaPoshtaService = require('../../services/novaPoshta')

// Helper function to clear all timeouts
const clearAllTimeouts = (ctx) => {
  if (ctx.scene.state.timeoutId) {
    clearTimeout(ctx.scene.state.timeoutId)
    ctx.scene.state.timeoutId = null
  }
}

// Helper function to set timeout
const setOrderTimeout = (ctx) => {
  // Clear any existing timeout first
  clearAllTimeouts(ctx)

  const timeoutId = setTimeout(() => {
    // Clear the timeout immediately to prevent repeated messages
    clearAllTimeouts(ctx)

    ctx.reply(
      '⏱️ Час очікування вичерпано. Замовлення скасовано.\n\n' +
      'Щоб розпочати нове замовлення, використайте /start',
      Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Головне меню', 'main_menu')]
      ])
    )
    ctx.scene.leave()
  }, 300000) // 5 minutes

  ctx.scene.state.timeoutId = timeoutId
}

const orderWizard = new Scenes.WizardScene(
  'order-wizard',

  // Step 1: Color selection (if available)
  async(ctx) => {
    setOrderTimeout(ctx)

    const productId = ctx.scene.state.productId
    if (!productId) {
      clearAllTimeouts(ctx)
      await ctx.reply('❌ Помилка: не вказано товар.')
      return ctx.scene.leave()
    }

    const product = await db.get('SELECT * FROM products WHERE id = ?', [productId])

    if (!product) {
      clearAllTimeouts(ctx)
      await ctx.reply('❌ Товар не знайдено.')
      return ctx.scene.leave()
    }

    ctx.scene.state.product = product

    // Parse product variants
    let variants = { colors: [], sizes: [] }
    try {
      if (product.description) {
        variants = JSON.parse(product.description)
      }
    } catch (e) {
      console.log('Failed to parse product variants')
    }

    ctx.scene.state.availableColors = variants.colors || []
    ctx.scene.state.availableSizes = variants.sizes || []

    // If product has colors, show color selection
    if (ctx.scene.state.availableColors.length > 0) {
      const colorButtons = ctx.scene.state.availableColors.map(color => 
        [Markup.button.callback(color, `color_${color}`)]
      )

      await ctx.reply(
        `🛒 Оформлення замовлення\n\n📦 Товар: ${product.name}\n💰 Ціна: ${product.sale_price || product.price}₴\n\n🎨 Оберіть колір:`,
        Markup.inlineKeyboard([
          ...colorButtons,
          [Markup.button.callback('❌ Скасувати', 'cancel_order')]
        ])
      )
      return ctx.wizard.next()
    } else {
      // Skip to size selection if no colors
      ctx.scene.state.selectedColor = null
      return ctx.wizard.selectStep(2)
    }
  },

  // Step 2: Size selection (if available)
  async(ctx) => {
    // If we came from a callback query
    if (ctx.callbackQuery) {
      // Handle color selection
      const colorMatch = ctx.callbackQuery.data.match(/^color_(.+)$/)
      if (colorMatch) {
        ctx.scene.state.selectedColor = colorMatch[1]
        await ctx.answerCbQuery()
      }
      
      // Handle size guide
      if (ctx.callbackQuery.data === 'size_guide') {
        await ctx.answerCbQuery()
        const sizeButtons = []
        const sizesPerRow = 3
        
        for (let i = 0; i < ctx.scene.state.availableSizes.length; i += sizesPerRow) {
          const row = ctx.scene.state.availableSizes
            .slice(i, i + sizesPerRow)
            .map(size => Markup.button.callback(size, `size_${size}`))
          sizeButtons.push(row)
        }

        await ctx.editMessageText(
          '📖 Довідка по розмірах\n\n' +
          'XS - обхват грудей: 82-86 см\n' +
          'S - обхват грудей: 86-90 см\n' +
          'M - обхват грудей: 90-94 см\n' +
          'L - обхват грудей: 94-98 см\n' +
          'XL - обхват грудей: 98-102 см\n' +
          'XXL - обхват грудей: 102-106 см\n' +
          '3XL - обхват грудей: 106-110 см\n' +
          '4XL - обхват грудей: 110-114 см\n' +
          '5XL - обхват грудей: 114-118 см\n\n' +
          'Оберіть ваш розмір:',
          Markup.inlineKeyboard([
            ...sizeButtons,
            [Markup.button.callback('❌ Скасувати', 'cancel_order')]
          ])
        )
        return
      }
    }

    // If product has sizes, show size selection
    if (ctx.scene.state.availableSizes.length > 0) {
      const sizeButtons = []
      const sizesPerRow = 3
      
      for (let i = 0; i < ctx.scene.state.availableSizes.length; i += sizesPerRow) {
        const row = ctx.scene.state.availableSizes
          .slice(i, i + sizesPerRow)
          .map(size => Markup.button.callback(size, `size_${size}`))
        sizeButtons.push(row)
      }

      let message = `📏 Оберіть розмір:`
      if (ctx.scene.state.selectedColor) {
        message = `Колір: ${ctx.scene.state.selectedColor}\n\n${message}`
      }

      await ctx.reply(
        message,
        Markup.inlineKeyboard([
          ...sizeButtons,
          [Markup.button.callback('📖 Довідка по розмірах', 'size_guide')],
          [Markup.button.callback('❌ Скасувати', 'cancel_order')]
        ])
      )
      return ctx.wizard.next()
    } else {
      // Skip to customer name if no sizes
      ctx.scene.state.selectedSize = null
      return ctx.wizard.selectStep(3)
    }
  },

  // Step 3: Customer first name
  async(ctx) => {
    // If we came from a callback query (size selection)
    if (ctx.callbackQuery) {
      const sizeMatch = ctx.callbackQuery.data.match(/^size_(.+)$/)
      if (sizeMatch) {
        ctx.scene.state.selectedSize = sizeMatch[1]
        await ctx.answerCbQuery()
      }
    }

    setOrderTimeout(ctx)

    let orderDetails = `🛒 Ваше замовлення:\n📦 ${ctx.scene.state.product.name}\n`
    if (ctx.scene.state.selectedColor) {
      orderDetails += `🎨 Колір: ${ctx.scene.state.selectedColor}\n`
    }
    if (ctx.scene.state.selectedSize) {
      orderDetails += `📏 Розмір: ${ctx.scene.state.selectedSize}\n`
    }
    orderDetails += `💰 Ціна: ${ctx.scene.state.product.sale_price || ctx.scene.state.product.price}₴\n\n`

    await ctx.reply(
      orderDetails + '👤 Введіть ваше ім\'я:',
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ Скасувати', 'cancel_order')]
      ])
    )

    return ctx.wizard.next()
  },

  // Step 4: Customer last name
  async(ctx) => {
    // Reset timeout on user activity
    setOrderTimeout(ctx)

    if (!ctx.message?.text) {
      await ctx.reply('❌ Будь ласка, введіть ваше ім\'я текстом.')
      return
    }

    ctx.scene.state.customerFirstName = ctx.message.text.trim()

    await ctx.reply(
      '👤 Введіть ваше прізвище:',
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ Скасувати', 'cancel_order')]
      ])
    )

    return ctx.wizard.next()
  },

  // Step 5: Phone number
  async(ctx) => {
    // Reset timeout on user activity
    setOrderTimeout(ctx)

    if (!ctx.message?.text) {
      await ctx.reply('❌ Будь ласка, введіть ваше прізвище текстом.')
      return
    }

    ctx.scene.state.customerLastName = ctx.message.text.trim()
    ctx.scene.state.customerName = `${ctx.scene.state.customerFirstName} ${ctx.scene.state.customerLastName}`

    await ctx.reply(
      '📱 Введіть ваш номер телефону:\n(наприклад: +380501234567)',
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ Скасувати', 'cancel_order')]
      ])
    )

    return ctx.wizard.next()
  },

  // Step 6: Delivery method (Nova Poshta city)
  async(ctx) => {
    // Reset timeout on user activity
    setOrderTimeout(ctx)

    if (!ctx.message?.text) {
      await ctx.reply('❌ Будь ласка, введіть номер телефону.')
      return
    }

    const phone = ctx.message.text.trim()
    if (!/^\+?3?8?0\d{9}$/.test(phone.replace(/[-\s()]/g, ''))) {
      await ctx.reply('❌ Неправильний формат телефону. Спробуйте ще раз:\n(наприклад: +380501234567)')
      return
    }

    ctx.scene.state.customerPhone = phone

    await ctx.reply(
      '📦 Доставка через Нова Пошта\n\nВведіть назву вашого міста:',
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ Скасувати', 'cancel_order')]
      ])
    )

    // Set delivery method and city input mode directly
    ctx.scene.state.deliveryMethod = 'Нова Пошта'
    ctx.scene.state.waitingForCity = true

    return ctx.wizard.next()
  },

  // Step 7: Handle Nova Poshta city search and warehouse selection
  async(ctx) => {
    if (ctx.message || ctx.callbackQuery) {
      setOrderTimeout(ctx)
    }

    // Handle change city request in step 7
    if (ctx.callbackQuery?.data === 'change_city') {
      await ctx.answerCbQuery()
      ctx.scene.state.waitingForCity = true
      ctx.scene.state.selectedCity = null
      ctx.scene.state.availableWarehouses = null
      ctx.scene.state.selectedWarehouse = null

      await ctx.editMessageText(
        '🏙️ Введіть назву вашого міста для доставки Нова Пошта:\n\n' +
        '💡 Підказка: використовуйте українську мову\n' +
        'Наприклад: Київ, Харків, Львів, Одеса',
        Markup.inlineKeyboard([
          [Markup.button.callback('❌ Скасувати', 'cancel_order')]
        ])
      )
      return
    }

    // Handle city input for Nova Poshta
    if (ctx.scene.state.waitingForCity && ctx.message?.text) {
      const cityName = ctx.message.text.trim()
      await ctx.reply('🔍 Шукаємо ваше місто...')

      try {
        const cities = await novaPoshtaService.searchCities(cityName)

        if (cities.length === 0) {
          await ctx.reply(
            `❌ Місто "${cityName}" не знайдено.\n\n` +
            '💡 Підказка: Введіть назву міста українською мовою.\n' +
            'Наприклад: Київ, Харків, Львів, Одеса\n\n' +
            'Спробуйте ще раз:',
            Markup.inlineKeyboard([
              [Markup.button.callback('❌ Скасувати замовлення', 'cancel_order')]
            ])
          )
          // Stay in the same step to allow retry
          return
        }

        if (cities.length === 1) {
          // Only one city found, ask for manual branch input
          ctx.scene.state.selectedCity = cities[0]
          ctx.scene.state.waitingForCity = false
          ctx.scene.state.waitingForWarehouseNumber = true

          await ctx.reply(
            `📦 Місто ${cities[0].name} обрано.\n\n` +
            '✍️ Введіть номер відділення або поштомату Нова Пошта:\n\n' +
            '💡 Приклади:\n' +
            '• Для відділення: 1, 2, 142\n' +
            '• Для поштомату: 5310, 26571\n\n' +
            'ℹ️ Ви можете знайти номер на сайті Нова Пошта або у додатку',
            Markup.inlineKeyboard([
              [Markup.button.callback('⬅ Змінити місто', 'change_city')],
              [Markup.button.callback('❌ Скасувати замовлення', 'cancel_order')]
            ])
          )

          return ctx.wizard.next()
        } else {
          // Multiple cities found, show selection
          ctx.scene.state.availableCities = cities

          await ctx.reply(
            '🏙️ Знайдено кілька міст з такою назвою. Оберіть потрібне:',
            novaPoshtaService.formatCitiesForKeyboard(cities)
          )
          return
        }
      } catch (error) {
        console.error('Nova Poshta search error:', error)
        await ctx.reply(
          '❌ Помилка при пошуку міста. Можливі причини:\n\n' +
          '• Проблеми з підключенням до Нової Пошти\n' +
          '• Неправильно введена назва міста\n\n' +
          'Спробуйте ще раз або зверніться до підтримки.',
          Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Спробувати ще раз', 'retry_city')],
            [Markup.button.callback('❌ Скасувати замовлення', 'cancel_order')]
          ])
        )
        return
      }
    }

    // Handle city selection from multiple options
    if (ctx.callbackQuery?.data?.startsWith('city_')) {
      const cityRef = ctx.callbackQuery.data.replace('city_', '')
      const selectedCity = ctx.scene.state.availableCities?.find(city => city.ref === cityRef)

      if (!selectedCity) {
        await ctx.answerCbQuery('❌ Помилка вибору міста')
        return
      }

      ctx.scene.state.selectedCity = selectedCity
      ctx.scene.state.waitingForCity = false
      await ctx.answerCbQuery()

      ctx.scene.state.waitingForWarehouseNumber = true
      
      await ctx.editMessageText(
        `📦 Місто ${selectedCity.name} обрано.\n\n` +
        '✍️ Введіть номер відділення або поштомату Нова Пошта:\n\n' +
        '💡 Приклади:\n' +
        '• Для відділення: 1, 2, 142\n' +
        '• Для поштомату: 5310, 26571\n\n' +
        'ℹ️ Ви можете знайти номер на сайті Нова Пошта або у додатку',
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅ Змінити місто', 'change_city')],
          [Markup.button.callback('❌ Скасувати замовлення', 'cancel_order')]
        ])
      )

      return ctx.wizard.next()
    }

    // Handle unexpected input or stuck state
    if (!ctx.callbackQuery && !ctx.scene.state.waitingForCity) {
      await ctx.reply(
        '⚠️ Щось пішло не так. Будь ласка, введіть назву вашого міста для доставки:',
        Markup.inlineKeyboard([
          [Markup.button.callback('❌ Скасувати замовлення', 'cancel_order')]
        ])
      )
      ctx.scene.state.waitingForCity = true
      return
    }

    // If still waiting for city but no valid input
    if (ctx.scene.state.waitingForCity) {
      await ctx.reply(
        '❌ Будь ласка, введіть назву міста текстом.\n' +
        'Наприклад: Київ, Харків, Львів',
        Markup.inlineKeyboard([
          [Markup.button.callback('❌ Скасувати замовлення', 'cancel_order')]
        ])
      )
    }
  },

  // Step 8: Handle warehouse selection and payment method
  async(ctx) => {
    // Reset timeout on user activity
    if (ctx.callbackQuery || ctx.message) {
      setOrderTimeout(ctx)
    }

    // Handle change city request
    if (ctx.callbackQuery?.data === 'change_city') {
      await ctx.answerCbQuery()
      ctx.scene.state.waitingForCity = true
      ctx.scene.state.selectedCity = null
      ctx.scene.state.availableWarehouses = null
      ctx.scene.state.selectedWarehouse = null

      await ctx.editMessageText(
        '🏙️ Введіть назву вашого міста для доставки Нова Пошта:\n\n' +
        '💡 Підказка: використовуйте українську мову\n' +
        'Наприклад: Київ, Харків, Львів, Одеса',
        Markup.inlineKeyboard([
          [Markup.button.callback('❌ Скасувати', 'cancel_order')]
        ])
      )

      return ctx.wizard.selectStep(6) // Go back to step 7 (city selection)
    }

    // Handle manual warehouse number input
    if (ctx.scene.state.waitingForWarehouseNumber && ctx.message?.text) {
      const warehouseNumber = ctx.message.text.trim()
      
      // Validate warehouse number format (1-5 digits)
      if (!/^\d{1,5}$/.test(warehouseNumber)) {
        await ctx.reply(
          '❌ Неправильний формат номера.\n\n' +
          'Номер має складатися тільки з цифр (1-5 знаків).\n' +
          'Приклади: 1, 142, 5310\n\n' +
          'Спробуйте ще раз:',
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅ Змінити місто', 'change_city')],
            [Markup.button.callback('❌ Скасувати замовлення', 'cancel_order')]
          ])
        )
        return
      }

      await ctx.reply('🔍 Перевіряємо відділення...')

      try {
        // Validate warehouse exists in the selected city
        const warehouses = await novaPoshtaService.getWarehouses(ctx.scene.state.selectedCity.ref)
        const validWarehouse = warehouses.find(wh => wh.number === warehouseNumber)

        if (!validWarehouse) {
          await ctx.reply(
            `❌ Відділення №${warehouseNumber} не знайдено в місті ${ctx.scene.state.selectedCity.name}.\n\n` +
            '💡 Перевірте номер на сайті Нова Пошта або в додатку.\n\n' +
            'Спробуйте інший номер:',
            Markup.inlineKeyboard([
              [Markup.button.callback('⬅ Змінити місто', 'change_city')],
              [Markup.button.callback('❌ Скасувати замовлення', 'cancel_order')]
            ])
          )
          return
        }

        // Warehouse found and validated
        ctx.scene.state.selectedWarehouse = validWarehouse
        ctx.scene.state.waitingForWarehouseNumber = false

        await ctx.reply(
          `✅ Відділення підтверджено:\n` +
          `📦 №${validWarehouse.number} - ${validWarehouse.description}\n\n` +
          '💳 Оберіть спосіб оплати:',
          Markup.inlineKeyboard([
            [Markup.button.callback('📮 Післяплата', 'payment_postpaid')],
            [Markup.button.callback('💳 Передоплата на карту', 'payment_prepaid')],
            [Markup.button.callback('❌ Скасувати', 'cancel_order')]
          ])
        )

        return ctx.wizard.next()
      } catch (error) {
        console.error('Warehouse validation error:', error)
        await ctx.reply(
          '❌ Помилка перевірки відділення.\n\n' +
          'Спробуйте ще раз або зверніться до підтримки:',
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅ Змінити місто', 'change_city')],
            [Markup.button.callback('❌ Скасувати замовлення', 'cancel_order')]
          ])
        )
        return
      }
    }

    // Handle invalid input when waiting for warehouse number
    if (ctx.scene.state.waitingForWarehouseNumber && !ctx.message?.text) {
      await ctx.reply(
        '❌ Будь ласка, введіть номер відділення текстом.\n' +
        'Приклади: 1, 142, 5310',
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅ Змінити місто', 'change_city')],
          [Markup.button.callback('❌ Скасувати замовлення', 'cancel_order')]
        ])
      )
    }
  },

  // Step 9: Order confirmation
  async(ctx) => {
    // Reset timeout on user activity
    if (ctx.callbackQuery) {
      setOrderTimeout(ctx)
    }

    const paymentMethods = {
      payment_postpaid: 'Післяплата',
      payment_prepaid: 'Передоплата на карту'
    }

    if (!ctx.callbackQuery || !paymentMethods[ctx.callbackQuery.data]) {
      await ctx.reply('❌ Будь ласка, оберіть спосіб оплати з кнопок.')
      return
    }

    ctx.scene.state.paymentMethod = paymentMethods[ctx.callbackQuery.data]
    await ctx.answerCbQuery()

    const { product, customerFirstName, customerLastName, customerPhone, selectedColor, selectedSize, deliveryMethod, paymentMethod } = ctx.scene.state
    const totalAmount = product.sale_price || product.price

    // Build delivery info for Nova Poshta
    let deliveryInfo = ''
    if (ctx.scene.state.selectedCity && ctx.scene.state.selectedWarehouse) {
      deliveryInfo = `🚚 Доставка: ${deliveryMethod}\n` +
        `🏙️ Місто: ${ctx.scene.state.selectedCity.name} (${ctx.scene.state.selectedCity.area})\n` +
        `📦 Відділення: №${ctx.scene.state.selectedWarehouse.number} - ${ctx.scene.state.selectedWarehouse.description.substring(0, 50)}...\n`
    }

    const orderSummary = '📋 Підтвердження замовлення\n\n' +
      `👤 Ім'я: ${customerFirstName}\n` +
      `👤 Прізвище: ${customerLastName}\n` +
      `📱 Телефон: ${customerPhone}\n` +
      `📦 Товар: ${product.name}\n` +
      (selectedColor ? `🎨 Колір: ${selectedColor}\n` : '') +
      (selectedSize ? `📏 Розмір: ${selectedSize}\n` : '') +
      `💰 Ціна: ${totalAmount}₴\n` +
      deliveryInfo +
      `💳 Оплата: ${paymentMethod}\n\n` +
      '✅ Підтвердити замовлення?'

    await ctx.editMessageText(
      orderSummary,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Підтвердити', 'confirm_order')],
        [Markup.button.callback('✏️ Редагувати', 'edit_order')],
        [Markup.button.callback('❌ Скасувати', 'cancel_order')]
      ])
    )

    return ctx.wizard.next()
  },

  // Step 10: Submit to CRM
  async(ctx) => {
    if (!ctx.callbackQuery) return

    await ctx.answerCbQuery()

    if (ctx.callbackQuery.data === 'edit_order') {
      setOrderTimeout(ctx) // Reset timeout when editing
      return ctx.wizard.selectStep(0) // Start over
    }

    if (ctx.callbackQuery.data === 'cancel_order') {
      clearAllTimeouts(ctx)
      await ctx.editMessageText('❌ Замовлення скасовано.')
      return ctx.scene.leave()
    }

    if (ctx.callbackQuery.data === 'confirm_order') {
      // Clear timeout when confirming order
      clearAllTimeouts(ctx)
      await ctx.editMessageText('⏳ Обробляємо ваше замовлення...')

      try {
        const { product, customerName, customerFirstName, customerLastName, customerPhone, deliveryMethod, paymentMethod } = ctx.scene.state

        // Get user ID (fallback if ctx.user is not set)
        let userId = ctx.user?.id
        if (!userId) {
          const user = await db.get('SELECT id FROM users WHERE telegram_id = ?', [ctx.from.id])
          userId = user?.id
        }

        if (!userId) {
          throw new Error('User not found in database')
        }

        // Build delivery address and Nova Poshta data (Nova Poshta only)
        let deliveryAddress = ''
        let novaPoshta = {}

        if (ctx.scene.state.selectedCity && ctx.scene.state.selectedWarehouse) {
          // Prepare Nova Poshta data for CRM
          novaPoshta = novaPoshtaService.prepareForCRM(ctx.scene.state.selectedCity, ctx.scene.state.selectedWarehouse)
          deliveryAddress = `${ctx.scene.state.selectedCity.name}, відділення №${ctx.scene.state.selectedWarehouse.number}`
          
          // Add postpaid field based on payment method
          if (paymentMethod === 'Післяплата') {
            novaPoshta.postpaid = 'Payment control'
          } else if (paymentMethod === 'Передоплата на карту') {
            novaPoshta.postpaid = 'No cash on delivery'
          }
        }

        // Build clean product name with selected variants (no JSON data)
        let productDisplayName = product.name
        
        // Remove any JSON data that might be in the product name
        if (productDisplayName.includes('({"colors"')) {
          productDisplayName = productDisplayName.split('({"colors"')[0].trim()
        }
        
        // Add selected variants
        const variants = []
        if (ctx.scene.state.selectedColor) {
          variants.push(ctx.scene.state.selectedColor)
        }
        if (ctx.scene.state.selectedSize) {
          variants.push(ctx.scene.state.selectedSize)
        }
        if (variants.length > 0) {
          productDisplayName += ` - ${variants.join(', ')}`
        }

        // Submit to CRM with Nova Poshta data  
        const crmResult = await crmService.createOrder({
          telegramOrderId: ctx.from.id.toString(), // Use Telegram user ID instead
          products: [{
            id: product.id,
            name: productDisplayName,
            price: product.sale_price || product.price,
            quantity: 1,
            description: '', // Clean description, no JSON data
            color: ctx.scene.state.selectedColor,
            size: ctx.scene.state.selectedSize
          }],
          customerName,
          customerFirstName,
          customerLastName,
          customerPhone,
          telegramUsername: ctx.from.username,
          deliveryMethod,
          deliveryAddress,
          paymentMethod,
          novaPoshta, // Include Nova Poshta parameters
          notes: `The order from the telegram bot. ${ctx.scene.state.selectedColor ? `Колір: ${ctx.scene.state.selectedColor}. ` : ''}${ctx.scene.state.selectedSize ? `Розмір: ${ctx.scene.state.selectedSize}` : ''}`
        })

        if (crmResult.success) {
          // Clear timeout on successful order
          clearAllTimeouts(ctx)

          await ctx.editMessageText(
            '✅ Замовлення успішно оформлено!\n\n' +
            `📋 Номер замовлення: ${crmResult.orderId}\n` +
            '📱 Наш менеджер зв\'яжеться з вами найближчим часом.\n\n' +
            'Дякуємо за покупку! 🙏',
            Markup.inlineKeyboard([
              [Markup.button.callback('🏠 Головне меню', 'main_menu')]
            ])
          )
        } else {
          throw new Error(crmResult.error)
        }
      } catch (error) {
        console.error('Order submission error:', error)
        // Clear timeout on error
        clearAllTimeouts(ctx)

        await ctx.editMessageText(
          '❌ Помилка при оформленні замовлення.\n\n' +
          'Ваші дані збережено, ми зв\'яжемося з вами вручну.\n\n' +
          'Вибачте за незручності.',
          Markup.inlineKeyboard([
            [Markup.button.callback('🏠 Головне меню', 'main_menu')]
          ])
        )
      }

      return ctx.scene.leave()
    }
  }
)

// Handle cancel order
orderWizard.action('cancel_order', async(ctx) => {
  await ctx.answerCbQuery()
  clearAllTimeouts(ctx)
  await ctx.editMessageText('❌ Замовлення скасовано.')
  return ctx.scene.leave()
})

// Handle retry city search
orderWizard.action('retry_city', async(ctx) => {
  await ctx.answerCbQuery()
  setOrderTimeout(ctx) // Reset timeout on retry
  ctx.scene.state.waitingForCity = true
  await ctx.editMessageText(
    '🏙️ Введіть назву вашого міста для доставки Нова Пошта:\n\n' +
    '💡 Підказка: використовуйте українську мову\n' +
    'Наприклад: Київ, Харків, Львів, Одеса',
    Markup.inlineKeyboard([
      [Markup.button.callback('❌ Скасувати замовлення', 'cancel_order')]
    ])
  )
})

// Clear timeout on scene leave
orderWizard.leave((ctx) => {
  clearAllTimeouts(ctx)
})

module.exports = orderWizard
