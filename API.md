# GCC API Server APIドキュメント

ゲームの閲覧数ランキングと来場者カウンターを管理するHTTP APIです。Honoで実装され、データはMongoDBに保存されます。

- 対象リポジトリ: <https://github.com/kisia0916/gcc-api-server>
- 調査対象コミット: `6cbbefc13fe8ff71d06c15772d964cc7f997d27d`
- ローカルのベースURL: `http://localhost:3000`
- データ形式: JSON（`GET /` と認証エラーを除く）
- 認証: HTTP Basic認証

> 公開環境のURLはリポジトリ内に定義されていません。以下ではローカルURLを使用します。

## クイックスタート

### 必要な環境

- Node.js 20系を推奨（型定義がNode.js 20向け）
- MongoDB

### 環境変数

プロジェクトルートに `.env` を作成します。

```dotenv
DB_KEY=mongodb://127.0.0.1:27017/gcc-api
AUTH_NAME=your-username
AUTH_PASSWORD=your-password
```

| 変数 | 必須 | 説明 |
|---|---:|---|
| `DB_KEY` | はい | Mongooseが接続するMongoDB接続文字列 |
| `AUTH_NAME` | はい | Basic認証のユーザー名 |
| `AUTH_PASSWORD` | はい | Basic認証のパスワード |

### 起動

```bash
npm install
npm run dev
```

サーバーはポート `3000` で起動します。ポートは環境変数では変更できません。

### 疎通確認

```bash
curl -u "your-username:your-password" http://localhost:3000/
```

成功時のレスポンス:

```text
test
```

## 共通仕様

### 認証

すべてのパスでHTTP Basic認証が必要です。`curl` では `-u`、JavaScriptでは `Authorization` ヘッダーを使用します。

```http
Authorization: Basic <base64(username:password)>
```

認証情報がない、または一致しない場合は `401 Unauthorized` です。

### リクエストヘッダー

JSONボディを送るAPIでは次を指定してください。

```http
Content-Type: application/json
```

### CORS

CORSミドルウェアが全パスに適用されています。実装上、許可オリジンはデフォルトの `*` です。

### 共通エラー

アプリケーション内で例外が起きた場合:

```json
{
  "message": "server error"
}
```

ステータスは `500 Internal Server Error` です。存在しないパスでは、認証成功後に次を返します。

```json
{
  "message": "not found"
}
```

ステータスは `404 Not Found` です。

## データモデル

### Game

| フィールド | 型 | 説明 |
|---|---|---|
| `_id` | string | MongoDBのドキュメントID |
| `id` | string | アプリケーション側で生成したUUID |
| `title` | string | ゲームタイトル。データベース上で一意 |
| `counter` | number | 閲覧数。初期値は `0` |
| `genre` | string | ジャンル |
| `__v` | number | Mongooseのバージョンキー |

同梱の初期データでは `action`、`command`、`shooting`、`table`、`other` の5ジャンルが使われています。ただしAPI自体はジャンルを列挙値として検証しません。

### VisitorCounter

| フィールド | 型 | 説明 |
|---|---|---|
| `_id` | string | MongoDBのドキュメントID |
| `title` | string | カウンター名。データベース上で一意 |
| `counter` | number | 来場者数。初期値は `0` |
| `__v` | number | Mongooseのバージョンキー |

## エンドポイント一覧

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/` | 疎通確認 |
| `GET` | `/ranking/get-all-ranking` | 全ゲームの上位15件を取得 |
| `POST` | `/ranking/get-genre-ranking` | ジャンルごとの上位3件を取得 |
| `POST` | `/game/set-new-game` | ゲームを1件登録 |
| `POST` | `/game/set-all-game` | 同梱JSONからゲームを一括登録 |
| `POST` | `/game/get-all-view-counter` | ジャンルごとのゲーム閲覧数を取得 |
| `PUT` | `/game/add-view-counter` | ゲーム閲覧数を1増加 |
| `PUT` | `/game/reset-all-view-counter` | 全ゲームの閲覧数を0にリセット |
| `POST` | `/visitor/create-visitor-data` | 来場者カウンターを作成 |
| `POST` | `/visitor/get-visitor` | 来場者カウンターを取得 |
| `PUT` | `/visitor/add-visitor` | 来場者数を加算 |

## Ranking API

### 全体ランキングを取得

`GET /ranking/get-all-ranking`

全ゲームを `counter` の降順で並べ、上位15件を返します。

```bash
curl -u "your-username:your-password" \
  http://localhost:3000/ranking/get-all-ranking
