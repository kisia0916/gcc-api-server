# GCC Launcher API 2026

文化祭ゲームランチャーのランキング、プレイ回数、来場者数をMongoDBへ保存する
Hono APIです。

## Dockerで起動

API、MongoDB、永続ボリュームをDocker Composeでまとめて起動できます。

### Ubuntu Serverで自動セットアップ・更新

本番サーバーには、Docker公式の
[Ubuntu向けDocker Engine導入手順](https://docs.docker.com/engine/install/ubuntu/)に従って
Docker EngineとComposeプラグインをインストールしてください。DockerサービスをOS起動時に
立ち上げるには次を実行します。

```bash
sudo systemctl enable --now docker
docker info
docker compose version
```

配布用 `bootstrap-gcc-api-server.sh` をサーバーへ置いた場合は、次の1回でリポジトリの
clone、認証情報生成、外部DBボリューム作成、バックアップ設定、コンテナ起動を行えます。

```bash
chmod 700 bootstrap-gcc-api-server.sh
./bootstrap-gcc-api-server.sh
```

リポジトリ取得後の更新には、リポジトリ内のスクリプトを使用します。

```bash
./docker/bootstrap.sh
```

スクリプトは、現在のユーザーが `docker info` を実行できる状態で実行してください。
以前の自動設定で `API_PORT=3000` になっている場合も、再実行時に `5555` へ更新します。
既定ではAPIを `0.0.0.0:5555` でLANから接続可能にし、MongoDBは `127.0.0.1` にだけ
公開します。APIポートをインターネットへ直接開けず、公開が必要な場合はHTTPS対応の
リバースプロキシを前段に置いてください。

### Windowsで自動セットアップ・更新

リポジトリ取得前は配布用 `bootstrap-gcc-api-server.ps1` を任意のフォルダへ保存して
実行します。取得後は同じ処理を `docker/bootstrap.ps1` から実行できます。

- リポジトリがなければ `git clone`
- すでにあれば `git pull --ff-only`
- 初回のみランダムな認証情報を `.env` へ生成
- Composeの管理外にあるMongoDB永続ボリュームを作成
- API、MongoDB、日次バックアップを起動

```powershell
powershell -ExecutionPolicy Bypass -File .\docker\bootstrap.ps1
```

どちらのOSでも、ローカルの未コミット変更があり `git pull` できない場合、スクリプトは
変更を上書きせず停止します。

### 手動セットアップ

Ubuntu Server:

```bash
cp docker/.env.example docker/.env
install -d -m 700 backups
docker volume create gcc-api-server-mongo-data
docker compose --env-file docker/.env -f docker/compose.yaml up --build -d
docker compose --env-file docker/.env -f docker/compose.yaml ps
```

Windows PowerShell:

```powershell
Copy-Item docker/.env.example docker/.env
New-Item -ItemType Directory -Force backups
docker volume create gcc-api-server-mongo-data
docker compose --env-file docker/.env -f docker/compose.yaml up --build -d
docker compose --env-file docker/.env -f docker/compose.yaml ps
```

`docker/.env` の `MONGO_ROOT_USERNAME`、`MONGO_ROOT_PASSWORD`、`AUTH_NAME`、
`AUTH_PASSWORD` を必ず設定してください。
MongoDBの認証値にはURLで安全に扱える英数字、`_`、`-`を使用してください。

既定ではAPIをホストの全インターフェースのポート `5555`、MongoDBを
`mongodb://127.0.0.1:27017` でホストへ公開します。LAN内の端末は
`http://<Ubuntu ServerのLAN内IP>:5555` でAPIへ接続できます。既存の `docker/.env` は
自動上書きしないため、以前にセットアップ済みの場合は `API_BIND_ADDRESS=0.0.0.0` へ
変更してください。APIコンテナはMongoDBのヘルスチェック完了後に起動し、DBデータは
外部ボリューム `gcc-api-server-mongo-data` へ保存されます。このボリュームはComposeの
管理外なので、`docker compose down -v` でも削除されず、OSやコンテナを再起動しても
同じデータを使用します。

`backup` コンテナは起動直後と24時間ごとに `mongodump` を実行し、既定では30日分の
圧縮バックアップを `MONGO_BACKUP_DIRECTORY` へ保存します。間隔と保存期間は
`docker/.env` の
`MONGO_BACKUP_INTERVAL_SECONDS`、`MONGO_BACKUP_RETENTION_DAYS` で変更できます。

起動確認には、Basic認証不要のヘルスチェックを使用できます。

```bash
curl --fail http://127.0.0.1:5555/health
```

APIコンテナは起動するたびに `docker/game_info.json` を読み込みます。タイトルがDBに
存在しないゲームだけを追加し、既存ゲームのID、ジャンル、閲覧数などは変更しません。
カタログから消えたゲームもDBから削除しません。手動で再同期する場合は、
`docker/.env` に設定したBasic認証で次を実行できます。

```bash
curl --fail --user '<AUTH_NAME>:<AUTH_PASSWORD>' \
  --request POST http://127.0.0.1:5555/game/set-all-game
```

停止時は次を実行します。外部DBボリュームとホスト側バックアップは残ります。

```bash
docker compose --env-file docker/.env -f docker/compose.yaml down
```

データを失わないため、`docker volume rm gcc-api-server-mongo-data` と
`docker system prune --volumes` は実行しないでください。Dockerデータ領域の削除、
ストレージ故障、サーバー故障には外部ボリュームだけでは耐えられないため、バックアップ先を
別ディスクまたはクラウド同期対象にしてください。

## ローカルで起動

`.env` を作成します。

```dotenv
DB_KEY=mongodb://127.0.0.1:27017/gcc-api
AUTH_NAME=your-username
AUTH_PASSWORD=your-password
PORT=5555
```

```powershell
npm install
npm run typecheck
npm run dev
```

サーバーはMongoDBへの接続と `docker/game_info.json` の同期が完了してから待ち受けを
開始します。必須環境変数、MongoDB接続、カタログ、またはポート指定に問題がある場合は、
理由を標準エラーへ出して終了します。

詳しいレスポンス形式は [API.md](./API.md) を参照。


## ランチャーからゲーム一覧を取り込む

ランチャー側で生成されたカタログをAPI用の最小形式へ変換できます。

```powershell
npm run sync-catalog -- ../path-to-launcher/game_info.json
```

変換結果は `docker/game_info.json` へ保存されます。DockerではこのファイルをAPIコンテナへ
読み取り専用でマウントしているため、変換後にAPIを再起動すると未登録ゲームだけが追加されます。

```bash
docker compose --env-file docker/.env -f docker/compose.yaml restart api
```

既存タイトルのDBレコードと閲覧数は上書きされません。
