# 💧 Scent Drip

An online perfume shop that costs **nothing** to run.

- **Shop** (`index.html`): customers browse perfumes, add them to a bag and order (Cash on Delivery).
- **Admin** (`admin.html`): you log in to:
  - add, edit, hide or delete perfumes (with photos)
  - see your **inventory**: stock, the price you **bought** each perfume for, the **selling** price, profit per bottle and total stock value
  - see **orders** as they arrive and move them through *New → Confirmed → Shipped → Delivered* (or *Cancelled*, which puts the bottles back in stock)
- **Order alerts**: an **email** for every new order (Resend), plus a pop-up and sound on the admin page. Telegram is optional.

---

## 🧰 Your tools

| Job | Tool | Cost |
|---|---|---|
| Hosting (the website) | **Cloudflare Pages** | Free |
| Database, admin login | **Supabase** (free plan) | Free |
| Product photos | **Supabase Storage** | Free (1 GB) |
| Order emails | **Resend** (free tier: 3,000 emails/month, 100/day) | Free |
| Payments | **Cash on Delivery** now; **Stripe** or a local gateway later | Free (gateways take ~2–4% per sale) |
| Web address | `scent-drip.pages.dev` | Free |
| Visitor stats | **Cloudflare Web Analytics** | Free |
| Design (photos, posts) | **Canva** / **Figma** free plans | Free |
| Code storage | **GitHub** (this repo) | Free |

```
 Customer ──► scent-drip.pages.dev ──► Supabase ──► Resend ──► 📧 your inbox
              (Cloudflare Pages)       database,
              index.html / admin.html  login, photos
```

**Is it safe that the Supabase key is in the code?** Yes. The *publishable / anon* key is designed to be public. Security comes from rules inside the database (`supabase/schema.sql`):

- Customers can only **see visible perfumes** and **place orders**.
- Customers can never see your cost prices, other people's orders or your email/Resend settings.
- Prices and stock are checked by the database itself, so nobody can change a price in their browser.
- Only accounts you mark as admin can change anything.

---

# 🚀 The launch plan

About **1–2 hours** in total. Do the phases in order and tick them off as you go.

| Phase | What | Time |
|---|---|---|
| 0 | Create your accounts | 10 min |
| 1 | Set up the database (Supabase) | 15 min |
| 2 | Connect the website to the database | 5 min |
| 3 | Put the website live (Cloudflare Pages) | 10 min |
| 4 | Finish the login settings | 5 min |
| 5 | Order emails (Resend) | 10 min |
| 6 | Visitor stats (Cloudflare Web Analytics) | 2 min |
| 7 | Keep the free database awake | 5 min |
| 8 | Product photos and adding perfumes (Canva) | as long as you like |
| 9 | Test everything, then launch 🎉 | 15 min |
| Later | Card payments, your own domain, customer emails | when ready |

---

## Phase 0: Create your accounts

Use the **same email** everywhere if you can. It makes things simpler.

- [ ] **GitHub**: you already have one (this repo is here).
- [ ] **Supabase**: https://supabase.com → *Start your project* → sign in **with GitHub**.
- [ ] **Cloudflare**: https://dash.cloudflare.com/sign-up → confirm your email.
- [ ] **Resend**: https://resend.com/signup. ⚠️ The email you sign up with is where your order emails will go (see Phase 5).
- [ ] **Canva**: https://canva.com (free). Figma (https://figma.com) is optional.

> 🔐 Turn on **2-factor authentication** (2FA) for GitHub, Supabase and Cloudflare. It's in each one's account or security settings.

---

## Phase 1: Set up the database (Supabase)

1. In Supabase click **New project**:
   - **Name:** `scent-drip`
   - **Database password:** click *Generate*, then save it in a password manager or notes app.
   - **Region:** choose the one closest to your customers.
   - Leave **Data API** turned **on** (the default).
   - Click **Create new project** and wait about 2 minutes.
2. In the left menu open **SQL Editor** → **New query**.
3. Open [`supabase/schema.sql`](supabase/schema.sql) in this repo. Click the **Copy raw file** button (📋), paste it into Supabase and click **Run**.
   You should see *"Success. No rows returned."* ✅
4. **Create your admin login:** go to **Authentication** → **Users** → **Add user** → **Create new user**.
   Enter your email and a **strong** password, and tick **Auto Confirm User**.
