# CreatorPay on Forge: team access guide

CreatorPay for Access Youth Tech Forge 2026 runs on the Forge Kubernetes cluster,
in the `team16` namespace. It is not public. You open it on your own laptop by
forwarding a port from the cluster. You do **not** need the VPS, Docker, Node, or
the source code to use it.

## What you need

| Item | Where it comes from |
| --- | --- |
| `team16.yml` (kubeconfig) | From the team lead, through a password manager. **Never commit it to Git or paste it in chat.** |
| `kubectl` 1.30 or later | Install it in step 1 |
| A terminal | Linux: any terminal. Windows: **Git Bash** |

`team16.yml` only works for the `team16` namespace. Other namespaces return `Forbidden`.

## 1. Install kubectl

### Linux

```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
rm kubectl
kubectl version --client
```

### Windows (Git Bash)

Option A, with winget (Windows 10/11). Run it in PowerShell, then open a new Git Bash window:

```powershell
winget install -e --id Kubernetes.kubectl
```

Option B, with no installer. Run it in Git Bash:

```bash
mkdir -p ~/bin
curl -L -o ~/bin/kubectl.exe "https://dl.k8s.io/release/v1.31.0/bin/windows/amd64/kubectl.exe"
```

Close Git Bash and open it again so `~/bin` is on the PATH. Then check:

```bash
kubectl version --client
```

You should see `Client Version: v1.30` or higher.

## 2. Save the kubeconfig

Put `team16.yml` in your Downloads folder, then run:

### Linux

```bash
mkdir -p ~/forge
mv ~/Downloads/team16.yml ~/forge/
chmod 600 ~/forge/team16.yml
export KUBECONFIG=~/forge/team16.yml
```

### Windows (Git Bash)

```bash
mkdir -p ~/forge
mv ~/Downloads/team16.yml ~/forge/
export KUBECONFIG="$(cygpath -w ~/forge/team16.yml)"
```

`export` lasts for one terminal window. In every new terminal, run the `export`
line again. To make it permanent, add that line to `~/.bashrc`.

## 3. Check the connection

```bash
kubectl get pods
```

Expected: a pod named `app-...` with `READY 1/1` and `STATUS Running`.

| You see | Meaning | Fix |
| --- | --- | --- |
| `Forbidden` | Wrong namespace or wrong file | Check you exported the right `team16.yml` |
| `connection refused` or timeout | Network or VPN blocking | Try another network |
| `The connection to the server localhost:8080 was refused` | `KUBECONFIG` is not set | Run the `export` line again |
| `No resources found` | The app is not deployed | Tell the team lead |

## 4. Open the app

```bash
kubectl port-forward svc/app 3000:80
```

Keep this terminal open. It prints `Forwarding from 127.0.0.1:3000 -> 8080`.
Open **http://localhost:3000** in your browser.

If port 3000 is taken, use another one, for example `kubectl port-forward svc/app 3100:80`,
and open `http://localhost:3100`.

Press `Ctrl+C` to stop. If the terminal shows `lost connection to pod`, run the
command again. After the team lead deploys a new version, restart it too.

You are on the same database as the rest of the team. What you create, they see.

## 5. Try the full demo flow

You need two accounts: a brand and a creator. Use two different browsers, or one
normal window and one private window, so the sessions don't clash.

1. **Brand.** Register as **Business**. Give it a workspace name.
2. **Brand.** Create a campaign (**Campaigns, then New**). Set an objective, a destination URL, a budget, and one reward rule, for example `Signup`, event type `REGISTRATION`, ₦1,500.
3. **Brand.** Publish the campaign. Open its **Funding** tab and use **Simulate** to post a deposit, for example ₦100,000.
4. **Creator.** In the other window, register as **Creator**.
5. **Creator.** Open **Profile, then Bank details**. Choose **Guaranty Trust Bank** and enter account `0123987001`. Enter the name `CHUKWUEMEKA IFEANYI NWOSU` and tick the confirmation. The bank checks the account and the page shows it as verified.
6. **Brand.** Open the campaign's **Participants** tab. Invite the creator by their email and copy the invite link.
7. **Creator.** Open the invite link and accept.
8. **Creator.** Open the campaign and copy your tracking link. Open it once in a normal browser tab. Command-line tools like `curl` count as bots and are ignored.
9. **Brand.** Open the campaign's **Events** tab and choose **Record event manually**. Pick the creator's link, set an event ID (any unique text), and save. A valid click makes it **Eligible**.
10. **Brand.** Open the **Rewards** tab. Click **Calculate rewards**, then **Approve**, then **Mark payable**.
11. **Brand.** Click **Pay out** on that reward. The status is `PENDING`, then `SETTLED` within about 30 seconds, and it refreshes by itself. The **Payments** page has a "Status refreshed" button if you want it sooner.

