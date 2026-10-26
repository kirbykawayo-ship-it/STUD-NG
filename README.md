# STUDING — 勉強時間を共有するSNS

レスポンシブな勉強SNSのスターターです。ホーム、公開ランキング、タイマー、手動記録、プロフィール、いいね、コメント、チャットを含みます。Supabaseを設定するまではデモデータを表示し、データは保存されません。

## 0.公式リンク
-https://stud-ng.vercel.app/?utm_source=chatgpt.com

## 1. 必要なもの
- Supabaseアカウント（認証・データベース）
- Vercelアカウント（公開URL）
- Node.js 20以降（ローカル確認する場合）

## 2. Supabaseを設定
1. https://supabase.com/ で新しいプロジェクトを作成します。
2. Dashboard の **SQL Editor** で `schema.sql` の内容を実行します。
3. **Project Settings → API** から Project URL と anon/publishable key を確認します。`service_role` キーは絶対にブラウザ側へ入れないでください。
4. `public/config.js` の `YOUR_SUPABASE_URL` と `YOUR_SUPABASE_ANON_KEY` を置き換えます。
5. **Authentication → URL Configuration** でローカル開発URLやVercelの公開URLを設定します。
6. 開発中に確認メールが必要な場合は、登録時に送られるメールを確認します。公開前にメール確認設定を見直してください。

## 3. ローカルで起動
```bash
npm install
npm run dev
```
表示されたローカルURLをブラウザで開きます。ビルド確認は `npm run build` です。

## 4. Vercelで公開
1. このフォルダをGitHubの新しいリポジトリにアップロードします。
2. https://vercel.com/ で **Add New → Project** を選び、そのリポジトリをインポートします。
3. Viteプロジェクトとして認識されることを確認し、Deployします。
4. 発行された `*.vercel.app` URLをSupabaseのAuthentication URL Configurationに追加します。
5. そのURLを友だちに共有します。

`public/config.js` はブラウザに配信されます。Supabaseのanon/publishable keyは公開前提ですが、RLSを有効にしたまま使ってください。service_role key、パスワード、秘密鍵は置かないでください。

## 公開前に確認すること
- このスターターでは、プロフィール、勉強ログ、コメント、いいね、チャットは公開読み取りです。公開したくない情報を書き込まないようにしてください。
- アカウント登録はSupabaseの設定が有効なら誰でもできます。招待制にはしていません。
- 現状、投稿・コメント・メッセージの編集UI、ユーザー通報・ブロック、管理者モデレーション、パスワードリセットUIは未実装です。一般公開前にモデレーションと不適切投稿への対応を追加してください。
- タイマーの記録は分単位に切り捨てられます。プロフィールの合計表示は直近10件の表示用集計です。ランキングは全ログを集計します。
- 本名、住所、学校名、電話番号などの個人情報をプロフィールやチャットに書かないでください。

## ファイル
- `index.html` — 画面構成
- `style.css` — レスポンシブデザイン
- `src.js` — フロントエンドとSupabase連携
- `public/config.js` — Supabaseの公開設定
- `schema.sql` — テーブル、RLSポリシー、プロフィール自動作成トリガー
