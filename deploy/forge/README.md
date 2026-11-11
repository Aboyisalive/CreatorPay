# Forge 2026 deployment (Xtradot Bank sandbox)

The sandbox bank API only answers from inside the team's Kubernetes namespace,
so the app must run on the Forge cluster (not Vercel). Public URL:
`https://teamXX.xtradot.co`. Source: `docs/Forge_2026_Sandbox_Participant_Platform_Guide.pdf`.

```bash
export KUBECONFIG=~/forge/teamXX.yaml
kubectl get pods

# secrets the app needs (never commit these)
kubectl create secret generic app-env \
  --from-literal=PAYMENT_PROVIDER=forge \
  --from-literal=DATABASE_URL='<neon pooled url>' \
  --from-literal=AUTH_SECRET="$(openssl rand -base64 48)" \
  --from-literal=FORGE_SOURCE_ACCOUNT=0123456793 \
  --from-literal=FORGE_WEBHOOK_SECRET='<from POST /webhooks>'

# build for the cluster (linux/amd64) and push
docker build --platform linux/amd64 -f deploy/forge/Dockerfile -t <registry>/creatorpay:v1 .
docker push <registry>/creatorpay:v1

# deploy (edit image in app.yaml first)
kubectl apply -f deploy/forge/app.yaml
kubectl rollout status deployment/app
curl -I https://teamXX.xtradot.co/health/live
curl -s https://teamXX.xtradot.co/health/ready   # confirms Neon is reachable
```

Database migrations run from your laptop against Neon:
`npx prisma migrate deploy` (uses `DIRECT_URL`).
