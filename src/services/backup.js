const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')

class BackupService {
  constructor() {
    this.connection = null
  }

  async connect() {
    if (!this.connection) {
      this.connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'vidoma_bot'
      })
    }
    return this.connection
  }

  async generateBackup(dateFrom = null, dateTo = null) {
    try {
      await this.connect()
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const filename = `vidoma_bot_backup_${timestamp}.sql`
      
      let sqlDump = `-- MySQL dump for Vidoma Bot Database\n`
      sqlDump += `-- Generated on: ${new Date().toISOString()}\n`
      sqlDump += `-- Database: ${process.env.DB_NAME || 'vidoma_bot'}\n`
      if (dateFrom || dateTo) {
        sqlDump += `-- Date range: ${dateFrom || 'beginning'} to ${dateTo || 'end'}\n`
      }
      sqlDump += `\n`
      
      sqlDump += `SET FOREIGN_KEY_CHECKS=0;\n\n`

      // Get all tables
      const [tables] = await this.connection.execute(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME
      `)

      // Tables with date columns for filtering
      const dateFilterTables = ['products', 'categories', 'orders', 'order_items', 'users', 'customer_inquiries', 'admins', 'system_settings']

      for (const table of tables) {
        const tableName = table.TABLE_NAME
        
        // Get table structure
        const [createTable] = await this.connection.execute(`SHOW CREATE TABLE \`${tableName}\``)
        sqlDump += `-- Table structure for \`${tableName}\`\n`
        sqlDump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`
        sqlDump += `${createTable[0]['Create Table']};\n\n`

        // Get table data with date filtering if applicable
        let dataQuery = `SELECT * FROM \`${tableName}\``
        const queryParams = []

        if (dateFilterTables.includes(tableName) && (dateFrom || dateTo)) {
          const conditions = []
          if (dateFrom) {
            conditions.push('created_at >= ?')
            queryParams.push(dateFrom)
          }
          if (dateTo) {
            conditions.push('created_at <= ?')
            queryParams.push(dateTo + ' 23:59:59')
          }
          if (conditions.length > 0) {
            dataQuery += ` WHERE ${conditions.join(' AND ')}`
          }
        }

        const [rows] = await this.connection.execute(dataQuery, queryParams)
        
        if (rows.length > 0) {
          sqlDump += `-- Data for table \`${tableName}\`\n`
          sqlDump += `INSERT INTO \`${tableName}\` VALUES\n`
          
          const values = rows.map(row => {
            const escapedValues = Object.values(row).map(value => {
              if (value === null) return 'NULL'
              if (typeof value === 'string') {
                return `'${value.replace(/'/g, "''")}'`
              }
              if (value instanceof Date) {
                return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`
              }
              return value
            })
            return `(${escapedValues.join(', ')})`
          })
          
          sqlDump += values.join(',\n') + ';\n\n'
        }
      }

      sqlDump += `SET FOREIGN_KEY_CHECKS=1;\n`

      return {
        filename,
        content: sqlDump,
        size: Buffer.byteLength(sqlDump, 'utf8')
      }

    } catch (error) {
      console.error('Backup generation error:', error)
      throw new Error(`Backup generation failed: ${error.message}`)
    }
  }

  async restoreBackup(sqlContent) {
    try {
      await this.connect()
      
      // Disable foreign key checks
      await this.connection.execute('SET FOREIGN_KEY_CHECKS=0')
      
      // Split SQL content into statements
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

      let executedCount = 0
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await this.connection.execute(statement)
            executedCount++
          } catch (err) {
            // Log warning but continue with other statements
            console.warn(`Warning executing statement: ${err.message}`)
          }
        }
      }
      
      // Re-enable foreign key checks
      await this.connection.execute('SET FOREIGN_KEY_CHECKS=1')
      
      return {
        success: true,
        executedStatements: executedCount,
        totalStatements: statements.length
      }

    } catch (error) {
      console.error('Restore error:', error)
      throw new Error(`Restore failed: ${error.message}`)
    }
  }

  async close() {
    if (this.connection) {
      await this.connection.end()
      this.connection = null
    }
  }
}

module.exports = new BackupService()