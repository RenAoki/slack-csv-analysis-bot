# CSV分析Slackボット

SlackでCSVファイルをアップロードし、OpenAI GPT-4による自動分析結果を取得するボットシステムです。

## 🚀 主な機能

- **CSVファイル自動処理**: CSV/TSVファイルの自動ダウンロード・パース
- **AI分析**: OpenAI GPT-4によるデータ分析（トレンド、統計、相関など）
- **インテント認識**: ユーザーメッセージから分析目的を自動抽出
- **構造化された結果**: ビジネス価値重視の分析結果をSlackで表示
- **エラーハンドリング**: ファイル形式・サイズ制限・API エラー対応

## 📋 対応ファイル形式

- **ファイル形式**: CSV (.csv), TSV (.tsv)
- **最大サイズ**: 10MB
- **最大行数**: 10,000行

## 🛠️ セットアップ

### 1. リポジトリクローン

```bash
git clone <repository-url>
cd casca-slackbot
npm install
```

### 2. 環境変数設定

`.env`ファイルを作成し、以下の環境変数を設定してください：

```bash
# Slack Bot Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_APP_TOKEN=xapp-your-app-token-here

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Environment
NODE_ENV=development
```

### 3. Slack Appの作成

1. [Slack API](https://api.slack.com/apps)でSlack Appを作成
2. 以下の権限を設定：
   - `app_mentions:read`
   - `chat:write`
   - `files:read`
3. Socket Modeを有効化
4. App-Level Tokenを取得（connections:write権限）
5. OAuth & Permissionsでワークスペースにインストール

### 4. ローカル実行

```bash
npm run dev
```

## 🚀 Vercelデプロイ

### 1. Vercel CLIインストール

```bash
npm i -g vercel
```

### 2. プロジェクトデプロイ

```bash
vercel --prod
```

### 3. Vercel環境変数設定

Vercelダッシュボードで以下の環境変数を設定：

```
SLACK_BOT_TOKEN=xoxb-***
SLACK_SIGNING_SECRET=***
SLACK_APP_TOKEN=xapp-***
OPENAI_API_KEY=sk-***
NODE_ENV=production
```

### 4. Slack App設定更新

Vercelで取得したURLを使用してSlack Appの設定を更新：

- **Request URL**: `https://your-app.vercel.app/api/slack`
- **Socket Mode**: OFF（HTTP Endpoint使用）

## 📖 使用方法

### 基本的な使い方

Slackで`@bot`にメンションし、CSVファイルを添付：

```
@bot このデータのトレンドを分析して
```

### 分析タイプ

以下のキーワードで分析タイプを指定可能：

- **トレンド分析**: `トレンド`, `傾向`, `推移`, `時系列`
- **統計要約**: `要約`, `概要`, `まとめ`, `統計`
- **相関分析**: `相関`, `関係`, `関連`
- **異常検知**: `異常`, `外れ値`
- **比較分析**: `比較`, `違い`

### 使用例

```
@bot 売上データの相関を調べて [sales.csv添付]
@bot このデータの異常値を見つけて [data.csv添付]
@bot 月別のトレンドを分析して [monthly_report.csv添付]
```

## 🏗️ プロジェクト構造

```
casca-slackbot/
├── index.js                 # メインエントリーポイント
├── package.json             # 依存関係定義
├── vercel.json              # Vercelデプロイ設定
├── .env.example             # 環境変数テンプレート
├── README.md                # このファイル
├── api/
│   └── slack.js             # Vercel Serverless Function
└── src/
    ├── CSVAnalysisBot.js    # メインボットクラス
    ├── SlackBot.js          # Slack連携クラス
    ├── CSVProcessor.js      # CSV処理クラス
    └── AIAnalyzer.js        # OpenAI分析クラス
```

## 🔧 技術仕様

- **Runtime**: Node.js 18+
- **Framework**: Slack Bolt SDK
- **AI Engine**: OpenAI GPT-4 API
- **Data Processing**: csv-parser
- **Deployment**: Vercel (サーバーレス)

## 🛡️ セキュリティ

- API トークンの安全な管理
- ファイルサイズ・形式制限
- 一時ファイル処理（永続化なし）
- エラー情報の適切なマスキング

## 📊 分析結果例

```
📊 sales_data.csv の分析結果

🔍 主要な発見
- 売上は過去6ヶ月で15%増加傾向
- 地域別では東京が全体の42%を占める
- 製品Aが最も収益性が高い（平均利益率23%）

📈 具体的な数値
- 月平均売上: ¥12,500,000
- 最高売上月: 2024年3月（¥15,200,000）
- 成長率: 前年同期比+15.2%

💡 ビジネス示唆
- 東京以外の地域での販促強化を推奨
- 製品Aの在庫確保・マーケティング強化
- Q4に向けた戦略的投資検討を提案
```

## 🚨 トラブルシューティング

### よくある問題

1. **ボットが反応しない**
   - Slack Appの権限設定を確認
   - 環境変数の設定を確認
   - Socket Mode/Request URLの設定を確認

2. **ファイル処理エラー**
   - ファイルサイズ（10MB以下）を確認
   - ファイル形式（CSV/TSV）を確認
   - 文字エンコーディング（UTF-8推奨）を確認

3. **OpenAI APIエラー**
   - APIキーの有効性を確認
   - APIクォータの残量を確認
   - プロンプトサイズの制限を確認

### ログ確認

```bash
# ローカル開発時
npm run dev

# Vercelログ確認
vercel logs
```

## 📝 ライセンス

MIT License

## 🤝 サポート

問題が発生した場合は、GitHubのIssuesでお知らせください。