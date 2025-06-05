const { App } = require('@slack/bolt');
require('dotenv').config();

class SlackBot {
  constructor() {
    this.app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      appToken: process.env.SLACK_APP_TOKEN,
      socketMode: true,
      logLevel: process.env.NODE_ENV === 'development' ? 'DEBUG' : 'INFO',
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.app.event('app_mention', async ({ event, client, say }) => {
      try {
        console.log('Received app mention:', event);
        
        if (event.files && event.files.length > 0) {
          await this.handleFileUpload(event, client, say);
        } else {
          await say({
            thread_ts: event.ts,
            text: '📊 CSVファイルを添付してメンションしてください。データ分析を行います！\n\n使用例:\n`@bot このデータのトレンドを分析して` + CSVファイル添付'
          });
        }
      } catch (error) {
        console.error('Error handling app mention:', error);
        await say({
          thread_ts: event.ts,
          text: '❌ エラーが発生しました。しばらく経ってから再度お試しください。'
        });
      }
    });

    this.app.error((error) => {
      console.error('Slack app error:', error);
    });
  }

  async handleFileUpload(event, client, say) {
    const file = event.files[0];
    
    if (!this.isValidCSVFile(file)) {
      await say({
        thread_ts: event.ts,
        text: '❌ CSVまたはTSVファイルのみ対応しています。\n対応ファイル形式: .csv, .tsv\n最大サイズ: 10MB'
      });
      return;
    }

    await say({
      thread_ts: event.ts,
      text: '🔍 ファイルを分析中です...'
    });

    console.log('Valid CSV file received:', file.name);
  }

  isValidCSVFile(file) {
    const validMimeTypes = ['text/csv', 'text/plain', 'application/vnd.ms-excel'];
    const validExtensions = ['.csv', '.tsv'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (file.size > maxSize) {
      console.log('File too large:', file.size);
      return false;
    }

    const hasValidMimeType = validMimeTypes.includes(file.mimetype);
    const hasValidExtension = validExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );

    return hasValidMimeType || hasValidExtension;
  }

  async start(port = 3000) {
    await this.app.start(port);
    console.log(`⚡️ Slack bot is running on port ${port}`);
  }

  getApp() {
    return this.app;
  }
}

module.exports = { SlackBot };