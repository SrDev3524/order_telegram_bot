const express = require('express')
const session = require('express-session')
const path = require('path')
const expressLayouts = require('express-ejs-layouts')
const methodOverride = require('method-override')
const app = express()

// Multer configuration moved to individual route files

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(methodOverride('_method'))
app.use(session({
  secret: 'admin-secret',
  resave: false,
  saveUninitialized: false
}))
// Consolidated static file serving
app.use(express.static(path.join(__dirname, '../../public')))
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.set('layout', 'layouts/main')
// Upload configuration removed from app locals
app.use(expressLayouts)

const authMiddleware = require('./middleware/auth')
app.use('/auth', require('./routes/auth'))
app.use('/dashboard', authMiddleware, require('./routes/dashboard'))
app.use('/admin/products', authMiddleware, require('./routes/products'))
app.use('/admin/categories', authMiddleware, require('./routes/categories'))
app.use('/admin/settings', authMiddleware, require('./routes/settings'))

app.get('/', (req, res) => {
  if (req.session && req.session.admin) {
    res.redirect('/dashboard')
  } else {
    res.redirect('/auth/login')
  }
})
app.listen(process.env.PORT || 80, () => console.log(`Admin panel running on http://localhost:${process.env.PORT || 80}`))
