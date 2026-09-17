# GCC Launcher API 2026

`GET /health` を除く全エンドポイントにHTTP Basic認証が必要です。ベースURLの
既定値は `http://localhost:5555` で、`PORT` 環境変数から変更できます。

## 共通レスポンス

成功時:

```json
{
  "ok": true,
  "data": {}
}
```

失敗時:

```json
{
  "ok": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "title is required"
  }
}
```

主なステータスは次のとおりです。

| Status | code | 意味 |
|---:|---|---|
| 400 | `BAD_REQUEST` | JSON、必須項目、値域、カタログが不正 |
| 404 | `NOT_FOUND` | ゲーム、カウンター、またはルートが存在しない |
| 409 | `CONFLICT` | 同名データがすでに存在する |
| 500 | `INTERNAL_ERROR` | DBやファイルなどサーバー内部の障害 |

## エンドポイント

| Method | Path | 説明 |
|---|---|---|
| GET | `/health` | コンテナ・サービスの稼働確認（認証不要） |
| GET | `/` | サービス情報 |
| GET | `/ranking/get-all-ranking` | 全体ランキング上位15件 |
| POST | `/ranking/get-genre-ranking` | `genres`ごとの上位3件 |
| POST | `/game/set-new-game` | `{title, genre}`を新規登録 |
| POST | `/game/set-all-game` | `docker/game_info.json`から未登録ゲームだけを追加 |
| POST | `/game/get-all-view-counter` | `genres`ごとのカウンター一覧 |
| PUT | `/game/add-view-counter` | `{title}`のカウンターを1増加 |
| PUT | `/game/reset-all-view-counter` | 全ゲームのカウンターを0へ戻す |
| POST | `/visitor/create-visitor-data` | `{title}`の来場者カウンターを作成 |
| POST | `/visitor/get-visitor` | `{title}`の来場者カウンターを取得 |
| PUT | `/visitor/add-visitor` | `{title, add}`で正の整数を加算 |
| GET | `/session/settings` | 新しく始める体験の制限時間を取得 |
| PUT | `/session/settings` | `{durationSeconds}`で制限時間を更新 |
| GET | `/admin/dashboard` | 管理画面用の来場者数、体験時間、全ゲーム集計 |

## 管理画面用集計

`GET /admin/dashboard` は管理画面が5秒間隔で取得する読み取り用エンドポイントです。
現在の体験時間、来場者数、総プレイ数、登録ゲーム数と、全ゲームのプレイ数順一覧を
1回のリクエストで返します。来場者カウンターや体験時間が未作成の場合は既定値で
自動作成します。

## 体験時間の変更

設定値はMongoDBへ保存され、人数選択後に各ランチャーから取得されます。すでに開始した
体験の残り時間は途中変更されず、次の体験から新しい設定が使われます。

```bash
curl -u "user:password" \
  -X PUT \
  -H "Content-Type: application/json" \
  -d '{"durationSeconds":300}' \
  http://localhost:5555/session/settings
```

設定可能範囲は30〜3600秒です。未設定時は360秒で自動作成されます。

## カタログ同期

APIは起動時に `docker/game_info.json` を読み込みます。`POST /game/set-all-game` でも
同じ同期を手動実行できます。
`genres`に列挙された各配列のみを対象とし、必須項目とタイトル重複を先に検証します。
起動時の検証に失敗した場合はサーバーを開始せず、手動APIではDBを更新せず400で
問題箇所を返します。

成功例:

```json
{
  "ok": true,
  "data": {
    "total": 56,
    "inserted": 3,
    "existing": 53
  }
}
```

既存タイトルのレコードはジャンル、ID、カウンター、更新日時を含め一切変更しません。
新規タイトルだけにUUIDとカウンター0を設定します。カタログから消えたゲームのDBレコードも
自動削除しません。
