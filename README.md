# GCC Launcher API 2026

文化祭ゲームランチャーのランキング、プレイ回数、来場者数をMongoDBへ保存する
Hono APIです。

## 起動

`.env` を作成します。

```dotenv
DB_KEY=mongodb://127.0.0.1:27017/gcc-api
AUTH_NAME=your-username
AUTH_PASSWORD=your-password
PORT=3000
```

```powershell
npm install
npm run typecheck
npm run dev
```

サーバーはMongoDBへの接続が完了してから待ち受けを開始します。必須環境変数、
MongoDB接続、またはポート指定に問題がある場合は、理由を標準エラーへ出して終了します。

詳しいレスポンス形式は [API.md](./API.md) を参照。


## ランチャーからゲーム一覧を取り込む

ランチャー側で生成されたカタログをAPI用の最小形式へ変換できます。

```powershell
npm run sync-catalog -- ../path-to-launcher/game_info.json
```

変換後に `POST /game/set-all-game` を呼ぶと、既存カウンターを維持してDBへ
追加・更新されます。
