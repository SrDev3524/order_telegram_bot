const db = require('../../database/connection')
const fs = require('fs')
const path = require('path')

const messages = {
  categories: `📂 Категорії товарів

Оберіть категорію для перегляду:`,

  no_products: 'На жаль, в цій категорії поки немає товарів.',
  back: '⬅ Назад',
  main_menu_btn: '🏠 Головне меню'
}

function setupProductHandlers(bot) {
  // Handle "Browse Products" button
  bot.hears('🛍 Browse Products', async(ctx) => {
    try {
      const categories = await db.all(`
        SELECT id, name, description 
        FROM categories 
        WHERE active = 1 
        ORDER BY sort_order ASC, name ASC
      `)

      if (categories.length === 0) {
        await ctx.reply('На разі немає доступних категорій.')
        return
      }

      ctx.session.navigationStack = [{ type: 'categories' }]

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            ...categories.map(cat => [{
              text: cat.name,
              callback_data: `category_${cat.id}`
            }]),
            [{ text: messages.main_menu_btn, callback_data: 'main_menu' }]
          ]
        }
      }

      await ctx.reply(messages.categories, keyboard)
    } catch (error) {
      console.error('Error loading categories:', error)
      await ctx.reply('Сталася помилка завантаження категорій.')
    }
  })

  // Category selection
  bot.action(/category_(\d+)/, async(ctx) => {
    const categoryId = parseInt(ctx.match[1])

    try {
      const [category, products] = await Promise.all([
        db.get('SELECT * FROM categories WHERE id = ?', [categoryId]),
        db.all(`
          SELECT id, name, description, price, sale_price, images 
          FROM products 
          WHERE category_id = ? AND active = 1 
          ORDER BY name ASC
        `, [categoryId])
      ])

      if (!category) {
        await ctx.editMessageText('Ця категорія не знайдена.')
        return
      }

      ctx.session.navigationStack.push({ type: 'category_products', categoryId })

      if (products.length === 0) {
        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [{ text: messages.back, callback_data: 'back' }]
            ]
          }
        }
        await ctx.editMessageText(`📂 ${category.name}\n\n${messages.no_products}`, keyboard)
        return
      }

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            ...products.map(product => [{
              text: `${product.name} - ${product.sale_price || product.price}₴`,
              callback_data: `product_${product.id}`
            }]),
            [{ text: messages.back, callback_data: 'back' }]
          ]
        }
      }

      await ctx.editMessageText(`📂 ${category.name}\n\nОберіть товар:`, keyboard)
    } catch (error) {
      console.error('Error loading products:', error)
      await ctx.editMessageText('Сталася помилка завантаження товарів.')
    }
  })

  // Product details
  bot.action(/product_(\d+)/, async(ctx) => {
    const productId = parseInt(ctx.match[1])

    try {
      const product = await db.get(`
        SELECT p.*, c.name as category_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.id = ?
      `, [productId])

      if (!product) {
        await ctx.editMessageText('Цей товар не знайдено.')
        return
      }

      ctx.session.navigationStack.push({ type: 'product_details', productId })

      const price = product.sale_price || product.price
      const originalPrice = product.sale_price ? product.price : null

      let productText = `🛍 ${product.name}\n\n`
      if (product.description) {
        productText += `📝 ${product.description}\n\n`
      }
      productText += `💰 Ціна: ${price}₴`
      if (originalPrice) {
        productText += ` ~~${originalPrice}₴~~`
      }
      productText += `\n📦 В наявності: ${product.stock_quantity} шт.`

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📏 Size Help', callback_data: `size_help_${productId}` }],
            [{ text: '🛒 Order', callback_data: `order_${productId}` }],
            [{ text: messages.back, callback_data: 'back' }]
          ]
        }
      }

      // Try to send product image if available
      let images = []
      try {
        if (product.images) {
          if (typeof product.images === 'string') {
            // Check if it's already a path (not JSON)
            if (product.images.startsWith('/') || product.images.startsWith('http')) {
              images = [product.images]
            } else {
              // Try to parse as JSON
              images = JSON.parse(product.images)
            }
          } else if (Array.isArray(product.images)) {
            images = product.images
          }
        }
      } catch (e) {
        console.log('Error parsing images, treating as single path:', product.images)
        images = [product.images]
      }

      if (images.length > 0) {
        const imagePath = path.join(__dirname, '../../../public', images[0])
        if (fs.existsSync(imagePath)) {
          try {
            await ctx.deleteMessage()
            await ctx.replyWithPhoto(
              { source: imagePath },
              { caption: productText, ...keyboard }
            )
            return
          } catch (imgError) {
            console.log('Failed to send image, sending text instead')
          }
        }
      }

      await ctx.editMessageText(productText, keyboard)
    } catch (error) {
      console.error('Error loading product:', error)
      await ctx.editMessageText('Сталася помилка завантаження товару.')
    }
  })

  // Size Help
  bot.action(/size_help_(\d+)/, async(ctx) => {
    await ctx.answerCbQuery()
    const productId = parseInt(ctx.match[1])

    const sizeGuide = `📏 Довідка по розмірах

Я допоможу вам обрати правильний розмір.

Будь ласка, виміряйте:
• Обхват грудей
• Обхват талії
• Обхват стегон

Таблиця розмірів:
XS - грудь: 82-86 см, талія: 62-66 см
S - грудь: 86-90 см, талія: 66-70 см
M - грудь: 90-94 см, талія: 70-74 см
L - грудь: 94-98 см, талія: 74-78 см
XL - грудь: 98-102 см, талія: 78-82 см
XXL - грудь: 102-106 см, талія: 82-86 см`

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬅ Назад до товару', callback_data: `back_to_product_${productId}` }]
        ]
      }
    }

    // Use reply instead of editMessageText for compatibility with photo messages
    await ctx.reply(sizeGuide, keyboard)
  })

  // Back to product from size help
  bot.action(/back_to_product_(\d+)/, async(ctx) => {
    await ctx.answerCbQuery()
    const productId = parseInt(ctx.match[1])

    // Redirect to product details without modifying navigation stack
    try {
      const product = await db.get(`
        SELECT p.*, c.name as category_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.id = ?
      `, [productId])

      if (!product) {
        await ctx.reply('Цей товар не знайдено.')
        return
      }

      const price = product.sale_price || product.price
      const originalPrice = product.sale_price ? product.price : null

      let productText = `🛍 ${product.name}\n\n`
      if (product.description) {
        productText += `📝 ${product.description}\n\n`
      }
      productText += `💰 Ціна: ${price}₴`
      if (originalPrice) {
        productText += ` ~~${originalPrice}₴~~`
      }
      productText += `\n📦 В наявності: ${product.stock_quantity} шт.`

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📏 Size Help', callback_data: `size_help_${productId}` }],
            [{ text: '🛒 Order', callback_data: `order_${productId}` }],
            [{ text: messages.back, callback_data: 'back' }]
          ]
        }
      }

      // Try to send product image if available
      let images = []
      try {
        if (product.images) {
          if (typeof product.images === 'string') {
            // Check if it's already a path (not JSON)
            if (product.images.startsWith('/') || product.images.startsWith('http')) {
              images = [product.images]
            } else {
              // Try to parse as JSON
              images = JSON.parse(product.images)
            }
          } else if (Array.isArray(product.images)) {
            images = product.images
          }
        }
      } catch (e) {
        console.log('Error parsing images, treating as single path:', product.images)
        images = [product.images]
      }

      if (images.length > 0) {
        const imagePath = path.join(__dirname, '../../../public', images[0])
        if (fs.existsSync(imagePath)) {
          try {
            await ctx.replyWithPhoto(
              { source: imagePath },
              { caption: productText, ...keyboard }
            )
            return
          } catch (imgError) {
            console.log('Failed to send image, sending text instead')
          }
        }
      }

      await ctx.reply(productText, keyboard)
    } catch (error) {
      console.error('Error loading product:', error)
      await ctx.reply('Сталася помилка завантаження товару.')
    }
  })

  // Back navigation
  bot.action('back', async(ctx) => {
    if (!ctx.session.navigationStack || ctx.session.navigationStack.length <= 1) {
      return
    }

    ctx.session.navigationStack.pop()
    const previousState = ctx.session.navigationStack[ctx.session.navigationStack.length - 1]

    try {
      switch (previousState.type) {
        case 'categories': {
          const categories = await db.all(`
            SELECT id, name, description 
            FROM categories 
            WHERE active = 1 
            ORDER BY sort_order ASC, name ASC
          `)

          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                ...categories.map(cat => [{
                  text: cat.name,
                  callback_data: `category_${cat.id}`
                }]),
                [{ text: messages.main_menu_btn, callback_data: 'main_menu' }]
              ]
            }
          }

          await ctx.editMessageText(messages.categories, keyboard)
          break
        }

        case 'category_products': {
          const categoryId = previousState.categoryId
          const [category, products] = await Promise.all([
            db.get('SELECT * FROM categories WHERE id = ?', [categoryId]),
            db.all(`
              SELECT id, name, description, price, sale_price, images 
              FROM products 
              WHERE category_id = ? AND active = 1 
              ORDER BY name ASC
            `, [categoryId])
          ])

          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                ...products.map(product => [{
                  text: `${product.name} - ${product.sale_price || product.price}₴`,
                  callback_data: `product_${product.id}`
                }]),
                [{ text: messages.back, callback_data: 'back' }]
              ]
            }
          }

          await ctx.editMessageText(`📂 ${category.name}\n\nОберіть товар:`, keyboard)
          break
        }

        default:
          await ctx.deleteMessage()
      }
    } catch (error) {
      console.error('Navigation error:', error)
    }
  })

  // Order handler - Start order wizard
  bot.action(/order_(\d+)/, async(ctx) => {
    const productId = parseInt(ctx.match[1])
    await ctx.answerCbQuery()

    // Enter scene with initial state
    return ctx.scene.enter('order-wizard', { productId })
  })

  // Return to main menu
  bot.action('main_menu', async(ctx) => {
    await ctx.answerCbQuery()
    await ctx.deleteMessage()
    ctx.session.navigationStack = [{ type: 'main_menu' }]

    // Show main menu
    const { mainReplyKeyboard } = require('../keyboards/mainKeyboard')
    await ctx.reply(
      '🏠 Головне меню\n\nОберіть потрібний розділ:',
      mainReplyKeyboard
    )
  })
}

module.exports = { setupProductHandlers }
