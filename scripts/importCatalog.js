const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config();
const db = require('../src/database/connection');

async function importCatalog() {
  try {
    console.log('Starting catalog import...');
    
    // Connect to database
    await db.connect();
    
    // Read Excel file
    const catalogPath = path.join(__dirname, '../data/catalog.xlsx');
    const workbook = XLSX.readFile(catalogPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${data.length} products in catalog`);
    
    // Clear existing data
    await db.run('DELETE FROM products');
    await db.run('DELETE FROM categories');
    
    // Get unique categories and create them
    const categories = [...new Set(data.map(row => row.Category))];
    const categoryMap = {};
    
    for (let i = 0; i < categories.length; i++) {
      const categoryName = categories[i];
      const result = await db.run(
        'INSERT INTO categories (name, sort_order, active) VALUES (?, ?, 1)',
        [categoryName, i + 1]
      );
      categoryMap[categoryName] = result.id;
      console.log(`Created category: ${categoryName} (ID: ${result.id})`);
    }
    
    // Import products
    let productCount = 0;
    for (const row of data) {
      const productName = row['Product/Service'];
      const colors = row.Color ? row.Color.split(',').map(c => c.trim()) : [];
      const sizes = row.Size ? row.Size.split(',').map(s => s.trim()) : [];
      const price = parseFloat(row.Price) || 0;
      const categoryId = categoryMap[row.Category];
      
      // Create base product
      const productResult = await db.run(`
        INSERT INTO products (name, price, category_id, stock_quantity, active)
        VALUES (?, ?, ?, 100, 1)
      `, [productName, price, categoryId]);
      
      const productId = productResult.id;
      productCount++;
      
      console.log(`Created product: ${productName} (ID: ${productId})`);
      console.log(`  Colors: ${colors.join(', ')}`);
      console.log(`  Sizes: ${sizes.join(', ')}`);
      console.log(`  Price: ${price}₴`);
      
      // Store colors and sizes as JSON in description for now
      // We can use this data when user selects the product
      const variants = {
        colors: colors,
        sizes: sizes
      };
      
      await db.run(
        'UPDATE products SET description = ? WHERE id = ?',
        [JSON.stringify(variants), productId]
      );
    }
    
    console.log(`\nImport completed successfully!`);
    console.log(`- Created ${categories.length} categories`);
    console.log(`- Created ${productCount} products`);
    
  } catch (error) {
    console.error('Error importing catalog:', error);
  }
}

// Run import if called directly
if (require.main === module) {
  importCatalog().then(() => {
    console.log('Import process finished');
    process.exit(0);
  }).catch(error => {
    console.error('Import failed:', error);
    process.exit(1);
  });
}

module.exports = { importCatalog };