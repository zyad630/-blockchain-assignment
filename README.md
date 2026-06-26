# Worklo — Blockchain Assignment Submission

## What Was Built

Three additions on top of the existing Worklo PSA codebase:

1. **`contracts/WorkloProjectToken.sol`** — A minimal ERC-20 token (WPT) built with OpenZeppelin where only the `owner` can `mint`.
2. **`app/api/tasks/[taskId]/reward/route.ts`** — `POST /api/tasks/[taskId]/reward` that authenticates the user, validates the task is `done`, calls `mint()` via ethers.js, saves the `tx_hash` to Supabase, and returns `{ txHash }`.
3. **`app/projects/[projectId]/page.tsx`** — Updated project detail page showing a **"Reward WPT"** button next to every completed task, a spinner while the tx is in flight, and a **"Rewarded"** badge + truncated `txHash` on success.

---

## How to Run

### Prerequisites

- Node.js 18+
- A free [Supabase](https://supabase.com) project

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.template .env.local
# Fill in your Supabase URL and keys
```

### 3. Run the Supabase schema

In your Supabase dashboard → SQL Editor:
1. Run `supabase/schema.sql` (initial schema)
2. Run `supabase/add_tx_hash_to_tasks.sql` (adds `tx_hash` column to tasks)

### 4. Start a local Hardhat node (separate terminal)

```bash
npx hardhat node
```

This prints 20 test accounts with private keys. Keep this terminal open.

### 5. Deploy the WPT contract

```bash
npx hardhat run scripts/deploy.js --network localhost
```

This prints the deployed contract address. Copy it into `.env.local`:

```
WPT_CONTRACT_ADDRESS=0x<printed address>
WPT_OWNER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
HARDHAT_RPC_URL=http://127.0.0.1:8545
```

> The private key above is Hardhat Account #0 — a well-known public test key, safe to use locally.

### 6. Start the dev server

```bash
npm run dev   # http://localhost:3000
```

### 7. Test the reward flow

1. Log in and open any project.
2. Find a task with status **"done"**.
3. Click **"Reward WPT"** — the button shows a spinner while the transaction confirms.
4. On success a green **"Rewarded"** badge appears with the `txHash`.

---

## What I'd Improve With More Time

- **Wallet address per user** — Store an Ethereum wallet address in `user_profiles` and send rewards directly to the task assignee's wallet instead of a default address.
- **Event listening** — Emit a `Rewarded` event from the contract and use a webhook or Supabase Realtime to reflect confirmed on-chain state in the UI.
- **Role-based access** — Gate the "Reward WPT" button behind a permission (e.g. `MANAGE_PROJECTS`) so only project managers can trigger rewards.
- **Configurable reward amount** — Allow the reward amount to be set per-project or per-task rather than a hardcoded 10 WPT.
- **Error UX** — Show a dismissible toast (the app already uses `sonner`) instead of inline text for reward errors.
- **Tests** — Add a Hardhat test for `WorkloProjectToken` (mint access control, balance assertions) and a mock-based unit test for the API route.
