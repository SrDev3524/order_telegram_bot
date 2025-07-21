const express = require('express')
const router = express.Router()
const db = require('../../database/connection')
const multer = require('multer')
const path = require('path')

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../../public/uploads/categories'))
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'category-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)

    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  }
})

router.get('/', async(req, res) => {
  try {
    await db.connect()
    const categories = await db.getCategories(true)
    const categoryTree = await db.getCategoryTree()

    res.render('categories', {
      title: 'Управління категоріями',
      currentPage: 'categories',
      user: req.session.admin,
      categories,
      categoryTree,
      error: req.query.error,
      success: req.query.success
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    res.render('categories', {
      title: 'Управління категоріями',
      currentPage: 'categories',
      user: req.session.admin,
      categories: [],
      categoryTree: [],
      error: 'Error loading categories'
    })
  }
})

router.get('/api', async(req, res) => {
  try {
    await db.connect()
    const categories = await db.getCategories(req.query.includeInactive === 'true')
    res.json(categories)
  } catch (error) {
    console.error('Error fetching categories API:', error)
    res.status(500).json({ error: 'Error loading categories' })
  }
})

router.get('/api/:id', async(req, res) => {
  try {
    await db.connect()
    const category = await db.getCategoryById(req.params.id)
    if (!category) {
      return res.status(404).json({ error: 'Category not found' })
    }
    res.json(category)
  } catch (error) {
    console.error('Error fetching category:', error)
    res.status(500).json({ error: 'Error loading category' })
  }
})

router.post('/', upload.single('image'), async(req, res) => {
  try {
    await db.connect()

    const { name, description, parent_id, sort_order, active } = req.body

    if (!name || name.trim() === '') {
      return res.redirect('/admin/categories?error=' + encodeURIComponent('Category name is required'))
    }

    const categoryData = {
      name: name.trim(),
      description: description || null,
      parent_id: parent_id || null,
      image_url: req.file ? `/uploads/categories/${req.file.filename}` : null,
      sort_order: parseInt(sort_order) || 0,
      active: active === 'on' ? 1 : 0
    }

    await db.createCategory(categoryData)
    res.redirect('/admin/categories?success=' + encodeURIComponent('Category created successfully'))
  } catch (error) {
    console.error('Error creating category:', error)
    res.redirect('/admin/categories?error=' + encodeURIComponent('Error creating category'))
  }
})

router.put('/:id', upload.single('image'), async(req, res) => {
  try {
    await db.connect()

    const { name, description, parent_id, sort_order, active } = req.body
    const categoryId = req.params.id

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Category name is required' })
    }

    const existingCategory = await db.getCategoryById(categoryId)
    if (!existingCategory) {
      return res.status(404).json({ error: 'Category not found' })
    }

    const categoryData = {
      name: name.trim(),
      description: description || null,
      parent_id: parent_id || null,
      image_url: req.file ? `/uploads/categories/${req.file.filename}` : existingCategory.image_url,
      sort_order: parseInt(sort_order) || 0,
      active: active === 'on' || active === '1' ? 1 : 0
    }

    await db.updateCategory(categoryId, categoryData)
    res.json({ success: 'Category updated successfully' })
  } catch (error) {
    console.error('Error updating category:', error)
    res.status(500).json({ error: 'Error updating category' })
  }
})

router.delete('/:id', async(req, res) => {
  try {
    await db.connect()

    const categoryId = req.params.id
    const { permanent } = req.body

    const category = await db.getCategoryById(categoryId)
    if (!category) {
      return res.status(404).json({ error: 'Category not found' })
    }

    if (permanent === 'true') {
      await db.hardDeleteCategory(categoryId)
      res.json({ success: 'Category permanently deleted' })
    } else {
      await db.deleteCategory(categoryId)
      res.json({ success: 'Category deactivated' })
    }
  } catch (error) {
    console.error('Error deleting category:', error)
    res.status(500).json({ error: 'Error deleting category' })
  }
})

router.get('/:id/products-count', async(req, res) => {
  try {
    console.log(`Getting product count for category ID: ${req.params.id}`)
    await db.connect()
    console.log('Database connected successfully')
    const count = await db.getCategoryProductCount(req.params.id)
    console.log(`Product count result: ${count}`)
    res.json({ count })
  } catch (error) {
    console.error('Error getting product count:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({ error: 'Error counting products', details: error.message })
  }
})

router.get('/tree', async(req, res) => {
  try {
    await db.connect()
    const tree = await db.getCategoryTree()
    res.json(tree)
  } catch (error) {
    console.error('Error fetching category tree:', error)
    res.status(500).json({ error: 'Error loading category tree' })
  }
})

module.exports = router
