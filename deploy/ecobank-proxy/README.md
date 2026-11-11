# Ecobank fixed-IP proxy

Ecobank whitelists the caller's IP. Vercel has no fixed outbound IP, so payment
calls go Vercel -> this proxy (fixed IP) -> Ecobank.

## Setup (Ubuntu/Debian VPS)

```bash
sudo apt install -y caddy
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo mkdir -p /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironment=DOMAIN=%s\nEnvironment=PROXY_KEY=%s\n' \
  "203.0.113.10.sslip.io" "$(openssl rand -hex 24)" \
  | sudo tee /etc/systemd/system/caddy.service.d/env.conf
sudo systemctl daemon-reload && sudo systemctl restart caddy
sudo cat /etc/systemd/system/caddy.service.d/env.conf   # copy PROXY_KEY
```

Open ports 80 and 443 (`sudo ufw allow 80,443/tcp`).

## Vercel env

```env
ECOBANK_BASE_URL=https://203.0.113.10.sslip.io
ECOBANK_PROXY_KEY=<PROXY_KEY from above>
ECOBANK_IP_ADDRESS=203.0.113.10
```

Give Ecobank the VPS IP to whitelist.

## Check

```bash
curl -i https://203.0.113.10.sslip.io/            # 403 Forbidden (no key)
curl -i -H "X-Proxy-Key: <key>" https://203.0.113.10.sslip.io/  # reaches Ecobank
```
