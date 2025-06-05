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
// 柔軟なCSV解析エンジン - 改善版
// ============================================
// ============================================
// 柔軟なCSV解析エンジン - 改善版
// ============================================
class FlexibleCSVAnalyzer {
  
  // ============================================
  // インテリジェントCSV解析
  // ============================================
  static parseCSVIntelligent(csvText) {
    console.log('=== Intelligent CSV Parsing Started ===');
    
    // 1. 区切り文字の自動検出
    const delimiter = this.detectDelimiter(csvText);
    console.log('Detected delimiter:', delimiter);
    
    // 2. エンコーディング問題の修正
    const cleanedText = this.cleanCSVText(csvText);
    
    // 3. 行の分割と前処理
    const lines = this.splitLines(cleanedText);
    console.log('Total lines:', lines.length);
    
    // 4. ヘッダー行の検出
    const headerInfo = this.detectHeaders(lines, delimiter);
    console.log('Header info:', headerInfo);
    
    // 5. データ行の解析
    const parsedData = this.parseDataRows(lines, headerInfo, delimiter);
    
    return {
      headers: headerInfo.headers,
      data: parsedData,
      rowCount: parsedData.length,
      delimiter: delimiter,
      headerRowIndex: headerInfo.rowIndex,
      metadata: {
        totalLines: lines.length,
        emptyLines: lines.filter(line => !line.trim()).length,
        dataQuality: this.assessDataQuality(parsedData)
      }
    };
  }

  // ============================================
  // 区切り文字の自動検出
  // ============================================
  static detectDelimiter(csvText) {
    const delimiters = [',', ';', '\t', '|'];
    const sampleLines = csvText.split('\n').slice(0, 5); // 最初の5行をサンプル
    
    let bestDelimiter = ',';
    let maxConsistency = 0;
    
    for (const delimiter of delimiters) {
      const columnCounts = sampleLines
        .filter(line => line.trim())
        .map(line => this.splitCSVLine(line, delimiter).length);
      
      if (columnCounts.length > 0) {
        // 各行の列数の一貫性をチェック
        const mode = this.findMode(columnCounts);
        const consistency = columnCounts.filter(count => count === mode).length / columnCounts.length;
        
        if (consistency > maxConsistency && mode > 1) {
          maxConsistency = consistency;
          bestDelimiter = delimiter;
        }
      }
    }
    
    return bestDelimiter;
  }