## 6. Sandbox bank test data

The bank is a simulation. All data is synthetic, so never use a real name, BVN,
or account number.

Payout destinations that work:

| Account | Holder | Bank | Bank code to pick |
| --- | --- | --- | --- |
| `0123987001` | Chukwuemeka Ifeanyi Nwosu | GTBank | Guaranty Trust Bank |
| `0123987002` | Funmilayo Abiola Ogunleye | Zenith | Zenith Bank |
| `0123987003` | Zainab Halima Yusuf | First Bank | First Bank of Nigeria |
| `0123987004` | Tamunotonye Briggs | UBA | United Bank for Africa |
| `0987654321` | Ngozi Adaobi Eze | Xtradot (Access stand-in) | Access Bank |
| `8031234506` | Ifeoluwa Grace Adebayo | OPay | OPay |
| `8051234507` | Iya Bisi Foods Enterprises | Moniepoint | Moniepoint |

Accounts that fail on purpose, to demo error handling:

| Account | Result |
| --- | --- |
| `0123987099` (GTBank) | Can't receive: account is restricted |
| `0123987098` (Wema) | Can't receive: account is frozen |
| `0987654399` (Access) | Can't receive: account is dormant |
| `0000000001` | Account not found |

Amount tricks. The last two decimal digits of the payout amount decide the outcome (for example ₦1,500.02):

| Amount ends with | Result |
| --- | --- |
| `.01` | Insufficient funds |
| `.02` | Timeout, then failed and reversed after 30 s (the app does **not** resend) |
| `.03` | Stays pending for 2 minutes, then succeeds |
| `.00` | Always normal |

The payout account that is debited is `0123456793` (a team-owned corporate
account, ₦12,000,000 at the start). Sandbox data lives in memory, so a platform
restart resets balances.

## 7. Watch what the app does

Open a second terminal (with `KUBECONFIG` set) and run:

```bash
kubectl logs deploy/app -f                          # live logs, Ctrl+C to stop
kubectl logs deploy/app --tail=100 | grep forge     # only the bank calls
kubectl get pods                                    # is the app healthy
```

A normal payout writes three bank calls: `POST .../name-enquiry`, then
`POST /transfers/interbank`, then `GET /transfers/<reference>`.

## 8. Troubleshooting

| Problem | Fix |
| --- | --- |
| Browser shows "can't connect" | The port-forward is not running. Start it again (step 4). |
| `error: lost connection to pod` | The app restarted. Run the port-forward again. |
| `kubectl: command not found` | Windows: open a new Git Bash window. Linux: redo step 1. |
| Page loads but login fails | Passwords need 8+ characters with a letter and a number. |
| Payout stays `PENDING` over 2 minutes | Check the logs. Amounts ending `.03` wait 2 minutes on purpose. |
| `429` in the logs | The bank allows 60 requests a minute per team. Wait a minute. |
| Bank error `ACCOUNT_NOT_FOUND` | Use an account from section 6. |

## 9. Deploy new code (team lead only)

Only the person who ships code needs the source, Docker and a build machine.
Everyone else skips this section. The current version is **v3**
(`hakisolos/creatorpay:v3`); each release gets a new number (v4, v5, ...).
Never reuse a tag. Reusing one can leave the cluster running the old image.

How it works: you build a Docker image of the app, push it to Docker Hub, and
tell Kubernetes to run the new image. Kubernetes starts a new pod, waits until
it is healthy, then stops the old one.

### One-time setup

- A machine with Docker that builds for `linux/amd64`. The team's VPS (`ssh grey`) does, and builds fast. A Mac with Apple Silicon also works, but it builds through emulation and is slow (5 to 15 minutes).
- Docker Hub login on that machine: `docker login` (username `hakisolos`). The image repository must be **public**, because the cluster has no pull secret.
- `team16.yml` and `kubectl` on your laptop (steps 1 and 2 above).

### Each release

Run these from the project folder on your laptop. Replace `v4` with the next number.

