# Cloudflare Pages + D1 setup

This site now includes a free-tier friendly account and cloud-save backend for Cloudflare Pages Functions.
The main site remains public. Login is only used by the two game pages for automatic cloud saves.

## One-time setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Log in to Cloudflare:

   ```powershell
   npx wrangler login
   ```

3. Create the D1 database:

   ```powershell
   npm run d1:create
   ```

4. Copy the returned `database_id` into `wrangler.jsonc`.

5. Create the tables:

   ```powershell
   npm run d1:migrate:remote
   ```

6. Deploy the Pages project:

   ```powershell
   npm run deploy
   ```

## Local testing

```powershell
npm run d1:migrate:local
npm run dev
```

Open `http://127.0.0.1:8788/index.html#games`, use the account button in the top-right of the main page, then enter either game. The game shell will detect the session and sync saves automatically.
