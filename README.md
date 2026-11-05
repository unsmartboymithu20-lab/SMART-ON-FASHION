# SMART FASHION — Full E-commerce Store (Bangladesh)

A responsive Bengali/English fashion storefront with an app-style glass UI, PostgreSQL backend and protected admin dashboard.

## Included features

### Customer storefront
- Responsive desktop, tablet and mobile layout with sticky glass header and fixed bottom app navigation.
- Dynamic product categories (new categories appear when products are assigned to them), live search, featured products and stock display.
- Product cards, wishlist saved in the visitor's browser, cart saved in the browser and checkout.
- Cash on Delivery plus bKash/Nagad manual-contact payment selections.
- Coupon validation and discount calculation at checkout.
- Order tracking using order ID + the phone number entered at checkout.
- Customer reviews (admin approval required), contact form and newsletter signup.
- Delivery, return/exchange and privacy policy information.

### Admin dashboard (`/admin`)
- Secure email/password login with hashed password and session-based authentication.
- Overview: product count, order count, non-cancelled revenue and pending orders.
- Product create/edit/delete, category, price, stock, image URL, featured and visibility controls.
- Order list and status management. Cancelling an order restores its reserved stock; cancelled orders cannot be reopened.
- Coupon creation/deletion with percentage/fixed discount, minimum order, usage limit and expiry.
- Review moderation (approve/hide/delete), customer messages and newsletter subscribers.
- Store settings: store name, delivery fee, announcement, phone/address, hero text/image, promo text and social/contact URLs.

### Starter catalogue
- 20 sample products are inserted only when the products table is empty. Replace sample names, prices and images with your own catalogue from Admin → Products.

## Deploy on GitHub + Render

1. Extract this ZIP. Upload the **contents of the `smart-fashion` folder** to the root of a GitHub repository (do not upload only the ZIP).
2. In Render, create a PostgreSQL database. Copy its **Internal Database URL**.
3. Create a Render Web Service connected to that GitHub repository. Use:
   - Build command: `npm install`
   - Start command: `npm start`
4. Add environment variables to the Web Service:
   - `DATABASE_URL` = Render PostgreSQL Internal Database URL
   - `DB_SSL` = `true`
   - `NODE_ENV` = `production`
   - `ADMIN_EMAIL` = your admin email
   - `ADMIN_PASSWORD` = a strong unique password
   - `SESSION_SECRET` = a long random secret (at least 32 random characters)
5. Deploy. Open `https://YOUR-SERVICE.onrender.com/admin` and sign in with the configured admin email/password.

`render.yaml` is included as a deployment blueprint. The storefront includes a PWA manifest and app icons; on supported mobile browsers, users can install it from the browser menu. Keep the database and web service in the same region where possible. Never commit `.env`, database URLs, or passwords to GitHub.

## Local development

```bash
npm install
cp .env.example .env
# Set DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD and SESSION_SECRET in .env
npm run dev
```

Open `http://localhost:3000` for the store and `http://localhost:3000/admin` for administration.

## Important production notes

- **bKash/Nagad are manual-contact payment selections only.** Automatic collection, payment verification and refunds require merchant credentials and an approved payment gateway integration. Do not represent a manual selection as a completed online payment.
- Sample product images are remote demo images. Use product photos you own. Admin product images can be uploaded from a device gallery (JPG, PNG, WEBP or GIF, up to 5 MB) and are stored in PostgreSQL as data URLs. Large catalogues should use dedicated object storage such as Cloudinary or S3 to reduce database size.
- Contact messages and newsletter subscriptions are saved in the database; email/SMS/WhatsApp notifications are not automatically sent by this starter.
- Configure your real delivery, return, privacy and customer support policies before launch. Review local legal/tax requirements.
- Use a strong admin password and unique session secret. Keep PostgreSQL backups enabled and monitor Render logs/database usage. Free-tier availability, sleep and database-retention terms can change.
- Before a high-volume launch, add a transactional email/SMS provider, image storage, rate limiting, automated tests, monitoring and a formal backup/restore procedure.

## Main files

- `server.js` — API, database schema, sessions and order logic
- `public/index.html`, `public/style.css`, `public/store.js` — storefront
- `public/admin.html`, `public/admin.js` — admin dashboard
- `render.yaml` — Render blueprint
- `.env.example` — environment variable template


## Customer account & product gallery (updated)
- Admin API responses are parsed safely; upload errors now return readable JSON messages rather than causing an empty-response JSON parsing error. Image uploads explicitly include the same-origin admin session cookie.
- Multer upload errors (including files over 5 MB and unsupported formats) are handled as JSON responses.
- Customers can register, login and logout from the Account item in the mobile bottom navigation. Checkout requires a customer login; orders are saved to that customer's account and shown under My Orders.
- Admins can add/edit products and choose a product photo directly from a phone or computer gallery using the Product Image picker. JPG, PNG, WEBP and GIF are accepted up to 5 MB. Images are stored as data URLs in PostgreSQL, so they remain available after Render redeploys (no ephemeral local uploads folder).
- New dependency: `multer` (installed automatically during deployment from `package.json`). Existing databases are migrated automatically when the server starts; existing products and orders are preserved.


## Stability and responsive update (2026-11)

- Admin login now checks whether `ADMIN_EMAIL` and `ADMIN_PASSWORD` are configured and gives a direct setup message instead of silently failing.
- Admin email input is trimmed and normalized to lowercase. Login now shows progress and readable connection/configuration errors.
- Admin dashboard data-loading failures are shown inside the relevant panel/table.
- Admin login and dashboard have been redesigned with a premium purple/ink visual system and improved small-screen navigation.
- Store footer has been rebuilt into a responsive brand, links and copyright layout, with enough bottom spacing for the mobile navigation.
- Production startup now refuses an unsafe/missing `SESSION_SECRET` (minimum 32 characters). The health endpoint also verifies PostgreSQL connectivity.
- `/admin` responses are sent with `Cache-Control: no-store`.

### Required Render environment variables

Confirm these exist in **Render → Web Service → Environment**:

| Key | Required value |
|---|---|
| `DATABASE_URL` | Internal URL of the Render PostgreSQL database |
| `DB_SSL` | `true` for Render PostgreSQL |
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | At least 32 random characters |
| `ADMIN_EMAIL` | Your own admin email |
| `ADMIN_PASSWORD` | Your own strong, unique admin password |

After changing environment variables, trigger a new deploy. Do not share the admin password or commit it to GitHub. The ZIP can be syntax-checked locally, but real login/order testing still requires your live PostgreSQL database and Render environment.
