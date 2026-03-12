# Deploy in 3 Steps (~10 min)

Repo is live: https://github.com/OchubaEkene/socio

---

## Step 1 — Database (Neon, 2 min)
1. Go to https://neon.tech → Sign up → New Project → name it "socio"
2. Copy the connection string — looks like:
   `postgresql://neondb_owner:xxx@ep-xxx.aws.neon.tech/neondb?sslmode=require`

---

## Step 2 — Backend (Railway, 4 min)
```bash
cd /Users/ekeneochuba/pprojects/socio/backend
railway login
railway init          # create new project called "socio-backend"
railway up            # deploys from current directory
```

Then set env vars (replace values):
```bash
railway variables set DATABASE_URL="postgresql://..." \
  JWT_SECRET="FnZ/LGOopG9Fw7eg6nQcieMof9MlOPTC4Rgqs8j7vlc=" \
  NODE_ENV="production" \
  TZ="UTC" \
  PORT="5001" \
  FRONTEND_URL="https://socio.vercel.app"
```

Run migrations:
```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

Get your backend URL:
```bash
railway open   # opens dashboard — copy the public URL
```

---

## Step 3 — Frontend (Vercel, 2 min)
```bash
cd /Users/ekeneochuba/pprojects/socio/frontend
vercel login
vercel --prod
```
When prompted:
- Root directory: `./` (already in frontend/)
- Framework: Vite
- Build command: `npm run build`
- Output dir: `dist`

Then add the API URL:
```bash
vercel env add VITE_API_URL production
# enter: https://YOUR-RAILWAY-URL.up.railway.app/api
vercel --prod   # redeploy with the env var
```

---

## Step 4 — Create First Admin (30 sec)
```bash
# Register via the app UI as "manager"
# Then promote to admin:
DATABASE_URL="postgresql://..." node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.user.update({where:{email:'YOUR_EMAIL'},data:{role:'admin'}})
  .then(u=>{console.log('Admin created:',u.email);p.\$disconnect()})
"
```

---

✅ That's it — live at your Vercel URL.
