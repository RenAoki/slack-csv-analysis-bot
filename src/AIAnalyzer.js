const OpenAI = require('openai');

class AIAnalyzer {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.maxTokens = 2000;
  }

  async performAnalysis(csvData, intents, fileName) {
    try {
      const { data, summary } = csvData;
      
      const prompt = this.buildAnalysisPrompt(data, summary, intents, fileName);
      
      if (prompt.length > 15000) {
        throw new Error('データが大きすぎて分析できません。データサイズを小さくしてください。');
      }
      
      console.log('Sending request to OpenAI...');
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: 0.7,
      });

      const analysis = response.choices[0].message.content;
      
      return {
        analysis,
        fileName,
        rowCount: summary.rowCount,
        columns: summary.columns,
        intents,
        usage: response.usage
      };

    } catch (error) {
      console.error('OpenAI API error:', error);
      
      if (error.code === 'insufficient_quota') {
        throw new Error('OpenAI APIのクォータが不足しています。管理者にお問い合わせください。');
      } else if (error.code === 'invalid_api_key') {
        throw new Error('OpenAI APIキーが無効です。設定を確認してください。');
      } else {
        throw new Error(`AI分析中にエラーが発生しました: ${error.message}`);
      }
    }
  }

  getSystemPrompt() {
    return `あなたは優秀なデータアナリストです。CSVデータを分析し、ビジネス価値の高い洞察を提供してください。

回答の要件:
1. 日本語で回答してください
2. 具体的な数値を含めてください
3. ビジネス上の示唆を提供してください
4. 構造化された形式で回答してください
5. 技術的すぎず、ビジネスパーソンにも理解しやすい内容にしてください

回答形式:
🔍 主要な発見
📈 具体的な数値
💡 ビジネス示唆

専門用語は避け、分かりやすい表現を心がけてください。`;
  }

  buildAnalysisPrompt(data, summary, intents, fileName) {
    const sampleData = data.slice(0, 5);
    
    let prompt = `ファイル名: ${fileName}\n`;
    prompt += `データ概要:\n`;
    prompt += `- 行数: ${summary.rowCount}行\n`;
    prompt += `- 列数: ${summary.columns.length}列\n`;
    prompt += `- 列名: ${summary.columns.join(', ')}\n\n`;

    prompt += `列の詳細情報:\n`;
    Object.entries(summary.columnTypes).forEach(([column, info]) => {
      if (info.type === 'numeric') {
        prompt += `- ${column}: 数値データ (最小: ${info.min}, 最大: ${info.max}, 平均: ${info.avg.toFixed(2)})\n`;
      } else {
        prompt += `- ${column}: カテゴリデータ (ユニーク値: ${info.uniqueCount}個)\n`;
      }
    });

    prompt += `\nサンプルデータ（最初の5行）:\n`;
    prompt += JSON.stringify(sampleData, null, 2);

    prompt += `\n\n分析要求: ${intents.join(', ')}\n`;

    if (intents.includes('trend')) {
      prompt += `\nトレンド分析を重視して、時系列データがある場合は変化パターンを特定してください。`;
    }
    
    if (intents.includes('correlation')) {
      prompt += `\n変数間の相関関係を分析し、重要な関連性を見つけてください。`;
    }
    
    if (intents.includes('anomaly')) {
      prompt += `\n異常値や外れ値を特定し、その原因や影響を考察してください。`;
    }

    if (intents.includes('comparison')) {
      prompt += `\nカテゴリ間やグループ間の比較分析を行ってください。`;
    }

    prompt += `\n\n上記のデータを分析し、ビジネス価値の高い洞察を提供してください。`;
    prompt += `具体的な数値を使用し、実用的な推奨事項を含めてください。`;

    return prompt;
  }

  formatAnalysisResult(analysisResult) {
    const { analysis, fileName, rowCount, columns, intents } = analysisResult;
    
    let formattedResult = `📊 **${fileName}** の分析結果\n\n`;
    formattedResult += `📋 データ概要: ${rowCount}行 × ${columns.length}列\n`;
    formattedResult += `🎯 分析タイプ: ${intents.join(', ')}\n\n`;
    formattedResult += `${analysis}`;
    
    return formattedResult;
  }

  validateOpenAIConfig() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY環境変数が設定されていません');
    }
    
    if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
      throw new Error('無効なOpenAI APIキーです');
    }
  }

  async testConnection() {
    try {
      this.validateOpenAIConfig();
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      });
      
      return { success: true, model: response.model };
    } catch (error) {
      console.error('OpenAI connection test failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { AIAnalyzer };