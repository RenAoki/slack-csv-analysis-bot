// ============================================
// api/slack.js - Vercel Serverless Function
// ============================================

const crypto = require('crypto');
const { WebClient } = require('@slack/web-api');
const OpenAI = require('openai');
const axios = require('axios');

// Initialize clients
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ============================================
// Slack Request Verification
// ============================================
function verifySlackRequest(req) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];
  
  // Check timestamp (prevent replay attacks)
  const time = Math.floor(new Date().getTime() / 1000);
  if (Math.abs(time - timestamp) > 300) {
    return false;
  }

  // Verify signature
  const bodyString = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', signingSecret);
  const [version, hash] = signature.split('=');
  hmac.update(`v0:${timestamp}:${bodyString}`);
  const expectedHash = hmac.digest('hex');
  
  return hash === expectedHash;
}

// ============================================
// CSV Analysis Engine
// ============================================
class CSVAnalyzer {
  static async downloadFile(url, token) {
    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        responseType: 'text'
      });
      return response.data;
    } catch (error) {
      throw new Error(`ファイルのダウンロードに失敗しました: ${error.message}`);
    }
  }

  static parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSVファイルにデータが不足しています。');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        data.push(row);
      }
    }

    return { headers, data, rowCount: data.length };
  }

  static analyzeData(parsedData) {
    const { headers, data, rowCount } = parsedData;
    
    const analysis = {
      overview: {
        totalRows: rowCount,
        totalColumns: headers.length,
        columns: headers
      },
      columnAnalysis: {},
      patterns: [],
      insights: []
    };

    // Column analysis
    headers.forEach(column => {
      const values = data.map(row => row[column]).filter(v => v && v !== '');
      const numericValues = values.filter(v => !isNaN(v) && v !== '').map(Number);
      
      analysis.columnAnalysis[column] = {
        type: numericValues.length > values.length * 0.7 ? 'numeric' : 'text',
        nonEmptyCount: values.length,
        uniqueCount: new Set(values).size,
        sampleValues: values.slice(0, 3)
      };

      if (numericValues.length > 0) {
        analysis.columnAnalysis[column].statistics = {
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          average: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
          sum: numericValues.reduce((a, b) => a + b, 0)
        };
      }
    });

    return analysis;
  }

  static async generateAIInsights(analysis, userQuery, sampleData) {
    const prompt = `
以下のCSVデータを分析して、ユーザーの質問に答えてください。

【データ概要】
- 行数: ${analysis.overview.totalRows}
- 列数: ${analysis.overview.totalColumns}
- カラム: ${analysis.overview.columns.join(', ')}

【カラム詳細】
${Object.entries(analysis.columnAnalysis).map(([col, stats]) => 
  `- ${col}: ${stats.type}型, ${stats.nonEmptyCount}個の値, ${stats.uniqueCount}個のユニーク値`
).join('\n')}

【サンプルデータ（最初の3行）】
${JSON.stringify(sampleData.slice(0, 3), null, 2)}

【ユーザーの質問】
${userQuery}

【回答形式】
📊 **データ概要**
🔍 **主要な発見**
📈 **具体的な数値・傾向**
💡 **ビジネス上の示唆・推奨事項**

日本語で、分かりやすく、実用的な洞察を提供してください。
`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "あなたは優秀なデータアナリストです。CSVデータを分析し、ビジネスに役立つ洞察を日本語で提供してください。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.3
      });

      return completion.choices[0].message.content;
    } catch (error) {
      throw new Error(`AI分析に失敗しました: ${error.message}`);
    }
  }
}

