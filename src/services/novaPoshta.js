const axios = require('axios')

class NovaPoshtaService {
  constructor() {
    this.apiKey = process.env.NOVA_POSHTA_API_KEY
    this.apiUrl = 'https://api.novaposhta.ua/v2.0/json/'
  }

  // Search cities by name
  async searchCities(cityName) {
    try {
      const response = await axios.post(this.apiUrl, {
        apiKey: this.apiKey,
        modelName: 'Address',
        calledMethod: 'getCities',
        methodProperties: {
          FindByString: cityName
        }
      })

      if (response.data.success) {
        return response.data.data.map(city => ({
          name: city.Description,
          area: city.Area,
          region: city.Region,
          ref: city.Ref
        }))
      }

      return []
    } catch (error) {
      console.error('Nova Poshta API error (searchCities):', error)
      return []
    }
  }

  // Get warehouses in specific city
  async getWarehouses(cityRef) {
    try {
      const response = await axios.post(this.apiUrl, {
        apiKey: this.apiKey,
        modelName: 'AddressGeneral',
        calledMethod: 'getWarehouses',
        methodProperties: {
          CityRef: cityRef
        }
      })

      if (response.data.success) {
        return response.data.data.map(warehouse => ({
          number: warehouse.Number,
          description: warehouse.Description,
          address: warehouse.ShortAddress,
          ref: warehouse.Ref,
          siteKey: warehouse.SiteKey,
          typeOfWarehouse: warehouse.TypeOfWarehouse
        }))
      }

      return []
    } catch (error) {
      console.error('Nova Poshta API error (getWarehouses):', error)
      return []
    }
  }

  // Track parcel by TTN
  async trackTTN(ttn) {
    try {
      const response = await axios.post(this.apiUrl, {
        apiKey: this.apiKey,
        modelName: 'TrackingDocument',
        calledMethod: 'getStatusDocuments',
        methodProperties: {
          Documents: [{ DocumentNumber: ttn }]
        }
      })

      if (response.data.success && response.data.data[0]) {
        const trackData = response.data.data[0]
        return {
          number: trackData.Number,
          status: trackData.Status,
          statusCode: trackData.StatusCode,
          warehouseSender: trackData.WarehouseSender,
          warehouseRecipient: trackData.WarehouseRecipient,
          dateCreated: trackData.DateCreated,
          scheduledDeliveryDate: trackData.ScheduledDeliveryDate,
          actualDeliveryDate: trackData.ActualDeliveryDate,
          recipientDateTime: trackData.RecipientDateTime,
          weight: trackData.Weight,
          cost: trackData.Cost,
          redelivery: trackData.RedeliverySum
        }
      }

      return null
    } catch (error) {
      console.error('Nova Poshta API error (trackTTN):', error)
      return null
    }
  }

  // Format city selection for Telegram inline keyboard
  formatCitiesForKeyboard(cities) {
    if (cities.length === 0) {
      return {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Міста не знайдено', callback_data: 'no_cities' }]
          ]
        }
      }
    }

    // Limit to first 8 cities to avoid keyboard size issues
    const limitedCities = cities.slice(0, 8)
    
    return {
      reply_markup: {
        inline_keyboard: [
          ...limitedCities.map(city => [{
            text: `${city.name} (${city.area})`,
            callback_data: `city_${city.ref}`
          }]),
          [{ text: '❌ Скасувати', callback_data: 'cancel_order' }]
        ]
      }
    }
  }

  // Format warehouses for Telegram inline keyboard
  formatWarehousesForKeyboard(warehouses) {
    if (warehouses.length === 0) {
      return {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Відділення не знайдено', callback_data: 'no_warehouses' }]
          ]
        }
      }
    }

    // Group warehouses by type and limit display
    const sortedWarehouses = warehouses.sort((a, b) => {
      // Prioritize regular warehouses over parcel machines
      if (a.typeOfWarehouse !== b.typeOfWarehouse) {
        return a.typeOfWarehouse === 'Warehouse' ? -1 : 1
      }
      return parseInt(a.number) - parseInt(b.number)
    })

    const limitedWarehouses = sortedWarehouses.slice(0, 10)

    return {
      reply_markup: {
        inline_keyboard: [
          ...limitedWarehouses.map(warehouse => [{
            text: `${warehouse.number} - ${warehouse.description.substring(0, 35)}...`,
            callback_data: `warehouse_${warehouse.ref}`
          }]),
          [{ text: '⬅ Змінити місто', callback_data: 'change_city' }],
          [{ text: '❌ Скасувати', callback_data: 'cancel_order' }]
        ]
      }
    }
  }

  // Prepare Nova Poshta data for CRM
  prepareForCRM(cityData, warehouseData) {
    return {
      ServiceType: 'Warehouse',
      payer: 'recipient',
      area: cityData.area,
      region: cityData.region,
      city: cityData.name,
      WarehouseNumber: warehouseData.number,
      // Add fields that CRM expects
      cityNameFormat: 'full',
      cityRef: cityData.ref,
      warehouseRef: warehouseData.ref
    }
  }

  // Format tracking info for user display
  formatTrackingInfo(trackData) {
    if (!trackData || !trackData.status) {
      return '❌ Інформація про відправлення не знайдена.'
    }

    let result = `📦 Статус доставки\n\n`
    result += `📮 ТТН: ${trackData.number}\n`
    result += `📋 Статус: ${trackData.status}\n`
    
    if (trackData.warehouseSender) {
      result += `📍 Відправлення: ${trackData.warehouseSender}\n`
    }
    
    if (trackData.warehouseRecipient) {
      result += `📍 Отримання: ${trackData.warehouseRecipient}\n`
    }
    
    if (trackData.dateCreated) {
      result += `📅 Дата створення: ${new Date(trackData.dateCreated).toLocaleDateString('uk-UA')}\n`
    }
    
    if (trackData.scheduledDeliveryDate) {
      result += `🚚 Очікувана доставка: ${new Date(trackData.scheduledDeliveryDate).toLocaleDateString('uk-UA')}\n`
    }

    if (trackData.actualDeliveryDate) {
      result += `✅ Доставлено: ${new Date(trackData.actualDeliveryDate).toLocaleDateString('uk-UA')}\n`
    }

    if (trackData.weight) {
      result += `⚖️ Вага: ${trackData.weight} кг\n`
    }

    if (trackData.cost) {
      result += `💰 Вартість доставки: ${trackData.cost} грн\n`
    }

    return result
  }
}

module.exports = new NovaPoshtaService()