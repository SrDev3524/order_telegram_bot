const db = require('../../database/connection')
const fs = require('fs')
const path = require('path')

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

const MESSAGES = {
  categories: `📂 Категорії товарів\n\nОберіть категорію для перегляду:`,
  no_products: 'На жаль, в цій категорії поки немає товарів.',
  back: '⬅ Назад',
  main_menu_btn: '🏠 Головне меню',
  browse_selection: `🛍 Обирайте, як зручніше шукати покупки:\n\n📋 Каталог товарів – гортайте та знаходьте улюблене\n🤖  AI-помічник – розкажіть, що шукаєте, а я підберу найкраще `,
  ai_activated: `🤖 AI Помічник активований!\n\nОпишіть, що ви шукаєте. Наприклад:\n• "Я хочу нічну сорочку"\n• "Покажи мереживні комплекти"\n• «Шовковий халат»\n\nПросто опішіть своє бажання — і я підберу найкращі варіанти з нашого каталогу ❤️ \n🏠 Щоб повернутися до головного меню, наберіть /start`
}

const CONFIG = {
  photos_per_page: 10,
  max_ai_recommendations: 5
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Creates inline keyboard for product actions
 */
function createProductKeyboard(productId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📏 Довідка розмірів', callback_data: `size_help_${productId}` }],
        [{ text: '🛒 Замовити', callback_data: `order_${productId}` }],
        [{ text: MESSAGES.back, callback_data: 'back' }]
      ]
    }
  }
}

/**
 * Creates keyboard for browse mode selection
 */
function createBrowseModeKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📋 Обрати з каталогу', callback_data: 'browse_manual' },
          { text: '🤖 AI помічник', callback_data: 'browse_ai' }
        ],
        [{ text: MESSAGES.main_menu_btn, callback_data: 'main_menu' }]
      ]
    }
  }
}

/**
 * Creates keyboard for product list
 */
function createProductListKeyboard(products) {
  return {
    reply_markup: {
      inline_keyboard: [
        ...products.map(product => [{
          text: `${product.name} - ${product.sale_price || product.price}₴`,
          callback_data: `product_${product.id}`
        }]),
        [{ text: MESSAGES.back, callback_data: 'back' }]
      ]
    }
  }
}

/**
 * Creates keyboard for categories list
 */
function createCategoriesKeyboard(categories) {
  return {
    reply_markup: {
      inline_keyboard: [
        ...categories.map(cat => [{
          text: cat.name,
          callback_data: `category_${cat.id}`
        }]),
        [{ text: MESSAGES.back, callback_data: 'back' }]
      ]
    }
  }
}

/**
 * Formats product information for display
 */
function formatProductText(product) {
  const price = product.sale_price || product.price
  const originalPrice = product.sale_price ? product.price : null

  let productText = `🛍 ${product.name}\n\n`

  // Parse and display variants
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

  // Add pricing information
  productText += `💰 Ціна: ${price}₴`
  if (originalPrice) {
    productText += ` ~~${originalPrice}₴~~`
  }
  productText += `\n📦 В наявності: ${product.stock_quantity} шт.`

  return productText
}

/**
 * Parses product images safely
 */
function parseProductImages(images) {
  let imageList = []
  try {
    if (images) {
      if (typeof images === 'string') {
        if (images.startsWith('/') || images.startsWith('http')) {
          imageList = [images]
        } else {
          imageList = JSON.parse(images)
        }
      } else if (Array.isArray(images)) {
        imageList = images
      }
    }
  } catch (e) {
    console.log('Error parsing images, treating as single path:', images)
    imageList = [images]
  }
  return imageList
}

/**
 * Validates image files and returns valid paths
 */
function getValidImagePaths(images) {
  const validImages = []
  for (const image of images) {
    const imagePath = path.join(__dirname, '../../../public', image)
    if (fs.existsSync(imagePath)) {
      validImages.push(imagePath)
    }
  }
  return validImages
}

// =============================================================================
// DATABASE QUERIES
// =============================================================================

/**
 * Gets product with category information
 */
async function getProductWithCategory(productId) {
  return await db.get(`
    SELECT p.*, c.name as category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.id = ?
  `, [productId])
}

