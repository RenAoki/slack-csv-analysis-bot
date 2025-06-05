const csv = require('csv-parser');
const axios = require('axios');
const { Readable } = require('stream');

class CSVProcessor {
  constructor() {
    this.maxRows = 10000;
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
  }

  async downloadAndProcessCSV(file, slackClient) {
    try {
      console.log('Downloading file:', file.name);
      
      if (file.size > this.maxFileSize) {
        throw new Error(`ファイルサイズが制限を超えています (最大: ${this.maxFileSize / 1024 / 1024}MB)`);
      }
      
      const response = await axios.get(file.url_private_download, {
        headers: {
          'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        },
        responseType: 'stream',
        timeout: 30000,
        maxContentLength: this.maxFileSize
      });

      const csvData = await this.parseCSVStream(response.data, file.name);
      
      if (csvData.length === 0) {
        throw new Error('CSVファイルにデータが含まれていません');
      }

      if (csvData.length > this.maxRows) {
        console.log(`CSV has ${csvData.length} rows, truncating to ${this.maxRows}`);
        csvData.splice(this.maxRows);
      }

      return {
        data: csvData,
        fileName: file.name,
        rowCount: csvData.length,
        columns: Object.keys(csvData[0] || {}),
        summary: this.generateDataSummary(csvData)
      };

    } catch (error) {
      console.error('Error processing CSV:', error);
      throw new Error(`CSVファイルの処理中にエラーが発生しました: ${error.message}`);
    }
  }

  async parseCSVStream(stream, fileName) {
    return new Promise((resolve, reject) => {
      const results = [];
      const isTSV = fileName.toLowerCase().endsWith('.tsv');
      const separator = isTSV ? '\t' : ',';
      
      let rowCount = 0;

      stream
        .pipe(csv({ separator }))
        .on('data', (data) => {
          rowCount++;
          if (rowCount <= this.maxRows) {
            this.cleanRowData(data);
            results.push(data);
          }
        })
        .on('end', () => {
          console.log(`Parsed ${results.length} rows from ${fileName}`);
          resolve(results);
        })
        .on('error', (error) => {
          console.error('CSV parsing error:', error);
          reject(new Error('CSVファイルの形式が正しくありません'));
        });
    });
  }

  cleanRowData(row) {
    for (const key in row) {
      if (row[key] === '') {
        row[key] = null;
      } else if (row[key] && !isNaN(row[key])) {
        const num = parseFloat(row[key]);
        if (!isNaN(num)) {
          row[key] = num;
        }
      }
    }
    return row;
  }

  generateDataSummary(data) {
    if (!data || data.length === 0) {
      return { rowCount: 0, columns: [] };
    }

    const columns = Object.keys(data[0]);
    const summary = {
      rowCount: data.length,
      columns: columns,
      columnTypes: {},
      sampleData: data.slice(0, 3)
    };

    columns.forEach(column => {
      const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined);
      const numericValues = values.filter(val => typeof val === 'number' && !isNaN(val));
      
      if (numericValues.length > values.length * 0.5) {
        summary.columnTypes[column] = {
          type: 'numeric',
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length
        };
      } else {
        const uniqueValues = [...new Set(values)];
        summary.columnTypes[column] = {
          type: 'categorical',
          uniqueCount: uniqueValues.length,
          sampleValues: uniqueValues.slice(0, 5)
        };
      }
    });

    return summary;
  }

  extractAnalysisIntent(message) {
    const intents = [];
    const text = message.toLowerCase();

    const intentKeywords = {
      'trend': ['トレンド', 'trend', '傾向', '推移', '変化', '時系列'],
      'summary': ['要約', 'summary', '概要', 'まとめ', '統計'],
      'correlation': ['相関', 'correlation', '関係', '関連'],
      'anomaly': ['異常', 'anomaly', '外れ値', 'outlier'],
      'comparison': ['比較', 'comparison', '違い', 'difference']
    };

    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        intents.push(intent);
      }
    }

    if (intents.length === 0) {
      intents.push('summary');
    }

    return intents;
  }

  validateFile(file) {
    const errors = [];

    if (!file) {
      errors.push('ファイルが見つかりません');
      return { isValid: false, errors };
    }

    if (file.size > this.maxFileSize) {
      errors.push(`ファイルサイズが制限を超えています (最大: ${this.maxFileSize / 1024 / 1024}MB)`);
    }

    const validExtensions = ['.csv', '.tsv'];
    const hasValidExtension = validExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      errors.push('CSVまたはTSVファイルのみ対応しています');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = { CSVProcessor };