5. **Make that login an admin:** in **SQL Editor** → **New query**, paste this with **your** email and click **Run**:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
6. **Block strangers from signing up:** go to **Authentication** → **Sign In / Providers** and turn **OFF**
   *"Allow new users to sign up"*. Click **Save**.

---

## Phase 2: Connect the website to the database

1. In Supabase click **Project Settings** (⚙️ gear, bottom left).
   - Under **Data API** (or **API**), copy the **Project URL**. It looks like `https://abcdxyz.supabase.co`.
   - Under **API Keys**, copy the **Publishable key** (starts with `sb_publishable_…`). Older projects call it the **anon public** key (starts with `eyJ…`).
   - ⚠️ **Never** copy the `secret` / `service_role` key anywhere.
2. On GitHub, open this repo → `js/config.js` → click the ✏️ **pencil** (Edit this file).
3. Paste your values between the quotes:
   ```js
   SUPABASE_URL: "https://abcdxyz.supabase.co",
   SUPABASE_KEY: "sb_publishable_xxxxxxxxxxxxxxxx",
   CURRENCY: "LKR",              // your currency: LKR, INR, PKR, AED, USD, GBP …
   WHATSAPP_NUMBER: "94771234567", // optional, digits only with country code ("" to hide)
   ```
4. Click **Commit changes…** → **Commit changes**.

---

## Phase 3: Put the website live (Cloudflare Pages)