/**
 * Gets all active categories
 */
async function getActiveCategories() {
  return await db.all(`
    SELECT id, name, description 
    FROM categories 
    WHERE active = 1 
    ORDER BY sort_order ASC, name ASC
  `)
}

/**
 * Gets products by category
 */
async function getProductsByCategory(categoryId) {
  return await db.all(`
    SELECT id, name, description, price, sale_price, images 
    FROM products 
    WHERE category_id = ? AND active = 1 
    ORDER BY name ASC
  `, [categoryId])
}

// =============================================================================
// IMAGE HANDLING
// =============================================================================

/**
 * Creates photo navigation buttons for multi-image products
 */
function createPhotoNavigation(product, validImages, photoPage) {
  const photoNavigation = []
  
  if (validImages.length > CONFIG.photos_per_page) {
    const navigationRow = []
    if (photoPage > 0) {
      navigationRow.push({ 
        text: '⬅️ Попередні фото', 
        callback_data: `product_${product.id}_photos_${photoPage - 1}` 
      })
    }
    const endIndex = Math.min((photoPage + 1) * CONFIG.photos_per_page, validImages.length)
    if (endIndex < validImages.length) {
      navigationRow.push({ 
        text: 'Наступні фото ➡️', 
        callback_data: `product_${product.id}_photos_${photoPage + 1}` 
      })
    }
    if (navigationRow.length > 0) {
      photoNavigation.push(navigationRow)
    }
  }
  
  return photoNavigation
}

/**
 * Creates media group for multiple product images
 */
function createMediaGroup(product, photosToShow, startIndex, endIndex, totalImages) {
  return photosToShow.map((imagePath, index) => ({
    type: 'photo',
    media: { source: imagePath },
    caption: index === 0 
      ? `📸 Фото товару "${product.name}" (${startIndex + 1}-${endIndex} з ${totalImages})` 
      : undefined
  }))
}

/**
 * Sends product with images or falls back to text
 */
async function sendProductWithImages(ctx, product, productText, keyboard, deleteMessage = false, photoPage = 0) {
  const images = parseProductImages(product.images)
  const validImages = getValidImagePaths(images)

  if (validImages.length === 0) {
    return false
  }

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
      await sendMultipleImages(ctx, product, validImages, productText, keyboard, photoPage)
    }
    return true
  } catch (imgError) {
    console.log('Failed to send images, sending text instead:', imgError)
    return false
  }
}

/**
 * Handles sending multiple product images with pagination
 */
