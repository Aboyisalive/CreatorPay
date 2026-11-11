# Forge 2026 deployment

CreatorPay runs on the Forge Kubernetes cluster, in the `team16` namespace. The
Xtradot Bank sandbox answers only from inside that namespace, so the app cannot
run on Vercel or the VPS.

Files in this folder:

- `Dockerfile` builds the production image (Next.js standalone, port 8080).
- `app.yaml` is the Kubernetes Deployment and Service. Its `image:` tag must match the release running on the cluster.

For access, the demo flow, and the full deploy, rollback and secrets steps, see
[`docs/TEAM_ACCESS.md`](../../docs/TEAM_ACCESS.md), section 9.

The short version of a release:

```bash
rsync -az --exclude node_modules --exclude .next --exclude '.env*' \
  --exclude 'team*.yml' --exclude .vercel --exclude .git \
  --exclude docs --exclude ui --exclude src/generated \
  ./ grey:/root/CreatorPay/
ssh grey 'cd /root/CreatorPay && docker build -f deploy/forge/Dockerfile -t hakisolos/creatorpay:vN . && docker push hakisolos/creatorpay:vN'
export KUBECONFIG=~/forge/team16.yml
kubectl set image deployment/app app=hakisolos/creatorpay:vN
kubectl rollout status deployment/app
```

Replace `vN` with the next version number, and update `image:` in `app.yaml` to match.
