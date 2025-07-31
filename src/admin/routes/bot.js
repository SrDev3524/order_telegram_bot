const express = require('express')
const router = express.Router()
const botControl = require('../../services/botControl')

// Bot status page
router.get('/', async (req, res) => {
  try {
    const status = botControl.getStatus()
    res.render('bot', {
      title: 'Bot Control',
      currentPage: 'bot',
      user: req.session.admin,
      botStatus: {
        ...status,
        uptimeFormatted: status.uptime > 0 ? botControl.formatUptime(status.uptime) : '0s'
      },
      error: req.query.error,
      success: req.query.success
    })
  } catch (error) {
    console.error('Error loading bot page:', error)
    res.render('bot', {
      title: 'Bot Control',
      currentPage: 'bot',
      user: req.session.admin,
      botStatus: { isRunning: false, uptime: 0, uptimeFormatted: '0s' },
      error: 'Failed to load bot status'
    })
  }
})

// Start bot
router.post('/start', async (req, res) => {
  try {
    const result = await botControl.startBot()
    res.json({ success: result.message })
  } catch (error) {
    console.error('Start bot error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Stop bot
router.post('/stop', async (req, res) => {
  try {
    const result = await botControl.stopBot()
    res.json({ success: result.message })
  } catch (error) {
    console.error('Stop bot error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Restart bot
router.post('/restart', async (req, res) => {
  try {
    const result = await botControl.restartBot()
    res.json({ success: result.message })
  } catch (error) {
    console.error('Restart bot error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get bot status (API)
router.get('/status', async (req, res) => {
  try {
    const status = botControl.getStatus()
    res.json({
      ...status,
      uptimeFormatted: status.uptime > 0 ? botControl.formatUptime(status.uptime) : '0s'
    })
  } catch (error) {
    console.error('Status error:', error)
    res.status(500).json({ error: 'Failed to get bot status' })
  }
})

module.exports = router