async function sendMultipleImages(ctx, product, validImages, productText, keyboard, photoPage) {
  const startIndex = photoPage * CONFIG.photos_per_page
  const endIndex = Math.min(startIndex + CONFIG.photos_per_page, validImages.length)
  const photosToShow = validImages.slice(startIndex, endIndex)

  const mediaGroup = createMediaGroup(product, photosToShow, startIndex, endIndex, validImages.length)
  await ctx.replyWithMediaGroup(mediaGroup)

  const photoNavigation = createPhotoNavigation(product, validImages, photoPage)
  
  if (photoNavigation.length > 0) {
    if (keyboard.reply_markup && keyboard.reply_markup.inline_keyboard) {
      keyboard.reply_markup.inline_keyboard = [...photoNavigation, ...keyboard.reply_markup.inline_keyboard]
    } else {
      keyboard.reply_markup = { inline_keyboard: photoNavigation }
    }
  }

  await ctx.reply(productText, keyboard)
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
            [{ text: MESSAGES.main_menu_btn, callback_data: 'main_menu' }]
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
            [{ text: MESSAGES.back, callback_data: 'back' }]
          ]
        }
      }

      await ctx.editMessageText(MESSAGES.categories, keyboard)
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

  bot.action('view_ai_recommendations', async(ctx) => {
    try {
      const recommendations = ctx.session.lastAiRecommendations || []
      
      if (recommendations.length === 0) {
        await ctx.editMessageText('Немає збережених рекомендацій для перегляду.')
        return
      }

      ctx.session.navigationStack = ctx.session.navigationStack || []
      ctx.session.navigationStack.push({ type: 'ai_recommendations' })

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            ...recommendations.map(product => [{
              text: `🛍 ${product.name} - ${product.price}₴`,
              callback_data: `product_${product.id}`
            }]),
            [
              { text: 'Рекомендовані категорії товарів', callback_data: 'view_ai_categories' },
              { text: MESSAGES.back, callback_data: 'back' }
            ]
          ]
        }
      }

      const headerText = `📋 AI Рекомендації

Ось усі товари, які я рекомендував для вас:

👆 Натисніть на товар для детального перегляду`

      await ctx.editMessageText(headerText, keyboard)
      await ctx.answerCbQuery()
    } catch (error) {
      console.error('Error showing AI recommendations:', error)
      await ctx.editMessageText('Сталася помилка завантаження рекомендацій.')
    }
  })

  bot.action('view_ai_categories', async(ctx) => {
    try {
      const recommendations = ctx.session.lastAiRecommendations || []
      
      if (recommendations.length === 0) {
        await ctx.editMessageText('Немає збережених рекомендацій для перегляду.')
        return
      }

      const productIds = recommendations.map(p => p.id)
      const categories = await db.all(`
        SELECT DISTINCT c.id, c.name 
        FROM categories c 
        JOIN products p ON p.category_id = c.id 
        WHERE p.id IN (${productIds.map(() => '?').join(',')}) 
        AND c.active = 1 
        ORDER BY c.name ASC
      `, productIds)

      if (categories.length === 0) {
        await ctx.editMessageText('Категорії не знайдені.')
        return
      }

      ctx.session.navigationStack = ctx.session.navigationStack || []
      ctx.session.navigationStack.push({ type: 'ai_categories' })

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            ...categories.map(cat => [{
              text: cat.name,
              callback_data: `category_${cat.id}`
            }]),
            [{ text: MESSAGES.back, callback_data: 'back' }]
          ]
        }
      }

      await ctx.editMessageText('🎯 Рекомендовані категорії товарів\n\nОберіть категорію:', keyboard)
      await ctx.answerCbQuery()
    } catch (error) {
      console.error('Error showing AI categories:', error)
      await ctx.editMessageText('Сталася помилка завантаження категорій.')
    }
  })

  bot.action(/category_(\d+)/, async(ctx) => {
    const categoryId = parseInt(ctx.match[1])

    try {
      const [category, products] = await Promise.all([
        db.get('SELECT * FROM categories WHERE id = ?', [categoryId]),
        getProductsByCategory(categoryId)
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
              [{ text: MESSAGES.back, callback_data: 'back' }]
            ]
          }
        }
        await ctx.editMessageText(`📂 ${category.name}\n\n${MESSAGES.no_products}`, keyboard)
        return
      }

      const keyboard = createProductListKeyboard(products)
      await ctx.editMessageText(`📂 ${category.name}\n\nОберіть товар:`, keyboard)
    } catch (error) {
      console.error('Error loading products:', error)
      await ctx.editMessageText('Сталася помилка завантаження товарів.')
    }
  })

  // Photo navigation handler
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

  // Product details handler
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

  // Size help handler
  bot.action(/size_help_(\d+)/, async(ctx) => {
    await ctx.answerCbQuery()
    const productId = parseInt(ctx.match[1])

    const sizeGuide = `📏 Довідка по розмірах\n\nЯ допоможу вам обрати правильний розмір.\n\nБудь ласка, виміряйте:\n• Обхват грудей (Г)\n• Обхват талії (Т) \n• Обхват стегон (С)\n\nТаблиця розмірів:\n\nXS: Г 84 | Т 66–76 | С 92 (UA 42)\nS: 88 | 70–80 | 96 (UA 44)\nM: 92 | 74–84 | 100 (UA 46)\nL: 96 | 78–88 | 104 (UA 48)\nXL: 100 | 82–90 | 108 (UA 50)\n2XL: 104 | 86–94 | 112 (UA 52)\n3XL: 108–114 | 90–98 | 116–126 (UA 54)\n4XL: 112–118 | 98–102 | 120–130 (UA 56)\n5XL: 116–122 | 102–106 | 124–134 (UA 58)\n6XL: 120–126 | 106–112 | 128–138 (UA 60)\n7XL: 124–130 | 112–118 | 132–142 (UA 62)\n\nВсі мірки в сантиметрах`

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬅ Назад до товару', callback_data: `back_to_product_${productId}` }]
        ]
      }
    }

    await ctx.reply(sizeGuide, keyboard)
  })

  // Back to product from size help
  bot.action(/back_to_product_(\d+)/, async(ctx) => {
    await ctx.answerCbQuery()
    const productId = parseInt(ctx.match[1])

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
        case 'browse_mode_selection':
          const browseKeyboard = createBrowseModeKeyboard()
          await ctx.editMessageText(MESSAGES.browse_selection, browseKeyboard)
          break
        case 'categories':
          const categories = await getActiveCategories()
          const categoriesKeyboard = createCategoriesKeyboard(categories)
          await ctx.editMessageText(MESSAGES.categories, categoriesKeyboard)
          break
        case 'category_products':
          const categoryId = previousState.categoryId
          const [category, products] = await Promise.all([
            db.get('SELECT * FROM categories WHERE id = ?', [categoryId]),
            getProductsByCategory(categoryId)
          ])
          const productsKeyboard = createProductListKeyboard(products)
          await ctx.editMessageText(`📂 ${category.name}\n\nОберіть товар:`, productsKeyboard)
          break
        case 'ai_recommendations':
        case 'ai_categories':
          const backKeyboard = createBrowseModeKeyboard()
          await ctx.editMessageText(MESSAGES.browse_selection, backKeyboard)
          break
        default:
          await ctx.deleteMessage()
      }
    } catch (error) {
      console.error('Navigation error:', error)
    }
  })

  // Order handler
  bot.action(/order_(\d+)/, async(ctx) => {
    const productId = parseInt(ctx.match[1])
    await ctx.answerCbQuery()
    return ctx.scene.enter('order-wizard', { productId })
  })

  // Main menu return
  bot.action('main_menu', async(ctx) => {
    await ctx.answerCbQuery()
    await ctx.deleteMessage()
    ctx.session.navigationStack = [{ type: 'main_menu' }]

    const { mainReplyKeyboard } = require('../keyboards/mainKeyboard')
    await ctx.reply(
      '🏠 Головне меню\n\nОберіть потрібний розділ:',
      mainReplyKeyboard
    )
  })

