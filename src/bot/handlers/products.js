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

// Helper functions to reduce code duplication
function createProductKeyboard(productId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📏 Довідка розмірів', callback_data: `size_help_${productId}` }],
        [{ text: '🛒 Замовити', callback_data: `order_${productId}` }],
        [{ text: messages.back, callback_data: 'back' }]
      ]
    }
  }
}

function formatProductText(product) {
  const price = product.sale_price || product.price
  const originalPrice = product.sale_price ? product.price : null

  let productText = `🛍 ${product.name}\n\n`

  // Parse and display colors and sizes
  if (product.description) {
    try {
      const variants = JSON.parse(product.description)
      if (variants.colors && variants.colors.length > 0) {
        productText += `🎨 Доступні кольори: ${variants.colors.join(', ')}\n`
      }
      if (variants.sizes && variants.sizes.length > 0) {
        productText += `📏 Доступні розміри: ${variants.sizes.join(', ')}\n`
      }
      if (variants.colors || variants.sizes) {
        productText += '\n'
      }
    } catch (e) {
      productText += `📝 ${product.description}\n\n`
    }
  }

  productText += `💰 Ціна: ${price}₴`
  if (originalPrice) {
    productText += ` ~~${originalPrice}₴~~`
  }
  productText += `\n📦 В наявності: ${product.stock_quantity} шт.`

  return productText
}

async function getProductWithCategory(productId) {
  return await db.get(`
    SELECT p.*, c.name as category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.id = ?
  `, [productId])
}

