const OpenAI = require('openai')
const db = require('../database/connection')

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    this.conversations = new Map()

    this.faqAnswers = {
      assortment: `🛍 **Наш асортимент:**

Ми пропонуємо великий вибір жіночого домашнього одягу та аксесуарів:
• Комплекти з мереживом: майки, шорти, комбінації, халати, повні комплекти з 4 предметів
• Халати "Гейша": короткі (80 см), довгі (130 см), з принтами
• Піжами: сорочка з шортами, довгі сорочки, велюрові комплекти, топи з шортами
• Сети "Гарна": однотонні або з принтом
• Пухнасті тапулі (домашні тапки)
• Шорти з розрізом: однотонні та з принтом
• Одяг для вулиці: комплекти з сорочкою і брюками, шортами або 3-в-1
• Нічні сорочки: асиметрія, максі, міні, принти
• Та інші затишні речі для дому

📝 Якщо ви шукаєте щось конкретне — напишіть у будь-якій формі, наприклад "халат довгий", "піжама велюр", "шорти с разрезом" — я підберу варіанти!

🎯 Чи можу допомогти з чимось ще?`,

      delivery: `📦 **Доставка:**

Доставка виключно через "Нову пошту" по всій Україні: у відділення, поштомат або кур'єром.

⏱ **Коли відправка:**
• Відправка замовлення протягом 1–3 днів
• Ви отримаєте SMS або повідомлення від "Нової пошти", коли посилка буде в дорозі
• Автоповернення через 7 днів з моменту прибуття

⚠️ **ВАЖЛИВО:**
• Перевіряйте товар у відділенні — цілісність, комплектацію, розмір, колір
• Якщо є проблема — можна відмовитись одразу
• При замовленні у поштомат перевірка неможлива
• Поза відділенням претензії не приймаються
• Якщо забрали товар — вважається, що все в порядку

🎯 Чи можу допомогти з чимось ще?`,

      payment: `💳 **Варіанти оплати:**

📮 **Без передоплати** (рекомендуємо):
• Відправляємо без передоплати (накладений платіж) через "Нову пошту"
• Оплата при отриманні з правом огляду

💰 **Передоплата 100%:**
За бажанням можна зробити передоплату на реквізити ФОП:

**UA163510050000026002879250787**
ЄДРПОУ: 3076714494
Отримувач: ІВАХНЕНКО РОМАН ЛЕОНІДОВИЧ
Призначення платежу: «оплата за товар»

❓ Який спосіб оплати обираєте?

🎯 Чи можу допомогти з чимось ще?`,

      sizes: `📏 **Підбір розміру:**

Давайте підберемо вам ідеальний розмір! 📐

Напишіть, будь ласка:
• обхват грудей (см)
• обхват талії (см)
• обхват стегон (см)

**Наша таблиця розмірів:**

**XS** — Г: 84 | Т: 66–76 | С: 92 | UA 42
**S** — Г: 88 | Т: 70–80 | С: 96 | UA 44
**M** — Г: 92 | Т: 74–84 | С: 100 | UA 46
**L** — Г: 96 | Т: 78–88 | С: 104 | UA 48
**XL** — Г: 100 | Т: 82–90 | С: 108 | UA 50
**2XL** — Г: 104 | Т: 86–94 | С: 112 | UA 52
**3XL** — Г: 108–114 | Т: 90–98 | С: 116–126 | UA 54
**4XL** — Г: 112–118 | Т: 98–102 | С: 120–130 | UA 56
**5XL** — Г: 116–122 | Т: 102–106 | С: 124–134 | UA 58
**6XL** — Г: 120–126 | Т: 106–112 | С: 128–138 | UA 60
**7XL** — Г: 124–130 | Т: 112–118 | С: 132–142 | UA 62

💡 **Порада:** Якщо ваші параметри між двома розмірами — краще обирати більший.

🎯 Чи можу допомогти з чимось ще?`,

      material: `🧵 **Матеріал:**

Це шовк Армані — преміальний матеріал з ніжною текстурою, легким блиском і дуже приємний до тіла.

✨ **Переваги:**
• Виготовлений із високоякісного волокна
• Міцний, легко переться
• Зберігає колір і форму
• Дарує відчуття комфорту та розкоші

🧼 **Догляд:**
• Ручне або делікатне прання при температурі до 30°C
• Без відбілювачів, з мінімальним віджимом
• Сушити природним способом, не на прямому сонці
• Праска на низькій температурі

🎯 Чи можу допомогти з чимось ще?`,

      exchange: `🔄 **Обмін/повернення:**

Ми завжди готові здійснити обмін на інший розмір або товар з нашого асортименту протягом 14 днів з моменту відправлення замовлення.

✅ **Умови обміну:**
• Товар не повинен бути у використанні
• Без пошкоджень або слідів носіння
• Зі збереженням товарного вигляду та упаковки
• Обмін оформлюється протягом 3–5 робочих днів
• Обмін оплачує відправник (крім випадків дефекту)

💰 **Повернення коштів:**
• Лише якщо товар був відправлений і не отриманий
• Повернення оформлюється у відділенні пошти
• Якщо товар отримано — можливий лише обмін

📦 При замовленні доставки "Новою поштою" можна скористатися послугою "Легке повернення".

🎯 Чи можу допомогти з чимось ще?`,

      promos: `🎁 **Акції та знижки:**

Час від часу бувають сезонні акції та знижки. 

Напишіть, який товар вас цікавить, і я перевірю наявність спеціальної пропозиції! 🛍

🎯 Чи можу допомогти з чимось ще?`,

      gift: `🎁 **Подарункове оформлення:**

Так, можемо красиво упакувати замовлення та додати листівку з вашим побажанням! 💌

Просто вкажіть при оформленні замовлення, що це подарунок.

🎯 Чи можу допомогти з чимось ще?`,

      plus_sizes: `👗 **Батальні розміри:**

Так, у нас є моделі до 7XL (UA 62)! 

Я підкажу, які саме доступні у вашому розмірі. Напишіть, який розмір вас цікавить або ваші параметри.

🎯 Чи можу допомогти з чимось ще?`,

      custom: `✂️ **Індивідуальне пошиття:**

Зараз працюємо тільки з готовими моделями та розмірами з каталогу. 

Можу допомогти підібрати максимально близький варіант під ваші потреби! 🎯

🎯 Чи можу допомогти з чимось ще?`
    }
  }

  normalizeText(text) {
    return text.toLowerCase()
      .replace(/[^\w\sа-яіїєґ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  fuzzyMatch(text, pattern) {
    const normalizedText = this.normalizeText(text)
    const normalizedPattern = this.normalizeText(pattern)

    if (normalizedText.includes(normalizedPattern)) return 1.0

    const words = normalizedPattern.split(' ')
    const matches = words.filter(word => normalizedText.includes(word))
    return matches.length / words.length
  }

  checkFAQQuestion(userMessage) {
    const message = this.normalizeText(userMessage)

    const faqPatterns = [
      {
        patterns: ['асортимент', 'що у вас є', 'які товари', 'каталог', 'вибір', 'що продаєте', 'який у вас асортимент'],
        answer: this.faqAnswers.assortment,
        confidence: 0.9
      },
      {
        patterns: ['доставка', 'відправка', 'коли отримаю', 'скільки везуть', 'нова пошта', 'доставляєте'],
        answer: this.faqAnswers.delivery,
        confidence: 0.9
      },
      {
        patterns: ['оплата', 'платіж', 'як заплатити', 'без передоплати', 'реквізити', 'накладений'],
        answer: this.faqAnswers.payment,
        confidence: 0.9
      },
      {
        patterns: ['розмір', 'як обрати', 'таблиця розмірів', 'міри', 'параметри', 'підібрати розмір', 'розмірна сітка'],
        answer: this.faqAnswers.sizes,
        confidence: 0.9
      },
      {
        patterns: ['матеріал', 'тканина', 'з чого', 'шовк', 'армані', 'склад'],
        answer: this.faqAnswers.material,
        confidence: 0.9
      },
      {
        patterns: ['обмін', 'повернення', 'можна повернути', 'обміняти', 'не підійшов'],
        answer: this.faqAnswers.exchange,
        confidence: 0.9
      },
      {
        patterns: ['акція', 'знижка', 'розпродаж', 'спецпропозиція'],
        answer: this.faqAnswers.promos,
        confidence: 0.9
      },
      {
        patterns: ['подарунок', 'упакувати', 'листівка', 'подарочне'],
        answer: this.faqAnswers.gift,
        confidence: 0.9
      },
      {
        patterns: ['батальні', 'великі розміри', '7xl', '6xl', '5xl', '4xl', '3xl'],
        answer: this.faqAnswers.plus_sizes,
        confidence: 0.9
      },
      {
        patterns: ['на замовлення', 'індивідуальне', 'пошити', 'під замовлення', 'зшити'],
        answer: this.faqAnswers.custom,
        confidence: 0.9
      }
    ]

    for (const faq of faqPatterns) {
      for (const pattern of faq.patterns) {
        const score = this.fuzzyMatch(message, pattern)
        if (score >= 0.85) {
          return {
            type: 'faq',
            answer: faq.answer,
            confidence: score * faq.confidence
          }
        }
      }
    }

    return null
  }

  checkProductQuery(userMessage) {
    const message = this.normalizeText(userMessage)

    const productKeywords = [
      'халат', 'довгий', 'короткий', 'піжама', 'велюр', 'шорти', 'розріз',
      'нічна сорочка', 'мереживо', 'комплект', 'гейша', 'гарна', 'тапулі',
      'топ', 'майка', 'комбінація', 'принт', 'однотонний', 'асиметрія',
      'максі', 'міні', 'затишний', 'домашній', 'одяг', 'вулиця'
    ]

    const matches = productKeywords.filter(keyword => message.includes(keyword))
    const confidence = matches.length > 0 ? Math.min(matches.length / 3, 1) : 0

    if (confidence >= 0.3) {
      return {
        type: 'product_query',
        keywords: matches,
        confidence
      }
    }

    return null
  }

  getConversationContext(userId) {
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, {
        messages: [],
        lastRecommendedProducts: [],
        createdAt: Date.now()
      })
    }
    return this.conversations.get(userId)
  }

  cleanOldConversations() {
    const now = Date.now()
    const maxAge = 30 * 60 * 1000

    for (const [userId, context] of this.conversations.entries()) {
      if (now - context.createdAt > maxAge) {
        this.conversations.delete(userId)
      }
    }
  }

  // Handle follow-up questions about previously recommended products
  async handleFollowUpQuestion(userMessage, context, products) {
    const message = userMessage.toLowerCase()
    const lastProducts = context.lastRecommendedProducts

    if (lastProducts.length === 0) return null
    if (/кольор|цвіт|color|що є за кольор|які кольори|колір/i.test(message)) {
      const productInfo = lastProducts.map(product => {
        const fullProduct = products.find(p => p.id === product.id)
        if (!fullProduct) return null

        try {
          const variants = JSON.parse(fullProduct.description || '{}')
          const colors = variants.colors || []
          return colors.length > 0
            ? `🎨 **${product.name}**: ${colors.join(', ')}`
            : `🎨 **${product.name}**: інформація про кольори уточнюється`
        } catch {
          return `🎨 **${product.name}**: інформація про кольори уточнюється`
        }
      }).filter(Boolean)

      if (productInfo.length > 0) {
        return {
          text: `🎨 **Доступні кольори:**\n\n${productInfo.join('\n\n')}\n\n🎯 Чи можу допомогти з чимось ще?`,
          recommendedProducts: lastProducts
        }
      }
    }

    if (/розмір|size|який розмір|розмірна сітка/i.test(message)) {
      const productInfo = lastProducts.map(product => {
        const fullProduct = products.find(p => p.id === product.id)
        if (!fullProduct) return null

        try {
          const variants = JSON.parse(fullProduct.description || '{}')
          const sizes = variants.sizes || []
          return sizes.length > 0
            ? `📏 **${product.name}**: ${sizes.join(', ')}`
            : `📏 **${product.name}**: універсальний розмір`
        } catch {
          return `📏 **${product.name}**: уточнюється`
        }
      }).filter(Boolean)

      if (productInfo.length > 0) {
        return {
          text: `📏 **Доступні розміри:**\n\n${productInfo.join('\n\n')}\n\n${this.faqAnswers.sizes}`,
          recommendedProducts: lastProducts
        }
      }
    }

    return null
  }

  async getProductRecommendations(userMessage, userId) {
    try {
      this.cleanOldConversations()

      const faqResponse = this.checkFAQQuestion(userMessage)
      if (faqResponse && faqResponse.confidence >= 0.85) {
        return {
          text: faqResponse.answer,
          recommendedProducts: []
        }
      }

      const productQuery = this.checkProductQuery(userMessage)
      if (productQuery && productQuery.confidence >= 0.78) {
        console.log('Product query detected:', productQuery)
      } else if (productQuery && productQuery.confidence < 0.6) {
        return {
          text: `Щоб точно відповісти, уточніть, будь ласка:

• Який тип одягу вас цікавить?
• Який розмір потрібен?
• Які кольори вподобаєте?

💬 Або напишіть у вільній формі, наприклад: "халат довгий", "піжама велюр", "шорти з розрізом"

🎯 Чи можу допомогти з чимось ще?`,
          recommendedProducts: []
        }
      }

      const context = this.getConversationContext(userId)
      const products = await db.all(`
        SELECT p.id, p.name, p.description, p.price, p.sale_price, 
               p.stock_quantity, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.active = 1 AND p.stock_quantity > 0
        ORDER BY c.name, p.name
      `)

      const followUpResponse = await this.handleFollowUpQuestion(userMessage, context, products)
      if (followUpResponse) {
        return followUpResponse
      }

      const allProducts = products.map(p => {
        let variants = { colors: [], sizes: [] }
        try {
          if (p.description) {
            variants = JSON.parse(p.description)
          }
        } catch (e) {
        }

        return {
          id: p.id,
          name: p.name,
          price: p.sale_price || p.price,
          category: p.category_name,
          colors: variants.colors || [],
          sizes: variants.sizes || [],
          stock: p.stock_quantity
        }
      })

      const messageWords = userMessage.toLowerCase().split(' ')
      const relevantProducts = allProducts
        .map(product => {
          let relevanceScore = 0
          const productName = product.name.toLowerCase()
          const category = (product.category || '').toLowerCase()

          messageWords.forEach(word => {
            if (productName.includes(word)) relevanceScore += 3
            if (category.includes(word)) relevanceScore += 2
          })

          if (userMessage.match(/халат/i) && productName.includes('халат')) relevanceScore += 5
          if (userMessage.match(/піжам/i) && productName.includes('піжам')) relevanceScore += 5
          if (userMessage.match(/сорочк/i) && productName.includes('сорочк')) relevanceScore += 5
          if (userMessage.match(/шорт/i) && productName.includes('шорт')) relevanceScore += 5
          if (userMessage.match(/комплект/i) && productName.includes('комплект')) relevanceScore += 5

          return { ...product, relevanceScore }
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 30)

      const catalogSummary = relevantProducts.map(p =>
        `${p.name}: ${p.price}₴${p.colors.length > 0 ? ` (${p.colors.slice(0, 3).join(', ')})` : ''}`
      ).join('\n')

      const systemPrompt = `Ви - ввічливий помічник магазину "Відома вдома". 

ОСНОВНІ ПРАВИЛА:
1. Спочатку шукайте точну відповідь у FAQ 
2. Якщо не знайдено - шукайте у внутрішніх документах
3. Якщо бракує даних - ставте уточнюючі питання
4. НІКОЛИ не вигадуйте факти
5. Відповідайте коротко, ясно та дружньо
6. Використовуйте українську мову
7. Завжди завершуйте фразою "🎯 Чи можу допомогти з чимось ще?"

Релевантні товари з каталогу:
${catalogSummary}

Асортимент:
• Комплекти з мереживом: майки, шорти, комбінації, халати, повні комплекти з 4 предметів
• Халати "Гейша": короткі (80 см), довгі (130 см), з принтами  
• Піжами: сорочка з шортами, довгі сорочки, велюрові комплекти, топи з шортами
• Сети "Гарна": однотонні або з принтом
• Пухнасті тапулі (домашні тапки)
• Шорти з розрізом: однотонні та з принтом
• Одяг для вулиці: комплекти з сорочкою і брюками, шортами або 3-в-1
• Нічні сорочки: асиметрія, максі, міні, принти
• Та інші затишні речі для дому

ІНФОРМАЦІЯ:
📦 Доставка: "Нова Пошта" по Україні (відділення, поштомат, кур'єр)
💳 Оплата: Накладений платіж (без передоплати) з оглядом або передоплата 100% на рахунок ФОП
🧵 Матеріал: Шовк Армані - м'який блиск, приємний дотик, міцний, легко переться
📏 Розміри: XS-7XL (UA 42-62)
🔄 Обмін: протягом 14 днів, товар без використання
💰 Повернення: тільки якщо товар відправлено але не отримано
🎁 Подарунки: можемо упакувати та додати листівку

ВЗАЄМОДІЯ:
- Рекомендуйте конкретні товари з каталогу
- Вказуйте доступні кольори та розміри
- Якщо немає точних даних - пропонуйте уточнення
- Не вигадуйте наявність чи ціни без джерела`

      const messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...context.messages,
        {
          role: 'user',
          content: userMessage
        }
      ]

      const recentMessages = [
        messages[0],
        ...messages.slice(-4)
      ]

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: recentMessages,
        max_tokens: 600,
        temperature: 0.7
      })

      const aiResponse = completion.choices[0]?.message?.content
      const recommendedProducts = this.extractProductRecommendations(aiResponse, relevantProducts)

      context.messages.push(
        { role: 'user', content: userMessage.substring(0, 200) },
        { role: 'assistant', content: aiResponse ? aiResponse.substring(0, 500) : '' }
      )

      if (context.messages.length > 6) {
        context.messages = context.messages.slice(-4)
      }

      if (recommendedProducts.length > 0) {
        context.lastRecommendedProducts = recommendedProducts
      }

      context.createdAt = Date.now()

      return {
        text: aiResponse || 'Вибачте, не вдалося отримати відповідь від AI помічника.',
        recommendedProducts: recommendedProducts || []
      }
    } catch (error) {
      console.error('AI Service Error:', error)
      return {
        text: `Вибачте, зараз у мене технічні проблеми з AI-консультацією. 😔

Ви можете:
🛍 Переглянути товари через меню
📝 Написати ваше питання, і наші співробітники відповідатимуть вручну
🏠 Використати /start для повернення до головного меню`,
        recommendedProducts: []
      }
    }
  }

  extractProductRecommendations(aiResponse, products) {
    const recommendations = []

    if (!aiResponse || !products) return recommendations

    const lowerResponse = aiResponse.toLowerCase()

    products.forEach(product => {
      const productNameLower = product.name.toLowerCase()

      if (lowerResponse.includes(productNameLower)) {
        recommendations.push({
          id: product.id,
          name: product.name,
          price: product.sale_price || product.price
        })
        return
      }

      const nameWords = productNameLower.split(' ')
      let matchCount = 0
      nameWords.forEach(word => {
        if (word.length > 3 && lowerResponse.includes(word)) {
          matchCount++
        }
      })

      if (nameWords.length > 1 && matchCount >= Math.ceil(nameWords.length / 2)) {
        recommendations.push({
          id: product.id,
          name: product.name,
          price: product.sale_price || product.price
        })
      }
    })

    const uniqueRecommendations = recommendations.filter((item, index, self) =>
      index === self.findIndex(t => t.id === item.id)
    )

    return uniqueRecommendations.slice(0, 5)
  }

  createRecommendationKeyboard(recommendedProducts) {
    const buttons = []

    if (recommendedProducts && Array.isArray(recommendedProducts)) {
      recommendedProducts.forEach(product => {
        buttons.push([{
          text: `🛍 ${product.name} - ${product.price}₴`,
          callback_data: `product_${product.id}`
        }])
      })
    }

    buttons.push([
      { text: '🛍 Переглянути всі товари', callback_data: 'browse_products' },
      { text: '🏠 Головне меню', callback_data: 'main_menu' }
    ])

    return {
      reply_markup: {
        inline_keyboard: buttons
      }
    }
  }
}

module.exports = new AIService()