/**
 * Handles product photo navigation
 */
async function handleProductPhotoNavigation(ctx, productId, photoPage) {
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
}

/**
 * Handles product detail display
 */
async function handleProductDetails(ctx, productId) {
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
}

/**
 * Handles size help display
 */
async function handleSizeHelp(ctx, productId) {
  const sizeGuide = `📏 Довідка по розмірах\n\nЯ допоможу вам обрати правильний розмір.\n\nБудь ласка, виміряйте:\n• Обхват грудей (Г)\n• Обхват талії (Т) \n• Обхват стегон (С)\n\nТаблиця розмірів:\n\nXS: Г 84 | Т 66–76 | С 92 (UA 42)\nS: 88 | 70–80 | 96 (UA 44)\nM: 92 | 74–84 | 100 (UA 46)\nL: 96 | 78–88 | 104 (UA 48)\nXL: 100 | 82–90 | 108 (UA 50)\n2XL: 104 | 86–94 | 112 (UA 52)\n3XL: 108–114 | 90–98 | 116–126 (UA 54)\n4XL: 112–118 | 98–102 | 120–130 (UA 56)\n5XL: 116–122 | 102–106 | 124–134 (UA 58)\n6XL: 120–126 | 106–112 | 128–138 (UA 60)\n7XL: 124–130 | 112–118 | 132–142 (UA 62)\n\nВсі мірки в сантиметрах`

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '⬅ Назад до товару', callback_data: `back_to_product_${productId}` }]
      ]
    }
  }

  // Use reply instead of editMessageText for compatibility with photo messages
  await ctx.reply(sizeGuide, keyboard)
}

/**
 * Handles return to product from size help
 */
async function handleBackToProduct(ctx, productId) {
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
}
}

module.exports = { setupProductHandlers }
