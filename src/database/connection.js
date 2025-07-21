const sqlite3 = require('sqlite3').verbose()
const path = require('path')

const dbPath = path.join(__dirname, '../../data/database.sqlite')

class Database {
  constructor() {
    this.db = null
  }

  async connect() {
    if (this.db) {
      return Promise.resolve()
    }
    
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error connecting to database:', err)
          reject(err)
        } else {
          console.log('Connected to SQLite database')
          this.db.run('PRAGMA foreign_keys = ON')
          resolve()
        }
      })
    })
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err)
        } else {
          resolve({ id: this.lastID, changes: this.changes })
        }
      })
    })
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err)
        } else {
          resolve(row)
        }
      })
    })
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows)
        }
      })
    })
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err)
          } else {
            console.log('Database connection closed')
            resolve()
          }
        })
      } else {
        resolve()
      }
    })
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
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    return await this.run(sql, [name, description, parent_id, image_url, sort_order, active])
  }

  async updateCategory(id, categoryData) {
    const { name, description, parent_id, image_url, sort_order, active } = categoryData
    const sql = `
      UPDATE categories 
      SET name = ?, description = ?, parent_id = ?, image_url = ?, 
          sort_order = ?, active = ?, updated_at = datetime('now')
      WHERE id = ?
    `
    return await this.run(sql, [name, description, parent_id, image_url, sort_order, active, id])
  }

  async deleteCategory(id) {
    const sql = 'UPDATE categories SET active = 0, updated_at = datetime(\'now\') WHERE id = ?'
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
      console.log(`Product count for category ${id}:`, result)
      return result ? result.count : 0
    } catch (error) {
      console.error(`Error getting product count for category ${id}:`, error)
      throw error
    }
  }
}

const db = new Database()

module.exports = db