async function sendProductWithImages(ctx, product, productText, keyboard, deleteMessage = false, photoPage = 0) {
  let images = []
  try {
    if (product.images) {
      if (typeof product.images === 'string') {
        if (product.images.startsWith('/') || product.images.startsWith('http')) {
          images = [product.images]
        } else {
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

  const validImages = []
  for (const image of images) {
    const imagePath = path.join(__dirname, '../../../public', image)
    if (fs.existsSync(imagePath)) {
      validImages.push(imagePath)
    }
  }

  if (validImages.length > 0) {
    try {
      if (deleteMessage) {
        await ctx.deleteMessage()
      }

      if (validImages.length === 1) {
        await ctx.replyWithPhoto(
          { source: validImages[0] },
          { caption: productText, ...keyboard }
        )
      } else {
        const photosPerPage = 10
        const startIndex = photoPage * photosPerPage
        const endIndex = Math.min(startIndex + photosPerPage, validImages.length)
        const photosToShow = validImages.slice(startIndex, endIndex)

        const mediaGroup = photosToShow.map((imagePath, index) => ({
          type: 'photo',
          media: { source: imagePath },
          caption: index === 0 ? `📸 Фото товару "${product.name}" (${startIndex + 1}-${endIndex} з ${validImages.length})` : undefined
        }))

        await ctx.replyWithMediaGroup(mediaGroup)

        const photoNavigation = []
        if (validImages.length > photosPerPage) {
          const navigationRow = []
          if (photoPage > 0) {
            navigationRow.push({ text: '⬅️ Попередні фото', callback_data: `product_${product.id}_photos_${photoPage - 1}` })
          }
          if (endIndex < validImages.length) {
            navigationRow.push({ text: 'Наступні фото ➡️', callback_data: `product_${product.id}_photos_${photoPage + 1}` })
          }
          if (navigationRow.length > 0) {
            photoNavigation.push(navigationRow)
          }
        }

        if (photoNavigation.length > 0) {
          if (keyboard.reply_markup && keyboard.reply_markup.inline_keyboard) {
            keyboard.reply_markup.inline_keyboard = [...photoNavigation, ...keyboard.reply_markup.inline_keyboard]
          } else {
            keyboard.reply_markup = {
              inline_keyboard: photoNavigation
            }
          }
        }

        await ctx.reply(productText, keyboard)
      }
      return true
    } catch (imgError) {
      console.log('Failed to send images, sending text instead:', imgError)
    }
  }

  return false
}

function setupProductHandlers(bot) {
  bot.hears('🛍 Переглянути товари', async(ctx) => {
    try {
      ctx.session.navigationStack = [{ type: 'browse_mode_selection' }]

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 Обрати з каталогу', callback_data: 'browse_manual' },
              { text: '🤖 AI помічник', callback_data: 'browse_ai' }
            ],
            [{ text: messages.main_menu_btn, callback_data: 'main_menu' }]
          ]
        }
      }

      await ctx.reply(`🛍 Обирайте, як зручніше шукати покупки:

📋 Каталог товарів – гортайте та знаходьте улюблене
🤖  AI-помічник – розкажіть, що шукаєте, а я підберу найкраще `, keyboard)
    } catch (error) {
      console.error('Error showing browse options:', error)
      await ctx.reply('Сталася помилка.')
    }
  })

  bot.action('browse_manual', async(ctx) => {
    try {
      const categories = await db.all(`
        SELECT id, name, description 
        FROM categories 
        WHERE active = 1 
        ORDER BY sort_order ASC, name ASC
      `)

      if (categories.length === 0) {
        await ctx.editMessageText('На разі немає доступних категорій.')
        return
      }

      ctx.session.navigationStack.push({ type: 'categories' })

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            ...categories.map(cat => [{
              text: cat.name,
              callback_data: `category_${cat.id}`
            }]),
            [{ text: messages.back, callback_data: 'back' }]
          ]
        }
      }

      await ctx.editMessageText(messages.categories, keyboard)
    } catch (error) {
      console.error('Error loading categories:', error)
      await ctx.editMessageText('Сталася помилка завантаження категорій.')
    }
  })

  bot.action('browse_ai', async(ctx) => {
    try {
      ctx.session.aiSearchMode = true
      await ctx.editMessageText(`🤖 AI Помічник активований!

Опишіть, що ви шукаєте. Наприклад:
• "Я хочу нічну сорочку"
• "Покажи мереживні комплекти"
• «Шовковий халат»

Просто опишіть своє бажання — і я підберу найкращі варіанти з нашого каталогу ❤️ 
🏠 Щоб повернутися до головного меню, наберіть /start`)

      await ctx.answerCbQuery()
    } catch (error) {
      console.error('Error activating AI mode:', error)
      await ctx.editMessageText('Сталася помилка активації AI помічника.')
    }
  })

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

  // Photo navigation handler - MUST come before the general product handler
  bot.action(/product_(\d+)_photos_(\d+)/, async(ctx) => {
    await ctx.answerCbQuery()
    const productId = parseInt(ctx.match[1])
    const photoPage = parseInt(ctx.match[2])

    try {
      const product = await getProductWithCategory(productId)

      if (!product) {
        await ctx.reply('Цей товар не знайдено.')
        return
      }

      const productText = formatProductText(product)
      const keyboard = createProductKeyboard(productId)

      await sendProductWithImages(ctx, product, productText, keyboard, true, photoPage)
    } catch (error) {
      console.error('Error loading product photos:', error)
      await ctx.reply('Сталася помилка завантаження фото.')
    }
  })

  bot.action(/product_(\d+)/, async(ctx) => {
    const productId = parseInt(ctx.match[1])

    try {
      const product = await getProductWithCategory(productId)

      if (!product) {
        await ctx.editMessageText('Цей товар не знайдено.')
        return
      }

      ctx.session.navigationStack.push({ type: 'product_details', productId })

      const productText = formatProductText(product)
      const keyboard = createProductKeyboard(productId)

      const imageSent = await sendProductWithImages(ctx, product, productText, keyboard, true)

      if (!imageSent) {
        await ctx.editMessageText(productText, keyboard)
      }
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
      const product = await getProductWithCategory(productId)

      if (!product) {
        await ctx.reply('Цей товар не знайдено.')
        return
      }

      const productText = formatProductText(product)
      const keyboard = createProductKeyboard(productId)

      const imageSent = await sendProductWithImages(ctx, product, productText, keyboard, false)

      if (!imageSent) {
        await ctx.reply(productText, keyboard)
      }
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
        case 'browse_mode_selection': {
          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📋 Обрати з каталогу', callback_data: 'browse_manual' },
                  { text: '🤖 AI помічник', callback_data: 'browse_ai' }
                ],
                [{ text: messages.main_menu_btn, callback_data: 'main_menu' }]
              ]
            }
          }

          await ctx.editMessageText(`🛍 Оберіть спосіб пошуку товарів:

📋 **Обрати з каталогу** - переглядайте товари по категоріях
🤖 **AI помічник** - опишіть, що ви шукаєте, і я допоможу підібрати`, keyboard)
          break
        }

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
                [{ text: messages.back, callback_data: 'back' }]
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
