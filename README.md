# ✂️ Chop-It-Up — Deployment Guide

Chop-It-Up v15 | 60 screens | Barbershop Management Platform

---

## 📁 Project Structure

```
chop-it-up/
├── Dockerfile          ← Docker build instructions for Back4App
├── .dockerignore       ← Files excluded from Docker image
├── .gitignore
├── package.json        ← Dependencies (React 18 + Vite)
├── vite.config.js      ← Build config
├── index.html          ← HTML entry point
├── src/
│   ├── main.jsx        ← React root mount
│   └── App.jsx         ← ← PASTE chop-it-up-v15.jsx HERE (rename to App.jsx)
└── README.md
```

---

## 🚀 Deploy to Back4App Containers

### Step 1 — Set up local project

```bash
# Clone or create the project folder
mkdir chop-it-up && cd chop-it-up

# Copy all these files in, then:
cp /path/to/chop-it-up-v15.jsx src/App.jsx

# Install dependencies
npm install

# Test the build locally
npm run build
npm run preview   # visit http://localhost:3000
```

### Step 2 — Test with Docker locally (optional but recommended)

```bash
# Build the Docker image
docker build -t chop-it-up .

# Run it
docker run -p 3000:3000 chop-it-up

# Visit http://localhost:3000
```

### Step 3 — Push to GitHub

```bash
git init
git add .
git commit -m "Chop-It-Up v15 initial deploy"
git remote add origin https://github.com/YOUR_USERNAME/chop-it-up.git
git push -u origin main
```

### Step 4 — Deploy on Back4App Containers

1. Go to [back4app.com](https://back4app.com) → **Build new app**
2. Select **Containers as a Service**
3. Connect your GitHub account if not already done
4. Select the **chop-it-up** repository
5. Configure deployment:
   - **Port:** `3000`
   - **Dockerfile path:** `./Dockerfile` (default)
   - **Branch:** `main`
   - **Auto-deploy:** Enable (redeploys on every push)
6. Click **Create App**

Back4App will pull your code, build the Docker image, and deploy. Takes ~3–5 minutes on first deploy.

---

## 📱 Publishing to App Store & Google Play

Since this is a React web app, you have two main paths:

### Option A — Progressive Web App (PWA) — Easiest
Add a `manifest.json` and service worker so users can "Add to Home Screen".
Works on both iOS and Android without going through app stores.

### Option B — Capacitor (Recommended for App Store)
Wrap the web app in a native shell:

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npx cap init "Chop-It-Up" "com.ferd.chopitup"
npm run build
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios      # Opens Xcode → submit to App Store
npx cap open android  # Opens Android Studio → submit to Play Store
```

### Option C — React Native rewrite
Full native performance, but requires rewriting components.
Not needed given the app already performs well.

---

## ⚙️ Environment Variables

If you add real Stripe or other API keys later, set them in Back4App:
- Dashboard → Your App → **Settings → Environment Variables**

```
VITE_STRIPE_PUBLIC_KEY=pk_live_...
VITE_APP_URL=https://your-app.b4a.app
```

Access in code: `import.meta.env.VITE_STRIPE_PUBLIC_KEY`

---

## 🆓 Back4App Free Tier Limits

| Resource | Free Tier |
|---|---|
| RAM | 256 MB |
| Transfer | 100 GB/month |
| CPU | Shared |
| Custom domain | ✅ Yes |
| SSL | ✅ Auto |
| Sleep on inactivity | ❌ Always on |

Upgrade to Shared Plan ($5/mo) for 512 MB RAM if needed.

---

## 🌐 Custom Domain

1. Back4App Dashboard → App → **Settings → Domains**
2. Add your domain (e.g. `app.chopitup.com`)
3. Add a CNAME record with your DNS provider pointing to the Back4App URL
4. SSL is provisioned automatically
