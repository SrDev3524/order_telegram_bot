const mysql = require('mysql2/promise')

class Database {
  constructor() {
    this.connection = null
    this.pool = null
  }

  async connect() {
    if (this.pool && !this.pool._closed) {
      return this.pool
    }

    try {
      this.pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'vidoma_bot',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true
      })

      const connection = await this.pool.getConnection()
      console.log('Connected to MySQL database')
      connection.release()
      return this.pool
    } catch (err) {
      console.error('Error connecting to database:', err)
      throw err
    }
  }

  async run(sql, params = []) {
    try {
      await this.connect()
      const [result] = await this.pool.execute(sql, params)
      return {
        lastID: result.insertId || null,
        changes: result.affectedRows || 0,
        result
      }
    } catch (err) {
      console.error('Database run error:', err)
      throw err
    }
  }

  async get(sql, params = []) {
    try {
      await this.connect()
      const [rows] = await this.pool.execute(sql, params)
      return rows.length > 0 ? rows[0] : null
    } catch (err) {
      console.error('Database get error:', err)
      throw err
    }
  }

  async all(sql, params = []) {
    try {
      await this.connect()
      const [rows] = await this.pool.execute(sql, params)
      return rows
    } catch (err) {
      console.error('Database all error:', err)
      throw err
    }
  }

  async close() {
    try {
      if (this.pool) {
        await this.pool.end()
        console.log('Database connection pool closed')
      }
    } catch (err) {
      console.error('Error closing database:', err)
      throw err
    }
  }

  async getCategories(includeInactive = false) {
    const whereClause = includeInactive ? '' : 'WHERE active = 1'
    const sql = `
      SELECT 
        id, 
        name, 
        description, 
        parent_id, 
        image_url, 
        sort_order, 
        active,
        created_at,
        updated_at
      FROM categories 
      ${whereClause}
      ORDER BY sort_order ASC, name ASC
    `
    return await this.all(sql)
  }

  async getCategoryById(id) {
    const sql = 'SELECT * FROM categories WHERE id = ?'
    return await this.get(sql, [id])
  }

  async createCategory(categoryData) {
    const { name, description, parent_id, image_url, sort_order, active } = categoryData
    const sql = `
      INSERT INTO categories (name, description, parent_id, image_url, sort_order, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `
    return await this.run(sql, [name, description, parent_id, image_url, sort_order, active])
  }

  async updateCategory(id, categoryData) {
    const { name, description, parent_id, image_url, sort_order, active } = categoryData
    const sql = `
      UPDATE categories 
      SET name = ?, description = ?, parent_id = ?, image_url = ?, 
          sort_order = ?, active = ?, updated_at = NOW()
      WHERE id = ?
    `
    return await this.run(sql, [name, description, parent_id, image_url, sort_order, active, id])
  }

  async deleteCategory(id) {
    const sql = 'UPDATE categories SET active = 0, updated_at = NOW() WHERE id = ?'
    return await this.run(sql, [id])
  }

  async hardDeleteCategory(id) {
    const sql = 'DELETE FROM categories WHERE id = ?'
    return await this.run(sql, [id])
  }

  async getCategoryTree() {
    const categories = await this.getCategories()
    const categoryMap = new Map()
    const tree = []

    categories.forEach(category => {
      categoryMap.set(category.id, { ...category, children: [] })
    })

    categories.forEach(category => {
      if (category.parent_id) {
        const parent = categoryMap.get(category.parent_id)
        if (parent) {
          parent.children.push(categoryMap.get(category.id))
        }
      } else {
        tree.push(categoryMap.get(category.id))
      }
    })

    return tree
  }

  async getCategoryWithChildren(id) {
    const sql = `
      WITH RECURSIVE category_tree AS (
        SELECT id, name, description, parent_id, image_url, sort_order, active, 0 as level
        FROM categories 
        WHERE id = ?
        
        UNION ALL
        
        SELECT c.id, c.name, c.description, c.parent_id, c.image_url, c.sort_order, c.active, ct.level + 1
        FROM categories c
        JOIN category_tree ct ON c.parent_id = ct.id
        WHERE c.active = 1
      )
      SELECT * FROM category_tree ORDER BY level, sort_order, name
    `
    return await this.all(sql, [id])
  }

  async getCategoryProductCount(id) {
    try {
      const sql = `
        SELECT COUNT(*) as count 
        FROM products p
        WHERE p.category_id = ? AND p.active = 1
      `
      const result = await this.get(sql, [id])
      return result ? result.count : 0
    } catch (error) {
      console.error(`Error getting product count for category ${id}:`, error)
      throw error
    }
  }
}

const db = new Database()

module.exports = db