```bash
# 1. Check the code before you ship it
#    (the other tests write to the real Neon database, so run only the safe ones)
npx tsc --noEmit && npx vitest run src/lib/payments/forge-provider.test.ts

# 2. Copy the code to the VPS (secrets and the kubeconfig are excluded)
rsync -az --exclude node_modules --exclude .next --exclude '.env*' \
  --exclude 'team*.yml' --exclude .vercel --exclude .git \
  --exclude docs --exclude ui --exclude src/generated \
  ./ grey:/root/CreatorPay/

# 3. Build and push the image on the VPS (takes about 3 to 5 minutes)
ssh grey 'cd /root/CreatorPay && docker build -f deploy/forge/Dockerfile -t hakisolos/creatorpay:v4 . && docker push hakisolos/creatorpay:v4'

# 4. Roll it out on the cluster
export KUBECONFIG=~/forge/team16.yml
kubectl set image deployment/app app=hakisolos/creatorpay:v4
kubectl rollout status deployment/app

# 5. Check it
kubectl get pods
kubectl logs deploy/app --tail=20
```

Then update the tag in `deploy/forge/app.yaml` (`image: hakisolos/creatorpay:v4`)
so the file matches the cluster.

If you build on your own laptop instead of the VPS, replace steps 2 and 3 with:

```bash
docker build --platform linux/amd64 -f deploy/forge/Dockerfile -t hakisolos/creatorpay:v4 .
docker push hakisolos/creatorpay:v4
```

### After a deploy

- **Restart the port-forward.** The old pod is gone, so everyone's tunnel drops. Run `kubectl port-forward svc/app 3000:80` again.
- **Database changes.** If you changed `prisma/schema.prisma`, create a migration with `npx prisma migrate dev` and apply it to Neon with `npx prisma migrate deploy` from your laptop **before** step 4. It uses `DIRECT_URL` from your local `.env`.
- **Health check.** After restarting the port-forward, open `http://localhost:3000/health/ready`. It should say `"database":"ok"`, which proves the pod reaches Neon.

### Change a secret or env var

The app reads its settings from the Kubernetes secret `app-env`. Change one value, then restart the pod:

```bash
kubectl patch secret app-env -p '{"stringData":{"RECONCILE_INTERVAL_MS":"30000"}}'
kubectl rollout restart deployment/app
```

To list which variables are set (names only, not values):

```bash
kubectl get secret app-env -o json | python3 -c "import sys,json;print('\n'.join(json.load(sys.stdin)['data']))"
```

Variables the app uses: `PAYMENT_PROVIDER` (`forge`), `DATABASE_URL`, `AUTH_SECRET`,
`FORGE_SOURCE_ACCOUNT`, `FORGE_WEBHOOK_SECRET`, `APP_URL`, and optionally
`RECONCILE_INTERVAL_MS` (payout auto-check, default 20000, `0` turns it off).
`GATEWAY_KEY` is added by the cluster, not by you.

### Roll back a bad release

```bash
kubectl rollout undo deployment/app
kubectl rollout status deployment/app
```

This returns to the previous image immediately. Check what is running with
`kubectl get deployment app -o jsonpath='{.spec.template.spec.containers[0].image}'`.

### If the new pod will not start

| Symptom in `kubectl get pods` | Cause | Fix |
| --- | --- | --- |
| `ImagePullBackOff` | Wrong tag, or the Docker Hub repository is private | Check the tag spelling. Make the repository public. |
| `CrashLoopBackOff` | The app exits at start | `kubectl logs deploy/app --previous` and read the last error. Often a missing env var. |
| `exec format error` in logs | Image built for ARM | Rebuild with `--platform linux/amd64`, or build on the VPS. |
| Pod `Pending`, `exceeded quota` | Not enough cluster quota | `kubectl describe resourcequota team-quota`. Delete unused pods. |
| New pod never becomes `1/1` | Failing readiness check | `kubectl describe pod <name>` and `kubectl logs <name>`. |

## 10. Rules

- Do **not** commit `team16.yml`, paste it in chat, or put it in a public repository. If it leaks, tell the organizers straight away so they can replace it.
- Do not probe other teams' namespaces.
- Only one person should deploy new versions, to avoid overwriting each other. Ask the team lead.
- The `https://team16.xtradot.co` address sits behind a Cloudflare login that the organizers control. Until they add your email, use the port-forward.
