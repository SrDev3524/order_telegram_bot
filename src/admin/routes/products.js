const express = require('express')
const router = express.Router()
const db = require('../../database/connection')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const uploadDir = path.join(__dirname, '../../../public/uploads/products/')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname)
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files allowed'), false)
    }
  }
})

router.get('/', async(req, res) => {
  try {

    const [products, categories] = await Promise.all([
      db.all(`
        SELECT 
          p.id, p.name, p.description, p.sku, p.price, p.sale_price,
          p.stock_quantity, p.active, p.images, p.category_id,
          p.created_at, p.updated_at, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.created_at DESC
      `),
      db.all('SELECT * FROM categories WHERE active = 1 ORDER BY name')
    ])

    res.render('products', {
      title: 'Product Management',
      currentPage: 'products',
      user: req.session.admin,
      products: products || [],
      categories: categories || [],
      error: req.query.error || null,
      success: req.query.success || null
    })
  } catch (error) {
    console.error('Error loading products page:', error)
    res.render('products', {
      title: 'Product Management',
      currentPage: 'products',
      user: req.session.admin,
      products: [],
      categories: [],
      error: 'Error loading data: ' + error.message,
      success: null
    })
  }
})

router.get('/api/:id', async(req, res) => {
  try {

    const product = await db.get(
      'SELECT * FROM products WHERE id = ?',
      [req.params.id]
    )

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    res.json(product)
  } catch (error) {
    console.error('Error fetching product:', error)
    res.status(500).json({ error: error.message })
  }
})

router.post('/', upload.array('images', 20), async(req, res) => {
  try {

    const { name, description, sku, price, sale_price, stock_quantity, category_id, active } = req.body
    const images = req.files ? req.files.map(file => `/uploads/products/${file.filename}`) : []

    if (!name || !price || !category_id) {
      return res.redirect('/admin/products?error=' + encodeURIComponent('Name, price and category are required'))
    }

    const result = await db.run(`
      INSERT INTO products (name, description, sku, price, sale_price, stock_quantity, category_id, active, images)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name.trim(),
      description ? description.trim() : null,
      sku ? sku.trim() : null,
      parseFloat(price) || 0,
      sale_price ? parseFloat(sale_price) : null,
      parseInt(stock_quantity) || 0,
      parseInt(category_id),
      active === 'on' ? 1 : 0,
      JSON.stringify(images)
    ])

    if (result && result.lastID) {
      res.redirect('/admin/products?success=' + encodeURIComponent('Product created successfully'))
    } else {
      res.redirect('/admin/products?error=' + encodeURIComponent('Error creating product'))
    }
  } catch (error) {
    console.error('Error creating product:', error)
    res.redirect('/admin/products?error=' + encodeURIComponent('Error creating product: ' + error.message))
  }
})

router.put('/:id', upload.array('images', 20), async(req, res) => {
  try {
    const productId = req.params.id
    const { name, description, sku, price, sale_price, stock_quantity, category_id, active } = req.body

    if (!name || !price || !category_id) {
      return res.status(400).json({ error: 'Name, price and category are required' })
    }

    const existingProduct = await db.get('SELECT * FROM products WHERE id = ?', [productId])
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' })
    }

    let updateQuery = `
      UPDATE products 
      SET name = ?, description = ?, sku = ?, price = ?, sale_price = ?, 
          stock_quantity = ?, category_id = ?, active = ?, updated_at = NOW()
    `
    const queryParams = [
      name.trim(),
      description ? description.trim() : null,
      sku ? sku.trim() : null,
      parseFloat(price) || 0,
      sale_price ? parseFloat(sale_price) : null,
      parseInt(stock_quantity) || 0,
      parseInt(category_id),
      active === 'on' || active === '1' ? 1 : 0
    ]

    let finalImages = []

    if (req.body.existingImages) {
      try {
        finalImages = JSON.parse(req.body.existingImages)
      } catch (e) {
        console.log('Error parsing existing images from form:', e)
        finalImages = []
      }
    }

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => `/uploads/products/${file.filename}`)
      finalImages = [...finalImages, ...newImages]
    }

    if (finalImages.length > 0 || req.body.existingImages) {
      updateQuery += ', images = ?'
      queryParams.push(JSON.stringify(finalImages))
    }

    updateQuery += ' WHERE id = ?'
    queryParams.push(productId)

    const result = await db.run(updateQuery, queryParams)

    if (result.changes > 0) {
      res.json({ message: 'Product updated successfully' })
    } else {
      res.status(404).json({ error: 'Product not found' })
    }
  } catch (error) {
    console.error('Error updating product:', error)
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id/photo', async(req, res) => {
  try {
    const productId = req.params.id
    const { photoPath } = req.body

    if (!photoPath) {
      return res.status(400).json({ error: 'Photo path is required' })
    }

    const product = await db.get('SELECT * FROM products WHERE id = ?', [productId])
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    let images = []
    try {
      if (product.images) {
        images = JSON.parse(product.images)
      }
    } catch (e) {
      images = product.images ? [product.images] : []
    }

    const updatedImages = images.filter(img => img !== photoPath)

    await db.run(
      'UPDATE products SET images = ? WHERE id = ?',
      [JSON.stringify(updatedImages), productId]
    )

    const fullPath = path.join(__dirname, '../../../public', photoPath)
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath)
      } catch (fileError) {
        console.warn('Could not delete physical file:', fileError.message)
      }
    }

    res.json({ message: 'Photo deleted successfully', remainingPhotos: updatedImages.length })
  } catch (error) {
    console.error('Error deleting photo:', error)
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', async(req, res) => {
  try {
    const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id])
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const result = await db.run('DELETE FROM products WHERE id = ?', [req.params.id])

    if (result.changes > 0) {
      res.json({ message: 'Product deleted successfully' })
    } else {
      res.status(404).json({ error: 'Product not found' })
    }
  } catch (error) {
    console.error('Error deleting product:', error)
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
