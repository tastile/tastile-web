# Boot evidence (2026-08-09-usecase-e2e-30)

Generated: 2026-08-09T21:24:29+09:00

## Image presence (tastile-v1-api:latest)

```
tastile-v1-api        latest       7653151e9186   5 hours ago      238.27 MB
(image present)
```

## wslc stack status (pre-boot)

```
コンテナー ID       名前                     画像                     作成済み             状態                       ポート
d74cfe39ed05   tastile-android-dev…   tastile-android-dev…   18 minutes ago   running 18 minutes ago   
3a6814cddfe9   tastile-dev-api        tastile-core-dev:la…   1 hour ago       running 1 hour ago       127.0.0.1:31400->31400/tcp
cb2501ef0322   tastile-android-dev    tastile-android-dev…   5 hours ago      running 5 hours ago      127.0.0.1:5037->5037/tcp
```

## Bring up v1 stack (postgres + api + worker)

==> Preflight: checking 127.0.0.1:31400 ...
ERROR: port 31400 is already in use on 127.0.0.1
         TCP         127.0.0.1:31400        0.0.0.0:0              LISTENING
