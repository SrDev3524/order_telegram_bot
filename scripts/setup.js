const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

require('dotenv').config()

async function setupDatabase() {
  console.log('🔧 Setting up MySQL database for Vidoma Bot...')
  
  let connection
  try {
    // Connect to MySQL server (without database)
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    })

    console.log('✅ Connected to MySQL server')

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'vidoma_bot'
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    console.log(`✅ Database '${dbName}' created`)

    // Close connection to server
    await connection.end()

    // Connect to the specific database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: dbName,
      multipleStatements: true
    })

    console.log(`✅ Connected to database '${dbName}'`)

    // Read and execute init.sql
    const initSqlPath = path.join(__dirname, '../src/database/init.sql')
    
    if (!fs.existsSync(initSqlPath)) {
      throw new Error('init.sql file not found!')
    }
    
    const initSql = fs.readFileSync(initSqlPath, 'utf8')
    const statements = initSql.split(';').filter(stmt => stmt.trim())
    
    console.log(`📝 Executing ${statements.length} SQL statements...`)
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.execute(statement)
        } catch (err) {
          if (!err.message.includes('Duplicate entry')) {
            console.warn('Warning:', err.message)
          }
        }
      }
    }
    
    console.log('✅ Database tables created successfully')
    console.log('✅ Default admin created (username: admin, password: admin123)')
    
    console.log('\n🎉 MySQL setup completed successfully!')
    console.log('\n💡 Next steps:')
    console.log('   1. Set your database credentials in .env file')
    console.log('   2. Run: npm start')
    console.log(`   3. Access admin panel at: http://localhost:3000`)
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message)
    console.error('\n🔧 Make sure:')
    console.error('   1. MySQL server is running')
    console.error('   2. Database credentials are correct in .env')
    console.error('   3. User has CREATE database privileges')
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

// Check if .env exists
if (!fs.existsSync('.env')) {
  console.log('⚠️  .env file not found!')
  console.log('📝 Please create .env file based on .env.example')
  process.exit(1)
}

setupDatabase()