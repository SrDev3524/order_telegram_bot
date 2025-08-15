const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const fs = require('fs').promises
const path = require('path')
const multer = require('multer')
const backupService = require('../../services/backup')

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/sql' || file.originalname.endsWith('.sql')) {
      cb(null, true)
    } else {
      cb(new Error('Only SQL files are allowed'))
    }
  }
})

// Settings file path
const SETTINGS_FILE = path.join(__dirname, '../../data/settings.json')
const ADMIN_FILE = path.join(__dirname, '../../data/admin.json')

// Default settings
const DEFAULT_SETTINGS = {
  siteName: 'Vidoma E-commerce',
  contactEmail: '',
  phoneNumber: '',
  maintenanceMode: false
}

const DEFAULT_ADMIN = {
  username: 'admin',
  password: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' // password
}

// Load settings from file
async function loadSettings() {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) }
  } catch (error) {
    return DEFAULT_SETTINGS
  }
}

// Save settings to file
async function saveSettings(settings) {
  try {
    await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true })
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2))
    return true
  } catch (error) {
    console.error('Error saving settings:', error)
    return false
  }
}

// Load admin data
async function loadAdmin() {
  try {
    const data = await fs.readFile(ADMIN_FILE, 'utf8')
    return { ...DEFAULT_ADMIN, ...JSON.parse(data) }
  } catch (error) {
    return DEFAULT_ADMIN
  }
}

// Save admin data
async function saveAdmin(admin) {
  try {
    await fs.mkdir(path.dirname(ADMIN_FILE), { recursive: true })
    await fs.writeFile(ADMIN_FILE, JSON.stringify(admin, null, 2))
    return true
  } catch (error) {
    console.error('Error saving admin:', error)
    return false
  }
}

// Settings page
router.get('/', async(req, res) => {
  try {
    const settings = await loadSettings()
    const currentAdmin = await loadAdmin()

    res.render('settings', {
      title: 'Налаштування',
      currentPage: 'settings',
      user: req.session.admin,
      settings,
      currentAdmin: { username: currentAdmin.username },
      error: req.query.error,
      success: req.query.success
    })
  } catch (error) {
    console.error('Error loading settings page:', error)
    res.render('settings', {
      title: 'Налаштування',
      currentPage: 'settings',
      user: req.session.admin,
      settings: DEFAULT_SETTINGS,
      currentAdmin: { username: 'admin' },
      error: 'Помилка завантаження налаштувань'
    })
  }
})

// Update admin credentials
router.post('/admin', async(req, res) => {
  try {
    const { username, currentPassword, newPassword, confirmPassword } = req.body

    if (!username || !currentPassword) {
      return res.json({ error: "Ім'я користувача та поточний пароль обов'язкові" })
    }

    // Load current admin data
    const currentAdmin = await loadAdmin()

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, currentAdmin.password)
    if (!isValidPassword) {
      return res.json({ error: 'Неправильний поточний пароль' })
    }

    // Prepare new admin data
    const newAdmin = {
      username: username.trim(),
      password: currentAdmin.password // Keep current password by default
    }

    // Update password if provided
    if (newPassword) {
      if (newPassword !== confirmPassword) {
        return res.json({ error: 'Нові паролі не співпадають' })
      }

      if (newPassword.length < 6) {
        return res.json({ error: 'Пароль повинен містити принаймні 6 символів' })
      }

      // Hash new password
      newAdmin.password = await bcrypt.hash(newPassword, 10)
    }

    // Save admin data
    const saved = await saveAdmin(newAdmin)
    if (!saved) {
      return res.json({ error: 'Помилка збереження даних' })
    }

    // Update session
    req.session.admin.username = newAdmin.username

    res.json({ success: 'Дані адміністратора успішно оновлено' })
  } catch (error) {
    console.error('Error updating admin:', error)
    res.json({ error: 'Помилка оновлення даних адміністратора' })
  }
})

// Update system settings
router.post('/system', async(req, res) => {
  try {
    const { siteName, contactEmail, phoneNumber, maintenanceMode } = req.body

    const settings = {
      siteName: siteName || DEFAULT_SETTINGS.siteName,
      contactEmail: contactEmail || '',
      phoneNumber: phoneNumber || '',
      maintenanceMode: maintenanceMode === 'on'
    }

    const saved = await saveSettings(settings)
    if (!saved) {
      return res.json({ error: 'Помилка збереження налаштувань' })
    }

    res.json({ success: 'Налаштування успішно оновлено' })
  } catch (error) {
    console.error('Error updating settings:', error)
    res.json({ error: 'Помилка оновлення налаштувань' })
  }
})

// Database backup route with date range
router.get('/backup', async(req, res) => {
  try {
    const { dateFrom, dateTo } = req.query
    const backup = await backupService.generateBackup(dateFrom, dateTo)

    res.setHeader('Content-Type', 'application/sql')
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`)
    res.setHeader('Content-Length', backup.size)

    res.send(backup.content)
  } catch (error) {
    console.error('Backup error:', error)
    res.status(500).json({ error: 'Failed to generate backup' })
  } finally {
    await backupService.close()
  }
})

// Database restore route
router.post('/restore', upload.single('sqlFile'), async(req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No SQL file uploaded' })
    }

    const sqlContent = req.file.buffer.toString('utf8')
    const result = await backupService.restoreBackup(sqlContent)

    res.json({
      success: 'Database restored successfully',
      details: `Executed ${result.executedStatements} of ${result.totalStatements} statements`
    })
  } catch (error) {
    console.error('Restore error:', error)
    res.status(500).json({ error: error.message })
  } finally {
    await backupService.close()
  }
})

module.exports = router