  // ============================================
  // CSV行の適切な分割（引用符対応）
  // ============================================
  static splitCSVLine(line, delimiter = ',') {
    const result = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = null;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        if (nextChar === quoteChar) {
          // エスケープされた引用符
          current += char;
          i++; // 次の文字をスキップ
        } else {
          inQuotes = false;
          quoteChar = null;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  // ============================================
  // テキストのクリーニング
  // ============================================
  static cleanCSVText(csvText) {
    return csvText
      .replace(/\r\n/g, '\n')  // Windows改行を統一
      .replace(/\r/g, '\n')    // Mac改行を統一
      .replace(/^\uFEFF/, '')  // BOM削除
      .trim();
  }

  // ============================================
  // 行の分割と空行除去
  // ============================================
  static splitLines(csvText) {
    return csvText
      .split('\n')
      .map(line => line.trim())
      .filter((line, index) => {
        // 完全に空の行は除去
        if (!line) return false;
        
        // コメント行の除去（#で始まる行）
        if (line.startsWith('#')) return false;
        
        return true;
      });
  }

  // ============================================
  // ヘッダー行の検出
  // ============================================
  static detectHeaders(lines, delimiter) {
    let bestHeaderRow = 0;
    let bestHeaders = [];
    let maxScore = 0;
    
    // 最初の5行以内でヘッダーを探す
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const columns = this.splitCSVLine(lines[i], delimiter);
      const score = this.scoreHeaderRow(columns, lines.slice(i + 1), delimiter);
      
      if (score > maxScore) {
        maxScore = score;
        bestHeaderRow = i;
        bestHeaders = columns;
      }
    }
    
    return {
      rowIndex: bestHeaderRow,
      headers: bestHeaders.map(header => this.cleanHeader(header))
    };
  }

  // ============================================
  // ヘッダー行のスコアリング
  // ============================================
  static scoreHeaderRow(columns, dataLines, delimiter) {
    let score = 0;
    
    // 1. 列数の一貫性
    const sampleDataRows = dataLines.slice(0, 10);
    const columnCounts = sampleDataRows.map(line => this.splitCSVLine(line, delimiter).length);
    const consistency = columnCounts.filter(count => count === columns.length).length / Math.max(columnCounts.length, 1);
    score += consistency * 50;
    
    // 2. ヘッダーの品質
    for (const column of columns) {
      if (column && column.trim()) {
        // 文字が含まれている
        score += 10;
        
        // 数値でない（ヘッダーらしい）
        if (isNaN(column.replace(/[^0-9.-]/g, ''))) {
          score += 5;
        }
        
        // 一般的なヘッダー語句
        const headerKeywords = ['name', 'date', 'id', '名前', '日付', '金額', 'amount', 'price', '売上', '利益'];
        if (headerKeywords.some(keyword => column.toLowerCase().includes(keyword))) {
          score += 15;
        }
      }
    }
    
    return score;
  }

  // ============================================
  // ヘッダーのクリーニング
  // ============================================
  static cleanHeader(header) {
    return header
      .replace(/["\'\`]/g, '')  // 引用符削除
      .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_')  // 特殊文字を_に
      .trim()
      .replace(/\s+/g, '_')     // スペースを_に
      || 'Column_' + Math.random().toString(36).substr(2, 5);  // 空の場合はランダム名
  }

  // ============================================
  // データ行の解析
  // ============================================
  static parseDataRows(lines, headerInfo, delimiter) {
    const headers = headerInfo.headers;
    const data = [];
    
    // ヘッダー行以降をデータとして処理
    for (let i = headerInfo.rowIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const values = this.splitCSVLine(line, delimiter);
      
      // 列数が合わない場合の対処
      if (values.length !== headers.length) {
        console.log(`Row ${i}: Column count mismatch. Expected ${headers.length}, got ${values.length}`);
        
        // 少ない場合は空文字で埋める
        while (values.length < headers.length) {
          values.push('');
        }
        
        // 多い場合は切り捨て
        if (values.length > headers.length) {
          values.splice(headers.length);
        }
      }
      
      const row = {};
      headers.forEach((header, index) => {
        let value = values[index] || '';
        
        // データの型推定と変換
        value = this.convertValue(value);
        row[header] = value;
      });
      
      data.push(row);
    }
    
    return data;
  }

  // ============================================
  // 値の型変換
  // ============================================
  static convertValue(value) {
    if (!value || value.trim() === '') return null;
    
    const trimmed = value.trim();
    
    // 数値の変換
    if (/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(trimmed)) {
      // カンマ区切りの数値
      return parseFloat(trimmed.replace(/,/g, ''));
    }
    
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      // 普通の数値
      return parseFloat(trimmed);
    }
    
    return trimmed;
  }

  // ============================================
  // データ品質の評価
  // ============================================
  static assessDataQuality(data) {
    if (!data || data.length === 0) {
      return { score: 0, issues: ['No data rows found'] };
    }
    
    const issues = [];
    let score = 100;
    
    // 空のセルの割合
    let totalCells = 0;
    let emptyCells = 0;
    
    data.forEach(row => {
      Object.values(row).forEach(value => {
        totalCells++;
        if (value === null || value === '') {
          emptyCells++;
        }
      });
    });
    
    const emptyRatio = emptyCells / totalCells;
    if (emptyRatio > 0.3) {
      issues.push(`High empty cell ratio: ${(emptyRatio * 100).toFixed(1)}%`);
      score -= 30;
    }
    
    return {
      score: Math.max(0, score),
      issues: issues
    };
  }

  // ============================================
  // ユーティリティ関数
  // ============================================
  static findMode(arr) {
    const frequency = {};
    let maxCount = 0;
    let mode = arr[0];
    
    for (const num of arr) {
      frequency[num] = (frequency[num] || 0) + 1;
      if (frequency[num] > maxCount) {
        maxCount = frequency[num];
        mode = num;
      }
    }
    
    return mode;
  }

  // ============================================
  // 高度な分析機能
  // ============================================
  static analyzeDataAdvanced(parsedData) {
    const { headers, data, metadata } = parsedData;
    
    const analysis = {
      overview: {
        totalRows: data.length,
        totalColumns: headers.length,
        columns: headers,
        dataQuality: metadata.dataQuality
      },
      columnAnalysis: {},
      patterns: [],
      insights: []
    };

    // より詳細な列分析
    headers.forEach(column => {
      const values = data.map(row => row[column]).filter(v => v !== null && v !== '');
      const numericValues = values.filter(v => typeof v === 'number');
      
      const columnStats = {
        type: numericValues.length > values.length * 0.7 ? 'numeric' : 'text',
        nonEmptyCount: values.length,
        uniqueCount: new Set(values).size,
        sampleValues: values.slice(0, 5)
      };

      if (numericValues.length > 0) {
        columnStats.statistics = {
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          average: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
          sum: numericValues.reduce((a, b) => a + b, 0)
        };
      }

      analysis.columnAnalysis[column] = columnStats;
    });

    return analysis;
  }
}

// ============================================
// CSV Analysis Engine - 改善版
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
    // 新しい柔軟な解析を使用
    return FlexibleCSVAnalyzer.parseCSVIntelligent(csvText);
  }

  static analyzeData(parsedData) {
    // 新しい高度な分析を使用
    return FlexibleCSVAnalyzer.analyzeDataAdvanced(parsedData);
  }

  static async generateAIInsights(analysis, userQuery, sampleData) {
    // 既存のOpenAI連携コードをそのまま維持
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
    // if (process.env.NODE_ENV === 'production') {
    //   if (!verifySlackRequest(req)) {
    //     return res.status(401).json({ error: 'Unauthorized' });
    //   }
    // }

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
