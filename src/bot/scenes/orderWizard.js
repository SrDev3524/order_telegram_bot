const { Scenes, Markup } = require('telegraf')
const db = require('../../database/connection')
const crmService = require('../../services/crm')
const novaPoshtaService = require('../../services/novaPoshta')

const orderWizard = new Scenes.WizardScene(
  'order-wizard',

  // Step 1: Customer name
  async(ctx) => {
    console.log('=== ORDER WIZARD STEP 1 ===')
    console.log('ctx.scene.state:', ctx.scene.state)
    console.log('ctx.session.__scenes.state:', ctx.session.__scenes?.state)
    
    // Get productId from scene entry state
    const productId = ctx.scene.state.productId
    console.log('Product ID from scene state:', productId)
    
    if (!productId) {
      console.log('No productId found, exiting scene')
      await ctx.reply('❌ Помилка: не вказано товар.')
      return ctx.scene.leave()
    }
    
    const product = await db.get('SELECT * FROM products WHERE id = ?', [productId])
    console.log('Product found:', product)

    if (!product) {
      await ctx.reply('❌ Товар не знайдено.')
      return ctx.scene.leave()
    }

    ctx.scene.state.product = product

    await ctx.reply(
      `🛒 Оформлення замовлення\n\n📦 Товар: ${product.name}\n💰 Ціна: ${product.sale_price || product.price}₴\n\n👤 Введіть ваше ім'я:`,
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ Скасувати', 'cancel_order')]
      ])
    )

    return ctx.wizard.next()
  },

  // Step 2: Phone number
  async(ctx) => {
    if (!ctx.message?.text) {
      await ctx.reply('❌ Будь ласка, введіть ваше ім\'я текстом.')
      return
    }

    ctx.scene.state.customerName = ctx.message.text.trim()

    await ctx.reply(
      '📱 Введіть ваш номер телефону:\n(наприклад: +380501234567)',
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ Скасувати', 'cancel_order')]
      ])
    )

    return ctx.wizard.next()
  },

  // Step 3: Size selection
  async(ctx) => {
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
      '📏 Оберіть розмір:',
      Markup.inlineKeyboard([
        [Markup.button.callback('XS', 'size_xs'), Markup.button.callback('S', 'size_s')],
        [Markup.button.callback('M', 'size_m'), Markup.button.callback('L', 'size_l')],
        [Markup.button.callback('XL', 'size_xl'), Markup.button.callback('XXL', 'size_xxl')],
        [Markup.button.callback('📖 Довідка по розмірах', 'size_guide')],
        [Markup.button.callback('❌ Скасувати', 'cancel_order')]
      ])
    )

    return ctx.wizard.next()
  },

  // Step 4: Delivery method
  async(ctx) => {
    const sizes = {
      size_xs: 'XS',
      size_s: 'S',
      size_m: 'M',
      size_l: 'L',
      size_xl: 'XL',
      size_xxl: 'XXL'
    }

    if (ctx.callbackQuery?.data === 'size_guide') {
      await ctx.answerCbQuery()
      await ctx.editMessageText(
        '📖 Довідка по розмірах\n\n' +
        'XS - обхват грудей: 82-86 см\n' +
        'S - обхват грудей: 86-90 см\n' +
        'M - обхват грудей: 90-94 см\n' +
        'L - обхват грудей: 94-98 см\n' +
        'XL - обхват грудей: 98-102 см\n' +
        'XXL - обхват грудей: 102-106 см\n\n' +
        'Оберіть ваш розмір:',
        Markup.inlineKeyboard([
          [Markup.button.callback('XS', 'size_xs'), Markup.button.callback('S', 'size_s')],
          [Markup.button.callback('M', 'size_m'), Markup.button.callback('L', 'size_l')],
          [Markup.button.callback('XL', 'size_xl'), Markup.button.callback('XXL', 'size_xxl')],
          [Markup.button.callback('❌ Скасувати', 'cancel_order')]
        ])
      )
      return
    }

    if (!ctx.callbackQuery || !sizes[ctx.callbackQuery.data]) {
      await ctx.reply('❌ Будь ласка, оберіть розмір з кнопок.')
      return
    }

    ctx.scene.state.productSize = sizes[ctx.callbackQuery.data]
    await ctx.answerCbQuery()

    await ctx.editMessageText(
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

  // Step 5: Nova Poshta city input (delivery method is already set)
  async(ctx) => {
    // This step is now just for handling city input since delivery method is fixed to Nova Poshta
    return ctx.wizard.next()
  },

  // Step 6: Handle Nova Poshta city search and selection
  async(ctx) => {
    // Handle city input for Nova Poshta
    if (ctx.scene.state.waitingForCity && ctx.message?.text) {
      const cityName = ctx.message.text.trim()
      
      await ctx.reply('🔍 Шукаємо ваше місто...')
      
      try {
        const cities = await novaPoshtaService.searchCities(cityName)
        
        if (cities.length === 0) {
          await ctx.reply(
            '❌ Місто не знайдено. Спробуйте ще раз або введіть назву українською мовою:',
            Markup.inlineKeyboard([
              [Markup.button.callback('❌ Скасувати', 'cancel_order')]
            ])
          )
          return
        }

        if (cities.length === 1) {
          // Only one city found, proceed to warehouses
          ctx.scene.state.selectedCity = cities[0]
          ctx.scene.state.waitingForCity = false
          
          await ctx.reply('📦 Завантажуємо список відділень...')
          const warehouses = await novaPoshtaService.getWarehouses(cities[0].ref)
          
          if (warehouses.length === 0) {
            await ctx.reply('❌ У цьому місті немає відділень Нова Пошта.')
            return
          }

          ctx.scene.state.availableWarehouses = warehouses
          
          await ctx.reply(
            `📦 Оберіть відділення Нова Пошта у місті ${cities[0].name}:`,
            novaPoshtaService.formatWarehousesForKeyboard(warehouses)
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
        await ctx.reply('❌ Помилка пошуку міста. Спробуйте ще раз.')
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

      await ctx.editMessageText('📦 Завантажуємо список відділень...')
      
      try {
        const warehouses = await novaPoshtaService.getWarehouses(selectedCity.ref)
        
        if (warehouses.length === 0) {
          await ctx.editMessageText('❌ У цьому місті немає відділень Нова Пошта.')
          return
        }

        ctx.scene.state.availableWarehouses = warehouses
        
        await ctx.editMessageText(
          `📦 Оберіть відділення Нова Пошта у місті ${selectedCity.name}:`,
          novaPoshtaService.formatWarehousesForKeyboard(warehouses)
        )
        
        return ctx.wizard.next()
      } catch (error) {
        console.error('Nova Poshta warehouses error:', error)
        await ctx.editMessageText('❌ Помилка завантаження відділень.')
        return
      }
    }

    // Since we only have Nova Poshta delivery, this section is removed

    await ctx.reply('❌ Будь ласка, введіть назву міста або оберіть з запропонованих варіантів.')
  },

  // Step 7: Handle warehouse selection and payment method
  async(ctx) => {
    // Handle warehouse selection for Nova Poshta
    if (ctx.callbackQuery?.data?.startsWith('warehouse_')) {
      const warehouseRef = ctx.callbackQuery.data.replace('warehouse_', '')
      const selectedWarehouse = ctx.scene.state.availableWarehouses?.find(wh => wh.ref === warehouseRef)
      
      if (!selectedWarehouse) {
        await ctx.answerCbQuery('❌ Помилка вибору відділення')
        return
      }

      ctx.scene.state.selectedWarehouse = selectedWarehouse
      await ctx.answerCbQuery()

      await ctx.editMessageText(
        '💳 Оберіть спосіб оплати:',
        Markup.inlineKeyboard([
          [Markup.button.callback('💳 Передоплата на карту', 'payment_prepaid')],
          [Markup.button.callback('💰 Накладений платіж', 'payment_cod')],
          [Markup.button.callback('❌ Скасувати', 'cancel_order')]
        ])
      )

      return ctx.wizard.next()
    }

    // Handle change city request
    if (ctx.callbackQuery?.data === 'change_city') {
      await ctx.answerCbQuery()
      ctx.scene.state.waitingForCity = true
      ctx.scene.state.selectedCity = null
      ctx.scene.state.availableWarehouses = null
      ctx.scene.state.selectedWarehouse = null

      await ctx.editMessageText(
        '🏙️ Введіть назву вашого міста для доставки Нова Пошта:\n\n(наприклад: Київ, Харків, Львів)',
        Markup.inlineKeyboard([
          [Markup.button.callback('❌ Скасувати', 'cancel_order')]
        ])
      )

      return ctx.wizard.selectStep(5) // Go back to city selection
    }

    await ctx.reply('❌ Будь ласка, оберіть відділення Нова Пошта.')
  },

  // Step 8: Order confirmation  
  async(ctx) => {
    const paymentMethods = {
      payment_prepaid: 'Передоплата на карту',
      payment_cod: 'Накладений платіж'
    }

    if (!ctx.callbackQuery || !paymentMethods[ctx.callbackQuery.data]) {
      await ctx.reply('❌ Будь ласка, оберіть спосіб оплати з кнопок.')
      return
    }

    ctx.scene.state.paymentMethod = paymentMethods[ctx.callbackQuery.data]
    await ctx.answerCbQuery()

    const { product, customerName, customerPhone, productSize, deliveryMethod, paymentMethod } = ctx.scene.state
    const totalAmount = product.sale_price || product.price

    // Build delivery info for Nova Poshta
    let deliveryInfo = ''
    if (ctx.scene.state.selectedCity && ctx.scene.state.selectedWarehouse) {
      deliveryInfo = `🚚 Доставка: ${deliveryMethod}\n` +
        `🏙️ Місто: ${ctx.scene.state.selectedCity.name} (${ctx.scene.state.selectedCity.area})\n` +
        `📦 Відділення: №${ctx.scene.state.selectedWarehouse.number} - ${ctx.scene.state.selectedWarehouse.description.substring(0, 50)}...\n`
    }

    const orderSummary = '📋 Підтвердження замовлення\n\n' +
      `👤 Ім'я: ${customerName}\n` +
      `📱 Телефон: ${customerPhone}\n` +
      `📦 Товар: ${product.name}\n` +
      `📏 Розмір: ${productSize}\n` +
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

  // Step 9: Submit to CRM
  async(ctx) => {
    if (!ctx.callbackQuery) return

    await ctx.answerCbQuery()

    if (ctx.callbackQuery.data === 'edit_order') {
      return ctx.wizard.selectStep(0) // Start over
    }

    if (ctx.callbackQuery.data === 'cancel_order') {
      await ctx.editMessageText('❌ Замовлення скасовано.')
      return ctx.scene.leave()
    }

    if (ctx.callbackQuery.data === 'confirm_order') {
      await ctx.editMessageText('⏳ Обробляємо ваше замовлення...')

      try {
        const { product, customerName, customerPhone, deliveryMethod, paymentMethod } = ctx.scene.state

        // Get user ID (fallback if ctx.user is not set)
        let userId = ctx.user?.id
        if (!userId) {
          const user = await db.get('SELECT id FROM users WHERE telegram_id = ?', [ctx.from.id])
          userId = user?.id
        }

        if (!userId) {
          throw new Error('User not found in database')
        }

        // Generate order number
        const orderPrefix = 'VID'
        const orderNumber = `${orderPrefix}${Date.now()}`

        // Build delivery address and Nova Poshta data (Nova Poshta only)
        let deliveryAddress = ''
        let novaPoshta = {}

        if (ctx.scene.state.selectedCity && ctx.scene.state.selectedWarehouse) {
          // Prepare Nova Poshta data for CRM
          novaPoshta = novaPoshtaService.prepareForCRM(ctx.scene.state.selectedCity, ctx.scene.state.selectedWarehouse)
          deliveryAddress = `${ctx.scene.state.selectedCity.name}, відділення №${ctx.scene.state.selectedWarehouse.number}`
        }

        // Save order to database
        const orderResult = await db.run(`
          INSERT INTO orders (
            order_number, user_id, status, total_amount, customer_name, customer_phone, 
            delivery_method, delivery_address, payment_method, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          orderNumber, userId, 'pending', product.sale_price || product.price,
          customerName, customerPhone, deliveryMethod, deliveryAddress, paymentMethod,
          `Telegram: @${ctx.from.username || ctx.from.first_name}. Розмір: ${ctx.scene.state.productSize}`
        ])

        const orderId = orderResult.id

        // Save order items
        await db.run(`
          INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, size)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [orderId, product.id, product.name, product.sale_price || product.price, 1, ctx.scene.state.productSize])

        // Submit to CRM with Nova Poshta data
        const crmResult = await crmService.createOrder({
          telegramOrderId: orderId,
          products: [{
            id: product.id,
            name: product.name,
            price: product.sale_price || product.price,
            quantity: 1,
            description: product.description
          }],
          customerName,
          customerPhone,
          telegramUsername: ctx.from.username,
          deliveryMethod,
          deliveryAddress,
          paymentMethod,
          novaPoshta, // Include Nova Poshta parameters
          notes: `Замовлення #${orderId} з Telegram бота. Розмір: ${ctx.scene.state.productSize}`
        })

        if (crmResult.success) {
          // Update order with CRM ID
          await db.run('UPDATE orders SET crm_order_id = ? WHERE id = ?', [crmResult.orderId, orderId])

          await ctx.editMessageText(
            '✅ Замовлення успішно оформлено!\n\n' +
            `📋 Номер замовлення: ${orderNumber}\n` +
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
  await ctx.editMessageText('❌ Замовлення скасовано.')
  return ctx.scene.leave()
})

module.exports = orderWizard