// ============================================
// Message Handler
// ============================================
class MessageHandler {
  static extractAnalysisIntent(text) {
    const intents = [];
    const intentKeywords = {
      trend: ['トレンド', '推移', '変化', '傾向', 'trend'],
      summary: ['要約', 'サマリー', '概要', '統計', 'summary'],
      correlation: ['相関', '関係', '関連', 'correlation'],
      anomaly: ['異常', '外れ値', 'アノマリー', 'anomaly'],
      comparison: ['比較', '対比', '違い', 'compare']
    };

    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        intents.push(intent);
      }
    }

    return intents.length > 0 ? intents : ['summary'];
  }

  static async handleAppMention(event) {
    try {
      // Check if files are attached
      if (!event.files || event.files.length === 0) {
        return await MessageHandler.sendUsageGuide(event.channel);
      }

      const file = event.files[0];
      
      // Validate file
      if (!MessageHandler.isValidCSVFile(file)) {
        return await MessageHandler.sendFileError(event.channel, file);
      }

      // Send processing message
      await slack.chat.postMessage({
        channel: event.channel,
        text: "🔄 CSVファイルを分析中です... 少々お待ちください"
      });

      // Download and analyze file
      const csvText = await CSVAnalyzer.downloadFile(file.url_private, process.env.SLACK_BOT_TOKEN);
      const parsedData = CSVAnalyzer.parseCSV(csvText);
      const analysis = CSVAnalyzer.analyzeData(parsedData);
      
      // Extract user intent
      const userQuery = event.text.replace(/<@[^>]+>/g, '').trim();
      const intents = MessageHandler.extractAnalysisIntent(userQuery);
      
      // Generate AI insights
      const aiInsights = await CSVAnalyzer.generateAIInsights(
        analysis,
        userQuery || '全体的な分析をお願いします',
        parsedData.data
      );

      // Send results
      await MessageHandler.sendAnalysisResults(event.channel, aiInsights, file.name);

    } catch (error) {
      console.error('Analysis error:', error);
      await MessageHandler.sendError(event.channel, error.message);
    }
  }

  static isValidCSVFile(file) {
    const validTypes = ['csv', 'tsv'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const maxSize = 10 * 1024 * 1024; // 10MB

    return validTypes.includes(fileExtension) && file.size <= maxSize;
  }

  static async sendUsageGuide(channel) {
    const message = {
      channel: channel,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "📁 CSVファイルを添付してください"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*使い方*\n1. CSVファイルをアップロード\n2. @CSV Analyst と一緒に分析内容を指定\n\n*例*\n• @CSV Analyst この売上データのトレンドを分析して\n• @CSV Analyst 地域別の売上比較をお願いします\n• @CSV Analyst 異常値を特定してください"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*対応ファイル*\nCSV (.csv) / TSV (.tsv)\n*サイズ制限*\n10MB以下"
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "💡 分析したい内容を具体的に教えていただくと、より詳細な洞察を提供できます！"
            }
          ]
        }
      ]
    };

    await slack.chat.postMessage(message);
  }

  static async sendFileError(channel, file) {
    await slack.chat.postMessage({
      channel: channel,
      text: `❌ ファイル "${file.name}" を処理できませんでした。\n\n対応形式: CSV (.csv), TSV (.tsv)\nサイズ制限: 10MB以下\n\n正しい形式のファイルをアップロードしてください。`
    });
  }

  static async sendAnalysisResults(channel, analysis, fileName) {
    const message = {
      channel: channel,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `📊 ${fileName} の分析結果`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: analysis
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `⚡ Powered by CSV Analysis Bot | ${new Date().toLocaleString('ja-JP')}`
            }
          ]
        }
      ]
    };

    await slack.chat.postMessage(message);
  }

  static async sendError(channel, errorMessage) {
    await slack.chat.postMessage({
      channel: channel,
      text: `❌ 分析中にエラーが発生しました：\n${errorMessage}\n\n別のファイルで再度お試しください。`
    });
  }

  static async handleGreeting(event) {
    const responses = [
      "こんにちは！😊 CSV分析の準備万端です！",
      "Hello! データ分析でお手伝いできることがあれば、CSVファイルと一緒にお声がけください。",
      "お疲れ様です！📊 何か分析したいデータはありますか？"
    ];
    
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    await slack.chat.postMessage({
      channel: event.channel,
      text: response
    });
  }

  static async handleHelp(event) {
    await slack.chat.postMessage({
      channel: event.channel,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🤖 CSV Analysis Bot ヘルプ"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*基本的な使い方*\n1. CSVファイルをチャンネルにアップロード\n2. @CSV Analyst + 分析指示を記載\n3. AIが自動でデータ分析・回答"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*分析例*\n• \"売上の推移を分析して\"\n• \"地域別パフォーマンスを比較\"\n• \"異常なデータを見つけて\"\n• \"相関関係を調べて\""
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*制限事項*\n• ファイル形式：CSV, TSV\n• ファイルサイズ：10MB以下\n• 処理時間：約30秒以内"
          }
        }
      ]
    });
  }
}

// ============================================
// Main Handler Function
// ============================================
module.exports = async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'OK',
      message: 'CSV Analysis Bot is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }

  // Only accept POST requests for Slack events
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Verify Slack request (in production)
    if (process.env.NODE_ENV === 'production') {
      if (!verifySlackRequest(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const body = req.body;

    // Handle URL verification challenge
    if (body.type === 'url_verification') {
      return res.status(200).json({ challenge: body.challenge });
    }

    // Handle events
    if (body.type === 'event_callback') {
      const event = body.event;

      switch (event.type) {
        case 'app_mention':
          const text = event.text.toLowerCase();
          
          if (text.includes('help') || text.includes('ヘルプ')) {
            await MessageHandler.handleHelp(event);
          } else if (text.includes('hello') || text.includes('hi') || text.includes('こんにちは')) {
            await MessageHandler.handleGreeting(event);
          } else {
            await MessageHandler.handleAppMention(event);
          }
          break;

        default:
          console.log('Unhandled event type:', event.type);
      }
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};