```

成功時: `200 OK`

```json
{
  "data": [
    {
      "_id": "66d000000000000000000001",
      "id": "5bed8918-bc10-4c4f-9f04-39ba16c6338a",
      "title": "Sample Game",
      "counter": 42,
      "genre": "action",
      "__v": 0
    }
  ]
}
```

### ジャンル別ランキングを取得

`POST /ranking/get-genre-ranking`

指定した各ジャンルについて、閲覧数上位3件を返します。

リクエスト:

```json
{
  "genres": ["action", "shooting"]
}
```

```bash
curl -u "your-username:your-password" \
  -H "Content-Type: application/json" \
  -d '{"genres":["action","shooting"]}' \
  http://localhost:3000/ranking/get-genre-ranking
```

成功時: `200 OK`

```json
{
  "data": [
    [
      {
        "_id": "66d000000000000000000001",
        "id": "5bed8918-bc10-4c4f-9f04-39ba16c6338a",
        "title": "Action Game",
        "counter": 42,
        "genre": "action",
        "__v": 0
      }
    ],
    [
      {
        "_id": "66d000000000000000000002",
        "id": "f222b43a-b96f-47bf-ac0c-afad818e53eb",
        "title": "Shooting Game",
        "counter": 30,
        "genre": "shooting",
        "__v": 0
      }
    ]
  ]
}
```

`data` は二次元配列です。外側の配列はリクエストの `genres` と同じ順序で、該当ゲームがないジャンルの要素は空配列になります。

## Game API

### ゲームを1件登録

`POST /game/set-new-game`

UUIDを生成し、`counter: 0` のゲームを登録します。

リクエスト:

```json
{
  "title": "Sample Game",
  "genre": "action"
}
```

```bash
curl -u "your-username:your-password" \
  -H "Content-Type: application/json" \
  -d '{"title":"Sample Game","genre":"action"}' \
  http://localhost:3000/game/set-new-game
```

成功時: `200 OK`

```json
{
  "data": {
    "_id": "66d000000000000000000001",
    "id": "5bed8918-bc10-4c4f-9f04-39ba16c6338a",
    "title": "Sample Game",
    "counter": 0,
    "genre": "action"
  }
}
```

`title` は一意です。ただし保存処理を待たずに応答する実装のため、重複タイトルなどの保存エラーがレスポンスに反映されない可能性があります。

### 同梱JSONからゲームを一括登録

`POST /game/set-all-game`

サーバーのカレントディレクトリにある `game_info.json` を読み込み、`genres` 以外の各配列から `title` と `genre` を登録します。リクエストボディはありません。

```bash
curl -u "your-username:your-password" \
  -X POST \
  http://localhost:3000/game/set-all-game
```

成功時: `200 OK`

```json
{
  "data": "done"
}
```

> この処理は既存データを削除せず、各保存処理の完了も待ちません。再実行すると一意制約に抵触する可能性があります。管理者専用操作として扱ってください。

### ジャンルごとの閲覧数を取得

`POST /game/get-all-view-counter`

指定したジャンルに属する全ゲームのタイトルと閲覧数を返します。ランキング順への並べ替えは行いません。

リクエスト:

```json
{
  "genres": ["action", "table"]
}
```

```bash
curl -u "your-username:your-password" \
  -H "Content-Type: application/json" \
  -d '{"genres":["action","table"]}' \
  http://localhost:3000/game/get-all-view-counter
```

成功時: `200 OK`

```json
{
  "data": [
    [
      { "title": "Action Game", "counter": 42 },
      { "title": "Another Action Game", "counter": 8 }
    ],
    [
      { "title": "Table Game", "counter": 12 }
    ]
  ]
}
```

外側の配列はリクエストの `genres` と同じ順序です。

### ゲーム閲覧数を増加

`PUT /game/add-view-counter`

指定タイトルの `counter` を1増加します。

リクエスト:

```json
{
  "title": "Sample Game"
}
```

```bash
curl -u "your-username:your-password" \
  -X PUT \
  -H "Content-Type: application/json" \
  -d '{"title":"Sample Game"}' \
  http://localhost:3000/game/add-view-counter
