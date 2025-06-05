const { CSVAnalysisBot } = require('./src/CSVAnalysisBot');
require('dotenv').config();

async function main() {
  try {
    const bot = new CSVAnalysisBot();
    
    const port = process.env.PORT || 3000;
    await bot.start(port);
    
  } catch (error) {
    console.error('❌ Failed to start CSV Analysis Bot:', error.message);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  main();
}

module.exports = { CSVAnalysisBot };