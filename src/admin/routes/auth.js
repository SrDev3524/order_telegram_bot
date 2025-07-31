const express = require('express')
const router = express.Router()

router.get('/login', (req, res) => {
  res.render('auth/login', { title: 'Login', error: null, layout: false })
})

router.post('/login', (req, res) => {
  const { username, password } = req.body
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  if (username === 'admin' && password === adminPassword) {
    req.session.admin = { username: 'admin' }
    return res.redirect('/dashboard')
  }
  res.render('auth/login', { title: 'Login', error: 'Invalid credentials', layout: false })
})

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/auth/login'))
})

module.exports = router
