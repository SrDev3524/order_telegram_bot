const OpenAI = require('openai')
const db = require('../database/connection')

class AIService {
  constructor() {

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }

  async getProductRecommendations(userMessage, _userId) {
    try {
      // Get all active products with categories
      const products = await db.all(`
        SELECT p.id, p.name, p.description, p.price, p.sale_price, 
               p.stock_quantity, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.active = 1 AND p.stock_quantity > 0
        ORDER BY c.name, p.name
      `)

      // Parse product variants from description
      const enhancedCatalog = products.map(p => {
        let variants = { colors: [], sizes: [] };
        try {
          if (p.description) {
            variants = JSON.parse(p.description);
          }
        } catch (e) {
          // Description might not be JSON
        }
        
        return {
          id: p.id,
          name: p.name,
          price: p.sale_price || p.price,
          category: p.category_name,
          colors: variants.colors || [],
          sizes: variants.sizes || [],
          stock: p.stock_quantity
        };
      });

      const systemPrompt = `Ви - консультант інтернет-магазину Vidoma, що спеціалізується на домашньому одязі та піжамах.

Каталог товарів з доступними кольорами та розмірами:
${JSON.stringify(enhancedCatalog, null, 2)}

Ваші завдання:
1. Відповідайте українською мовою
2. Будьте дружнім та професійним консультантом
3. Рекомендуйте конкретні товари з каталогу на основі запиту користувача
4. Згадуйте доступні кольори та розміри товарів
5. Давайте корисні поради щодо вибору розмірів та догляду
6. Якщо користувач згадує колір або розмір, покажіть товари що є в наявності в таких варіантах
7. Завжди завершуйте відповідь пропозицією допомоги

Категорії товарів:
- Комплекти з мереживом (різні кольори та розміри)
- Гейша (кімоно та халати)
- Для вулиці (велюрові комплекти)
- Нічні сорочки (різні довжини)
- Піжами (з принтом та без)
- Пухнасті тапулі
- Сет «Гарна»
- Шорти з розрізом
- Інше

Формат відповіді:
- Короткий привітальний текст
- Рекомендації товарів (назва, ціна, доступні кольори та розміри)
- Корисні поради
- Пропозиція додаткової допомоги`

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 800,
        temperature: 0.7
      })

      const aiResponse = completion.choices[0]?.message?.content
      const recommendedProducts = this.extractProductRecommendations(aiResponse, products)

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

    // Look for product names mentioned in AI response
    products.forEach(product => {
      if (aiResponse.includes(product.name)) {
        recommendations.push({
          id: product.id,
          name: product.name,
          price: product.sale_price || product.price
        })
      }
    })

    // Limit to top 3 recommendations
    return recommendations.slice(0, 3)
  }

  createRecommendationKeyboard(recommendedProducts) {
    const buttons = []

    // Add product buttons
    if (recommendedProducts && Array.isArray(recommendedProducts)) {
        recommendedProducts.forEach(product => {
          buttons.push([{
            text: `🛍 ${product.name} - ${product.price}₴`,
            callback_data: `product_${product.id}`
          }])
        })
      }

    // Add navigation buttons
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
