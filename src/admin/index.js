const express = require('express')
const session = require('express-session')
const path = require('path')
const expressLayouts = require('express-ejs-layouts')
const methodOverride = require('method-override')
const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(methodOverride('_method'))
app.use(session({
  secret: 'admin-secret',
  resave: false,
  saveUninitialized: false
}))
app.use(express.static(path.join(__dirname, '../../public')))
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.set('layout', 'layouts/main')
app.use(expressLayouts)

let botInstance = null

const authMiddleware = require('./middleware/auth')
app.use('/auth', require('./routes/auth'))
app.use('/dashboard', authMiddleware, require('./routes/dashboard'))
app.use('/admin/products', authMiddleware, require('./routes/products'))
app.use('/admin/categories', authMiddleware, require('./routes/categories'))
app.use('/admin/settings', authMiddleware, require('./routes/settings'))

const { handleCRMWebhook } = require('../webhooks/crmWebhook')

app.post('/webhook/crm', async (req, res) => {
  console.log('CRM webhook received:', req.body)
  
  try {
    if (!botInstance) {
      return res.status(503).json({ success: false, message: 'Bot not initialized' })
    }
    
    const result = await handleCRMWebhook(botInstance, req.body)
    res.json(result)
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})


app.setBotInstance = (bot) => {
  botInstance = bot
  console.log('Bot instance set in admin app')
}

app.get('/', (req, res) => {
  if (req.session && req.session.admin) {
    res.redirect('/dashboard')
  } else {
    res.redirect('/auth/login')
  }
})


module.exports = app
