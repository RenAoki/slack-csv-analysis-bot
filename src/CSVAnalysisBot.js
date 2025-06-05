const { SlackBot } = require('./SlackBot');
const { CSVProcessor } = require('./CSVProcessor');
const { AIAnalyzer } = require('./AIAnalyzer');

class CSVAnalysisBot {
  constructor() {
    this.slackBot = new SlackBot();
    this.csvProcessor = new CSVProcessor();
    this.aiAnalyzer = new AIAnalyzer();
    
    this.setupAnalysisHandlers();
  }

  setupAnalysisHandlers() {
    const app = this.slackBot.getApp();

    app.event('app_mention', async ({ event, client, say }) => {
      try {
        console.log('App mention received:', event.user, event.text);

        if (!event.files || event.files.length === 0) {
          await this.sendUsageInstructions(say, event.ts);
          return;
        }

        const file = event.files[0];
        const validation = this.csvProcessor.validateFile(file);
        
        if (!validation.isValid) {
          await this.sendValidationError(say, event.ts, validation.errors);
          return;
        }

        await say({
          thread_ts: event.ts,
          text: '🔍 CSVファイルを分析中です...'
        });

        await this.processFileAnalysis(file, event, client, say);

      } catch (error) {
        console.error('Error in app mention handler:', error);
        await this.sendGeneralError(say, event.ts, error.message);
      }
    });

    app.error((error) => {
      console.error('Slack app error:', error);
    });
  }

  async processFileAnalysis(file, event, client, say) {
    try {
      const csvData = await this.csvProcessor.downloadAndProcessCSV(file, client);
      
      const intents = this.csvProcessor.extractAnalysisIntent(event.text);
      console.log('Analysis intents:', intents);

      await say({
        thread_ts: event.ts,
        text: `📊 データを読み込みました（${csvData.rowCount}行 × ${csvData.columns.length}列）\n🤖 AI分析を実行中...`
      });

      const analysisResult = await this.aiAnalyzer.performAnalysis(csvData, intents, file.name);
      
      const formattedResult = this.aiAnalyzer.formatAnalysisResult(analysisResult);
      
      await this.sendAnalysisResult(say, event.ts, formattedResult, analysisResult);

    } catch (error) {
      console.error('Error processing file analysis:', error);
      await this.sendAnalysisError(say, event.ts, error.message);
    }
  }

  async sendAnalysisResult(say, threadTs, formattedResult, analysisResult) {
    try {
      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: formattedResult
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `💰 トークン使用量: ${analysisResult.usage?.total_tokens || 'N/A'} | 🕒 分析完了: ${new Date().toLocaleString('ja-JP')}`
            }
          ]
        }
      ];

      await say({
        thread_ts: threadTs,
        blocks: blocks
      });

    } catch (error) {
      console.error('Error sending analysis result:', error);
      await say({
        thread_ts: threadTs,
        text: `分析は完了しましたが、結果の送信中にエラーが発生しました。\n\n${formattedResult}`
      });
    }
  }

  async sendUsageInstructions(say, threadTs) {
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '📊 *CSV分析ボットの使い方*'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'CSVファイルを添付してメンションしてください。\n\n*使用例:*\n• `@bot このデータのトレンドを分析して` + CSVファイル\n• `@bot 売上データの相関を調べて` + CSVファイル\n• `@bot 異常値を見つけて` + CSVファイル'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*対応ファイル:*\n• CSV (.csv) / TSV (.tsv)\n• 最大サイズ: 10MB\n• 最大行数: 10,000行'
        }
      }
    ];

    await say({
      thread_ts: threadTs,
      blocks: blocks
    });
  }

  async sendValidationError(say, threadTs, errors) {
    await say({
      thread_ts: threadTs,
      text: `❌ ファイルの検証でエラーが発生しました:\n${errors.map(error => `• ${error}`).join('\n')}\n\n対応ファイル形式: CSV (.csv), TSV (.tsv)\n最大サイズ: 10MB`
    });
  }

  async sendAnalysisError(say, threadTs, errorMessage) {
    const sanitizedError = this.sanitizeErrorMessage(errorMessage);
    await say({
      thread_ts: threadTs,
      text: `❌ 分析中にエラーが発生しました:\n${sanitizedError}\n\nファイル形式やAPIキーの設定をご確認ください。`
    });
  }

  async sendGeneralError(say, threadTs, errorMessage) {
    const sanitizedError = this.sanitizeErrorMessage(errorMessage);
    await say({
      thread_ts: threadTs,
      text: `❌ エラーが発生しました: ${sanitizedError}\n\nしばらく経ってから再度お試しください。`
    });
  }

  sanitizeErrorMessage(errorMessage) {
    const sensitivePatterns = [
      /sk-[a-zA-Z0-9]{48}/g, // OpenAI API keys
      /xoxb-[a-zA-Z0-9-]+/g, // Slack bot tokens
      /xapp-[a-zA-Z0-9-]+/g, // Slack app tokens
      /Bearer\s+[a-zA-Z0-9\-_\.]+/g, // Bearer tokens
    ];

    let sanitized = errorMessage;
    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    return sanitized;
  }

  async validateConfiguration() {
    const results = {
      slack: false,
      openai: false,
      errors: []
    };

    try {
      if (!process.env.SLACK_BOT_TOKEN) {
        results.errors.push('SLACK_BOT_TOKEN が設定されていません');
      } else {
        results.slack = true;
      }

      if (!process.env.OPENAI_API_KEY) {
        results.errors.push('OPENAI_API_KEY が設定されていません');
      } else {
        const openaiTest = await this.aiAnalyzer.testConnection();
        if (openaiTest.success) {
          results.openai = true;
        } else {
          results.errors.push(`OpenAI接続エラー: ${openaiTest.error}`);
        }
      }

    } catch (error) {
      results.errors.push(`設定検証エラー: ${error.message}`);
    }

    return results;
  }

  async start(port = 3000) {
    console.log('🚀 CSV Analysis Bot starting...');
    
    const validation = await this.validateConfiguration();
    
    if (validation.errors.length > 0) {
      console.error('❌ Configuration errors:');
      validation.errors.forEach(error => console.error(`  • ${error}`));
      throw new Error('Configuration validation failed');
    }

    console.log('✅ Configuration validated');
    console.log(`✅ Slack Bot: ${validation.slack ? 'OK' : 'NG'}`);
    console.log(`✅ OpenAI API: ${validation.openai ? 'OK' : 'NG'}`);

    await this.slackBot.start(port);
    console.log('🎉 CSV Analysis Bot is ready!');
  }

  getApp() {
    return this.slackBot.getApp();
  }
}

module.exports = { CSVAnalysisBot };