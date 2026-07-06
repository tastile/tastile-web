#!/bin/bash
set -euo pipefail

cd /etc/nginx/tastile-tls

# Backup old cert
cp selfsigned.crt selfsigned.crt.bak
cp selfsigned.key selfsigned.key.bak

# Generate new cert with correct SAN
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout selfsigned.key \
  -out selfsigned.crt \
  -subj "/CN=tastile.app" \
  -addext "subjectAltName=DNS:tastile.app,DNS:app.tastile.app,DNS:api.tastile.app" 2>&1

# Verify
openssl x509 -in selfsigned.crt -noout -subject -dates -text 2>&1 | grep -E "Subject:|Not Before|Not After|DNS:"

# Reload nginx
nginx -t 2>&1 && systemctl reload nginx 2>&1
echo "SSL cert regenerated and nginx reloaded"
