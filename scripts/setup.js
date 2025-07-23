const db = require('../src/database/connection')
const fs = require('fs')
const path = require('path')

require('dotenv').config()

async function setupDatabase() {
  console.log('🔧 Setting up Vidoma Bot database...')
  
  try {
    // Connect to database
    await db.connect()
    console.log('✅ Database connection established')
    
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
        await db.run(statement)
      }
    }
    
    console.log('✅ Database tables created successfully')
    
    // Verify tables were created
    const tables = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `)
    
    console.log('📋 Created tables:')
    tables.forEach(table => {
      console.log(`   - ${table.name}`)
    })
    
    console.log('\n🎉 Database setup completed successfully!')
    console.log('\n💡 Next steps:')
    console.log('   1. Set your BOT_TOKEN in .env file')
    console.log('   2. Run: npm start')
    console.log('   3. Access admin panel at: http://localhost:80')
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message)
    process.exit(1)
  } finally {
    await db.close()
  }
}

// Check if .env exists
if (!fs.existsSync('.env')) {
  console.log('⚠️  .env file not found!')
  console.log('📝 Please create .env file with the following variables:')
  console.log(`
BOT_TOKEN=your_telegram_bot_token_here
OPENAI_API_KEY=your_openai_api_key_here
CRM_API_KEY=your_crm_api_key_here
ADMIN_PASSWORD=admin123
`)
  process.exit(1)
}

setupDatabase()