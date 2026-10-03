# 💧 Scent Drip

An online perfume shop that costs **nothing** to run.

- **Shop** (`index.html`): customers browse perfumes, add them to a cart and order (Cash on Delivery).
- **Admin** (`admin.html`): you log in to:
  - add, edit, hide or delete perfumes (with photos)
  - see your **inventory**: stock, the price you **bought** each perfume for, the **selling** price, profit per bottle and total stock value
  - see **orders** as they arrive and move them through *New → Confirmed → Shipped → Delivered* (or *Cancelled*, which puts the bottles back in stock)
- **Order alerts**: a Telegram message on your phone for every new order, plus a pop-up and sound on the admin page.

---

## How it fits together

```
 Customer's browser ──►  Website (GitHub Pages, free)  ──►  Database (Supabase, free)
                          index.html  / admin.html            perfumes, costs, orders,
                                                              photos, admin login
                                                                    │
                                                                    └──► Telegram alert to your phone 📱
```

| Piece | Service | Cost |
|---|---|---|
| Website hosting | **GitHub Pages** | Free |
| Database, admin login, photo storage | **Supabase** (free plan) | Free |
| New-order alerts | **Telegram** bot | Free |
| Payments | Cash on Delivery to start | Free (see [Payments](#-payments)) |
| Web address | `yourname.github.io/Scent-Drip` | Free (a custom `.com` costs about $10/year, optional) |

**Is it safe that the Supabase key is in the code?** Yes. The *publishable / anon* key is designed to be public. Security comes from rules inside the database (`supabase/schema.sql`):

- Customers can only **see visible perfumes** and **place orders**.
- Customers can **never** see your cost prices, other people's orders or your settings.
- Prices and stock are checked by the database itself, so nobody can change a price in their browser.
- Only accounts you add as admins can change anything.

---

## 🚀 Setup (about 30 minutes, no coding)

### Step 1: Create the database (Supabase)

1. Go to **https://supabase.com** → **Start your project** → sign up (you can use your GitHub account).
2. Click **New project**:
   - Name: `scent-drip`
   - Database password: click **Generate** and save it somewhere safe
   - Region: choose the one closest to your customers
   - Plan: **Free**
3. Wait about 2 minutes for it to finish setting up.
4. In the left menu open **SQL Editor** → **New query**.
5. Open the file [`supabase/schema.sql`](supabase/schema.sql) in this repo, copy **all** of it, paste it in and click **Run**.
   You should see *"Success. No rows returned."*

### Step 2: Connect the website to the database

1. In Supabase go to **Project Settings** (⚙️ gear icon) → **API Keys** (or **API**).
2. Copy:
   - the **Project URL** (looks like `https://abcdxyz.supabase.co`; it is also shown under **Project Settings → Data API**)
   - the **Publishable key** (starts with `sb_publishable_…`), or the older **anon public** key (a long text starting with `eyJ…`)
   - ⚠️ **Never** use the `secret` or `service_role` key.
3. On GitHub, open this repo → `js/config.js` → click the ✏️ pencil (Edit).
4. Replace `PASTE_YOUR_SUPABASE_PROJECT_URL_HERE` and `PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE` with your values (keep the quotes).
5. Change `CURRENCY` to your currency (for example `"LKR"`, `"INR"`, `"PKR"`, `"AED"`, `"USD"`).
6. Optional: put your WhatsApp number in `WHATSAPP_NUMBER` (digits only with country code, e.g. `"94771234567"`).
7. Click **Commit changes**.

### Step 3: Create your admin login

1. In Supabase go to **Authentication** → **Users** → **Add user** → **Create new user**.
   Enter your email and a strong password, and tick **Auto Confirm User**.
2. Go to **SQL Editor** → **New query**, paste this (with **your** email), and click **Run**:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
3. **Important:** stop strangers from creating accounts. Go to **Authentication** → **Sign In / Providers**
   (or **Providers → Email**) and turn **OFF** "Allow new users to sign up". Click **Save**.

### Step 4: Put the website live (GitHub Pages)

1. On GitHub open this repo → **Settings** → **Pages**.
2. Under **Build and deployment**: Source = **Deploy from a branch**; Branch = the branch with this code (normally `main`), folder `/ (root)` → **Save**.
3. After 1–2 minutes your shop is live at **`https://<your-github-username>.github.io/Scent-Drip/`**
   and your admin page is at **`…/Scent-Drip/admin.html`**. Bookmark it.

> GitHub Pages is free for **public** repos. If you want to keep the repo **private**, use **Netlify** or **Cloudflare Pages** instead. Both are free: sign up with GitHub → "Import from Git" → choose this repo → leave the build command **empty** and set the publish directory to `/` → Deploy.

### Step 5: Get a Telegram message for every new order 📱

1. Install **Telegram** on your phone. Search for **@BotFather** → send `/newbot` → choose a name, e.g. `Scent Drip Orders`.
   BotFather replies with a **token** like `7123456789:AAH...`. Copy it.
2. Open your new bot (BotFather gives you a link) and press **Start** / send it any message. **This step is required.**
3. Search for **@userinfobot** → press Start → it replies with your **Id** (a number like `123456789`).
4. In Supabase **SQL Editor**, run (with your values):
   ```sql
   update public.app_settings
   set telegram_bot_token = '7123456789:AAH...your token...',
       telegram_chat_id   = '123456789'
   where id = 1;
   ```
5. Place a test order on your shop. You should get a message within seconds.

(You will also get a pop-up and a sound on the admin page while it is open: click **🔔 Enable pop-up alerts** once.)

### Step 6: Keep the free database awake

Supabase **pauses free projects after about 7 days without activity**. This repo has a small automatic job that visits your database twice a week so that doesn't happen:

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Add `SUPABASE_URL` = your Project URL, and `SUPABASE_KEY` = your publishable/anon key.
3. Go to the **Actions** tab → **Keep database awake** → **Run workflow** to test it. You should get a green tick ✅.

If the project ever does get paused, open your Supabase dashboard and click **Restore project**. Nothing is lost.

---

## 🧴 Using your shop day to day

| I want to… | Do this |
|---|---|
| Add a perfume | Admin → **Inventory** → **＋ Add perfume**. Fill in the price you bought it for, the selling price, the stock and a photo. |
| Change price / stock | Inventory → **Edit** |
| Temporarily remove a perfume | Untick **Visible**. It's hidden from customers but kept in your records. |
| Remove a perfume for good | Inventory → **Delete** (past orders keep their history) |
| Handle a new order | Orders tab → call or WhatsApp the customer → set status **Confirmed** → **Shipped** → **Delivered** |
| Cancel an order | Set status **Cancelled**. The bottles go back into stock automatically. |
| See profit | Orders tab shows sales and profit. Inventory shows profit per bottle and the value of your stock. |

Stock goes down **automatically** when a customer orders, and customers can't order more than you have.

---

## ✅ Other things to consider

### 💳 Payments
- **Start with Cash on Delivery (built in).** No fees, no paperwork, and customers trust it.
- **Bank transfer / mobile wallet:** you can ask customers to pay by transfer when you call to confirm.
- **Card payments online:** there is **no free gateway**. All charge a fee per sale (about 2–4%) but no monthly fee, and most need business or ID verification. Pick one that works in your country:
  - **Stripe** (most countries, easiest to add), **PayPal**
  - **PayHere** (Sri Lanka), **Razorpay** (India), **Safepay** (Pakistan), **Paystack / Flutterwave** (Africa)
  - Adding one needs a small server function. Ask for this as a next step when you're ready.

### 🌐 Domain name
The free address `yourname.github.io/Scent-Drip` works fine. A custom domain like `scentdrip.com` costs about $10–15/year (Cloudflare Registrar or Namecheap) and can be connected under **Settings → Pages → Custom domain**.

### 📜 Legal and trust
- Add simple **Returns / Refund**, **Delivery** and **Privacy** policies: what you do with customers' phone numbers and addresses.
- Check whether your country needs a **business registration** to sell online. Payment gateways will ask for it.
- **Shipping perfume:** perfume is flammable (alcohol based), so some couriers and airmail restrict it. Check with your courier, especially for international orders.
- Only sell authentic products, and don't use other brands' logos or official photos without permission.

### 🔐 Security
- Use a strong, unique password for Supabase, GitHub and your admin login, and turn on 2-factor login for GitHub and Supabase.
- Keep "Allow new users to sign up" **OFF** (Step 3).
- Never put the `service_role` / `secret` key anywhere in this repo.

### 💾 Backups
The free Supabase plan doesn't include automatic backups. About once a month go to **Table Editor** → `orders` (and `perfumes`, `perfume_costs`) → **Export → CSV** and keep the files.

### 📈 Free plan limits (plenty for a starting shop)
- Supabase free: 500 MB database (tens of thousands of orders), 1 GB photo storage, 50,000 monthly users.
- GitHub Pages: 100 GB bandwidth per month.
- Tip: resize photos to about 1000×1000 px before uploading so the shop loads fast.

### 📣 Growing
- Share your shop link on Instagram, TikTok and WhatsApp Status. Add it to your Instagram bio.
- Create a free **Google Business Profile** so people can find you on Google.

---

## 📁 What's in this repo

```
index.html              Customer shop
admin.html              Your admin dashboard
css/style.css           Look and feel (black, white & neon theme)
images/                 Logo, favicon
js/config.js            ← your settings (the only file you need to edit)
js/common.js            Shared helpers
js/shop.js              Shop logic: list, cart, checkout
js/admin.js             Admin logic: login, orders, inventory
supabase/schema.sql     Database tables, security rules, order and alert logic
.github/workflows/keep-alive.yml   Keeps the free database awake
```

**Customising:** the neon colour is `--neon` at the top of `css/style.css`. Try `#39ff14` (green), `#00f0ff` (cyan) or `#ff2bd6` (pink). To change the headline or the scrolling ticker text, edit `index.html`. Your logo files are in `images/`.