```

成功時: `200 OK`

```json
{
  "message": "done"
}
```

> 指定タイトルが存在しない場合でも、現在の実装は同じ `200` レスポンスを返します。

### 全ゲーム閲覧数をリセット

`PUT /game/reset-all-view-counter`

全ゲームの `counter` を `0` に設定します。リクエストボディはありません。

```bash
curl -u "your-username:your-password" \
  -X PUT \
  http://localhost:3000/game/reset-all-view-counter
```

成功時: `200 OK`

```json
{
  "message": "done"
}
```

> 全件更新を行う破壊的な管理操作です。通常の閲覧クライアントにはこの認証情報を渡さないでください。

## Visitor API

### 来場者カウンターを作成

`POST /visitor/create-visitor-data`

指定した名前で来場者カウンターを作成します。`counter` の初期値は `0` です。

リクエスト:

```json
{
  "title": "main"
}
```

```bash
curl -u "your-username:your-password" \
  -H "Content-Type: application/json" \
  -d '{"title":"main"}' \
  http://localhost:3000/visitor/create-visitor-data
```

成功時: `200 OK`

```json
{
  "data": {
    "_id": "66d000000000000000000003",
    "title": "main",
    "counter": 0
  }
}
```

`title` は一意です。同名データの再作成はデータベース側で失敗します。ただし保存処理が待機されていないため、現在の実装では保存エラーがレスポンスに正しく反映されない可能性があります。

### 来場者カウンターを取得

`POST /visitor/get-visitor`

リクエスト:

```json
{
  "title": "main"
}
```

```bash
curl -u "your-username:your-password" \
  -H "Content-Type: application/json" \
  -d '{"title":"main"}' \
  http://localhost:3000/visitor/get-visitor
```

成功時: `200 OK`

```json
{
  "data": {
    "_id": "66d000000000000000000003",
    "title": "main",
    "counter": 123,
    "__v": 0
  }
}
```

該当データがない場合も `200 OK` で、レスポンスは `{"data":null}` です。

### 来場者数を加算

`PUT /visitor/add-visitor`

`add` に正数を指定すると加算、負数を指定すると減算します。0や小数も実装上は受け入れられます。

リクエスト:

```json
{
  "title": "main",
  "add": 1
}
```

```bash
curl -u "your-username:your-password" \
  -X PUT \
  -H "Content-Type: application/json" \
  -d '{"title":"main","add":1}' \
  http://localhost:3000/visitor/add-visitor
```

成功時: `200 OK`

```json
{
  "data": "done"
}
```

> 指定タイトルが存在しない場合でも、現在の実装は同じ `200` レスポンスを返します。

## JavaScriptからの利用例

```js
const baseUrl = "http://localhost:3000";
const credentials = btoa(`${username}:${password}`);

const response = await fetch(`${baseUrl}/ranking/get-all-ranking`, {
  headers: {
    Authorization: `Basic ${credentials}`,
  },
});

if (!response.ok) {
  throw new Error(`API error: ${response.status}`);
}

const { data: games } = await response.json();
console.log(games);
```

Node.jsで `btoa` が使えない環境では、`Buffer.from(username + ":" + password).toString("base64")` を使用します。

## 実装上の注意点

- リクエストボディの必須項目・型・値域を検証していません。不正なJSONや想定外の値は多くの場合 `500` になります。
- Basic認証が全APIで共通です。閲覧、カウンター更新、全件リセットの権限分離はありません。
- `set-new-game`、`set-all-game`、`create-visitor-data` では `save()` を `await` していません。
- 更新APIはMongoDBの更新件数を確認しないため、対象が存在しなくても成功を返します。
- レート制限はありません。インターネット公開時はリバースプロキシ等で追加してください。
- HTTPS終端はアプリ内にありません。本番環境ではHTTPS対応のプロキシまたはホスティング基盤の背後で動かしてください。

機械可読な完全定義は同梱の `openapi.yaml` を参照してください。
