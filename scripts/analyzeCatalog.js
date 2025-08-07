const XLSX = require('xlsx');
const path = require('path');

const catalogPath = path.join(__dirname, '../data/catalog.xlsx');

try {
  const workbook = XLSX.readFile(catalogPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log('=== Catalog Structure ===');
  console.log('Total sheets:', workbook.SheetNames.length);
  console.log('Sheet names:', workbook.SheetNames);
  console.log('Total rows:', data.length);
  
  if (data.length > 0) {
    console.log('\n=== Columns ===');
    console.log(Object.keys(data[0]));
    
    console.log('\n=== First 5 rows ===');
    data.slice(0, 5).forEach((row, index) => {
      console.log(`\nRow ${index + 1}:`);
      Object.entries(row).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    });
    
    // Extract unique categories
    const categories = [...new Set(data.map(row => row.Category || row.category || row.Категорія))];
    console.log('\n=== Unique Categories ===');
    categories.forEach((cat, index) => {
      console.log(`${index + 1}. ${cat}`);
    });
    
    // Analyze color and size options
    console.log('\n=== Sample Products with Colors and Sizes ===');
    data.slice(0, 3).forEach((product, index) => {
      console.log(`\nProduct ${index + 1}:`);
      console.log(`  Name: ${product['Product/Service'] || product.Product || product.Name}`);
      console.log(`  Color: ${product.Color || product.Колір || 'N/A'}`);
      console.log(`  Size: ${product.Size || product.Розмір || 'N/A'}`);
      console.log(`  Price: ${product.Price || product.Ціна || 'N/A'}`);
      console.log(`  Category: ${product.Category || product.Категорія || 'N/A'}`);
    });
  }
} catch (error) {
  console.error('Error reading catalog:', error.message);
}