const { CSVAnalysisBot } = require('../src/CSVAnalysisBot');

let bot;

const getBot = () => {
  if (!bot) {
    bot = new CSVAnalysisBot();
  }
  return bot;
};

module.exports = async function handler(req, res) {
  try {
    const bot = getBot();
    const app = bot.getApp();
    
    if (req.method === 'POST') {
      await app.receiver.requestHandler()(req, res);
    } else if (req.method === 'GET') {
      res.status(200).json({ 
        status: 'OK', 
        message: 'CSV Analysis Bot is running',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error('API handler error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
};