1. Go to https://dash.cloudflare.com → left menu **Workers & Pages** (it may be under **Compute**) → **Create application**.
2. Choose the **Pages** tab (or click *"Looking to deploy Pages? Get started"*) → **Import an existing Git repository** → **Get started**.
3. **Connect GitHub**, then allow Cloudflare access to the **Scent-Drip** repo. Select it → **Begin setup**.
4. Fill in the settings:

   | Setting | Value |
   |---|---|
   | Project name | `scent-drip` (this becomes **scent-drip.pages.dev**; if it's taken, try `scentdrip` or `scent-drip-store`) |
   | Production branch | `main`, or the branch that has this code |
   | Framework preset | **None** |
   | Build command | *leave empty* (if Cloudflare insists, type `exit 0`) |
   | Build output directory | `/` |

5. Click **Save and Deploy**. Wait about 1 minute and you'll see **Success** ✅.
6. Open **https://scent-drip.pages.dev** 🎉 Your admin page is **https://scent-drip.pages.dev/admin**. Bookmark it on your phone too.

> ✨ From now on, **every change you commit to GitHub goes live automatically** within about a minute.

---

## Phase 4: Finish the login settings

In Supabase go to **Authentication** → **URL Configuration**:
- **Site URL:** `https://scent-drip.pages.dev` (your real address) → **Save**.

Then open `/admin` on your live site and **log in** with the email and password from Phase 1.
You should see the **Orders** and **Inventory** tabs. If it says *"This account is not an admin"*, redo Phase 1, step 5.

---

## Phase 5: Order emails (Resend) 📧

1. In Resend go to **API Keys** → **Create API Key**:
   - Name: `scent-drip`
   - Permission: **Sending access**
   - Click **Add** and **copy the key** (starts with `re_…`). Resend only shows it once.
2. In Supabase **SQL Editor** → **New query**, paste this with **your** values and click **Run**:
   ```sql
   update public.app_settings set
     resend_api_key = 're_xxxxxxxxxxxxxxxxxxxx',
     notify_email   = 'the-email-you-signed-up-to-resend-with@gmail.com',
     shop_url       = 'https://scent-drip.pages.dev',
     currency       = 'LKR'
   where id = 1;
   ```
3. Place a test order on your shop. An email should arrive within a few seconds (check **Spam** the first time and mark it "Not spam").

> ⚠️ **Important Resend rule:** until you own a domain (see *Later*), Resend only lets you send **to the email address you signed up with**. That's fine for order alerts to yourself. Emailing **customers** a confirmation needs your own domain.

<details>
<summary>Optional: also get orders on Telegram</summary>

1. In Telegram, message **@BotFather** → `/newbot` → follow the steps → copy the **token**.
2. Open your new bot and press **Start** (required).
3. Message **@userinfobot** → copy your **Id** number.
4. In Supabase SQL Editor run:
   ```sql
   update public.app_settings set telegram_bot_token = '123:ABC...', telegram_chat_id = '123456789' where id = 1;
   ```
</details>

---

## Phase 6: Visitor stats (Cloudflare Web Analytics) 📊

1. Cloudflare dashboard → **Workers & Pages** → click your **scent-drip** project.
2. Open the **Metrics** tab → **Web Analytics** → **Enable**.
3. That's it. No code needed. After your next deploy you'll see visitors, top pages, countries and devices.

> Prefer **Cloudflare Web Analytics** over Google Analytics: it's free, simple, and doesn't use cookies, so you don't need a cookie-consent pop-up. If you later want Google Analytics, ask for it to be added (it needs a code snippet and a cookie notice).

---

## Phase 7: Keep the free database awake 😴

Supabase **pauses free projects after about 7 days without activity**. This repo has a small automatic job that visits your database twice a week:

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Add two:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_KEY` = your publishable / anon key
2. Go to the **Actions** tab. If asked, click **"I understand my workflows, go ahead and enable them"**.
   Then **Keep database awake** → **Run workflow**. A green tick ✅ means it works.

If the project ever gets paused anyway, open the Supabase dashboard and click **Restore project**. Nothing is lost.

---

## Phase 8: Product photos and adding perfumes 📸

**Make the photos (Canva):**
1. In Canva → **Create a design** → **Custom size** → **1080 × 1080 px** (square, which matches the shop cards).
2. Use the **same style for every perfume** so the shop looks premium. A **black background** suits the neon theme. Use Canva's **Background Remover** on your bottle photo, then place it in the centre.
3. Tip: make one design, then **duplicate the page** for each perfume and just swap the bottle and the name.
4. **Download** → **JPG**, quality about 80%. Keep each file **under 1 MB** (the limit is 5 MB, but smaller loads faster). https://squoosh.app can shrink files for free.

**Add them to the shop:**
1. Open **/admin** → **Inventory** → **＋ Add perfume**.
2. Fill in name, brand, category (Men / Women / Unisex), size, **price you bought it for**, **selling price**, stock, description and photo → **Save**.
3. Use the **Visible** tick-box to hide a perfume without deleting it.

**Also make in Canva:** Instagram posts and stories announcing your launch, and a WhatsApp Status image with your shop link.

---

## Phase 9: Test everything, then launch 🎉

Do this on **your phone** *and* a computer:

- [ ] The shop opens at `https://scent-drip.pages.dev` and shows your perfumes with photos.
- [ ] Search and the Men / Women / Unisex filters work.
- [ ] Add a perfume to the bag → Checkout → place a **test order** with your own details.
- [ ] You get the **order email** (Phase 5).
- [ ] The order appears in **/admin → Orders**, and the perfume's **stock went down** by 1.
- [ ] Set the test order to **Cancelled** → the stock goes back up.
- [ ] Untick **Visible** on a perfume → it disappears from the shop. Tick it again.
- [ ] Open `/admin` in a private/incognito window → it asks for a login.
- [ ] **Delete test orders** before launching: Supabase → **Table Editor** → `orders` → select the test rows → **Delete**.
- [ ] Share your link! Instagram bio, TikTok, WhatsApp Status, friends and family 🚀

---

## Later: when you're ready

### 💳 Card payments (Stripe or a local gateway)
- **Start with Cash on Delivery.** It's free, needs no paperwork, and customers trust it.
- Add card payments once you have regular orders. Every gateway charges about **2–4% per sale** (no monthly fee) and needs **ID and/or business verification**:
  - **Stripe** (most countries) · **PayHere** (Sri Lanka) · **Razorpay** (India) · **Safepay** (Pakistan) · **Paystack / Flutterwave** (Africa)
  - ⚠️ **Check that your country is supported.** Stripe is **not** available for businesses in some countries (for example Sri Lanka and Pakistan), so use the local gateway there.
- Card payments need a small piece of server code (a Supabase Edge Function) plus a "payment received" check. When you've opened your gateway account, ask for this to be added. Never put a gateway's **secret** key in this repo.

### 🌐 Your own domain (`scentdrip.com`)
- Costs about **$10–15/year**. **Cloudflare Registrar** sells domains at cost.
- Connect it: Cloudflare → your Pages project → **Custom domains** → **Set up a domain**.
- Then update **Supabase → Authentication → URL Configuration → Site URL**, and `shop_url` in `app_settings`.

### ✉️ Confirmation emails to customers
Once you own a domain:
1. Resend → **Domains** → **Add domain** → follow the DNS steps (one click if the domain is on Cloudflare).
2. In Supabase SQL Editor run:
   ```sql
   update public.app_settings set
     email_from = 'Scent Drip <orders@scentdrip.com>',
     customer_emails_enabled = true
   where id = 1;
   ```
Customers who enter an email at checkout will then get an order confirmation automatically.

---

## 🧴 Day to day

| I want to… | Do this |
|---|---|
| Add a perfume | /admin → **Inventory** → **＋ Add perfume** |
| Change price or stock | Inventory → **Edit** |
| Hide a perfume for now | Untick **Visible** |
| Remove a perfume for good | Inventory → **Delete** (past orders keep their history) |
| Handle a new order | 📧 email arrives → call or WhatsApp the customer → set **Confirmed** → **Shipped** → **Delivered** |
| Cancel an order | Set it to **Cancelled** (stock goes back automatically) |
| See profit | **Orders** tab (sales and profit) · **Inventory** tab (profit per bottle, stock value) |
| See visitors | Cloudflare → your Pages project → **Metrics** |

---

## ✅ Other things to consider

- **Policies:** add simple **Returns / Refunds**, **Delivery** (areas, fees, timing) and **Privacy** (what you do with phone numbers and addresses) information. You could ask for a "Policies" page to be added to the site.
- **Business registration:** check what your country requires to sell online. Payment gateways will ask for it.
- **Shipping perfume:** it's flammable (alcohol based), so many couriers restrict it, especially by air. Confirm with your courier.
- **Authenticity:** only sell genuine products, and don't use brands' logos or official ad photos without permission.
- **Backups:** the free Supabase plan has no automatic backups. About once a month: **Table Editor** → `orders`, `order_items`, `perfumes`, `perfume_costs` → **Export → CSV**.
- **Security:** strong unique passwords and 2FA everywhere. Keep sign-ups **off** (Phase 1). Never paste `secret` / `service_role` / `re_…` / Stripe secret keys into this repo. The Resend key lives only inside the database.
- **Free plan limits** (plenty for a starting shop): Supabase 500 MB database, 1 GB photos, 50,000 monthly users · Resend 100 emails/day · Cloudflare Pages unlimited visitors.

---

## 🛟 Troubleshooting

| Problem | Fix |
|---|---|
| The site shows "Almost there! 👋" | `js/config.js` still has the placeholder text. Redo Phase 2. |
| "This account is not an admin" | Run Phase 1, step 5 with the **exact** email you log in with. |
| "Login failed: Invalid login credentials" | Wrong password. Reset it in Supabase → Authentication → Users → ⋯ → **Send password recovery**, or create the user again. |
| Shop says "Couldn't load the drip" | The Supabase project may be **paused**. Open the Supabase dashboard → **Restore project**. |
| No order email | 1) Check Spam. 2) `notify_email` must be the email you signed up to Resend with. 3) Run `select status_code, content from net._http_response order by created desc limit 5;` in the SQL Editor to see Resend's reply. 4) Resend → **Logs**. |
| Photo upload fails | The photo must be under 5 MB. Check that you ran the whole `schema.sql` (it creates the `perfume-images` storage). |
| My change on GitHub isn't showing | Wait 1–2 minutes and hard-refresh (pull down on your phone, or Ctrl+Shift+R). Check Cloudflare → your project → **Deployments**. |

---

## 📁 What's in this repo

```
index.html              Customer shop
admin.html              Admin dashboard
css/style.css           Look and feel (black, white & neon theme)
images/                 Logo, favicon
js/config.js            ← your settings (the only code file you need to edit)
js/common.js            Shared helpers
js/shop.js              Shop: list, bag, checkout
js/admin.js             Admin: login, orders, inventory
supabase/schema.sql     Database tables, security rules, ordering, email alerts
_headers                Security settings for Cloudflare Pages
robots.txt              Keeps the admin page out of Google
.github/workflows/keep-alive.yml   Keeps the free database awake
```

**Customising:** the neon colour is `--neon` at the top of `css/style.css`. Try `#39ff14` (green), `#00f0ff` (cyan) or `#ff2bd6` (pink). The headline and scrolling ticker text are in `index.html`.
