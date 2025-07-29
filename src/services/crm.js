const axios = require('axios')

class CRMService {
  constructor() {
    this.apiKey = process.env.CRM_API_KEY
    this.apiUrl = process.env.CRM_API_URL
  }

  async createOrder(orderData) {
    try {
      const payload = {
        form: this.apiKey,
        getResultData: '1',
        products: orderData.products.map(product => ({
          id: product.id.toString(),
          name: product.name,
          costPerItem: product.price.toString(),
          amount: (product.quantity || 1).toString(),
          description: product.description || ''
        })),
        comment: orderData.notes || '',
        externalId: orderData.telegramOrderId || '',
        fName: orderData.customerFirstName || orderData.customerName,
        lName: orderData.customerLastName || '',
        phone: orderData.customerPhone,
        email: orderData.customerEmail || '',
        con_telegram: orderData.telegramUsername || '',
        shipping_method: orderData.deliveryMethod || '',
        payment_method: orderData.paymentMethod || '',
        shipping_address: orderData.deliveryAddress || '',
        novaposhta: orderData.novaPoshta || {},
        sajt: 'Telegram Bot'
      }

      const response = await axios.post(
        `${this.apiUrl}/handler/`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      )

      console.log('CRM Payload novaposhta:', JSON.stringify(payload.novaposhta, null, 2))
      console.log('CRM Response:', response.data)

      return {
        success: true,
        orderId: response.data.id || response.data.order_id || Date.now(),
        data: response.data
      }
    } catch (error) {
      console.error('CRM API Error:', error.response?.data || error.message)
      return {
        success: false,
        error: error.response?.data?.message || error.message
      }
    }
  }
}

module.exports = new CRMService()
