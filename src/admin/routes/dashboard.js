const express = require('express')
const router = express.Router()

router.get('/', (req, res) => {
  res.render('dashboard', {
    title: 'Dashboard',
    currentPage: 'dashboard',
    user: req.session.admin
  })
})

module.exports = router
