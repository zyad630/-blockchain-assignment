# Worklo — Blockchain Task Rewards Integration

Here is my implementation for the WPT (Worklo Project Token) reward system integration. I have successfully created the token contract, the backend minting API, the frontend dashboard updates, and wrote unit tests to cover the reward flow.

---

## What I Implemented

1. **WPT Smart Contract (`contracts/WorkloProjectToken.sol`)**
   - A standard OpenZeppelin ERC-20 token contract.
   - Restricts the `mint` function to the contract owner so only the Worklo backend can issue rewards.

2. **Reward API Route (`app/api/tasks/[taskId]/reward/route.ts`)**
   - Added a POST endpoint that resolves Next.js 15 route parameters asynchronously.
   - Authenticates requests and queries Supabase to check the task status.
   - Prevents double-rewarding by checking if a transaction hash already exists for the task.
   - Triggers the on-chain minting on localhost via `ethers.js` using the private key configured in environment variables, then saves the transaction hash back to the database.

3. **Frontend Integration (`app/projects/[projectId]/page.tsx`)**
   - Added `tx_hash` to the task type definition.
   - Added a "Reward WPT" button next to tasks that are marked as "done".
   - Implemented transition loading states and a success badge that displays the truncated transaction hash when a task is successfully rewarded.

4. **Database Migration (`supabase/add_tx_hash_to_tasks.sql`)**
   - Script to safely add the `tx_hash` text column to the `tasks` table.

5. **Unit Tests (`__tests__/reward.test.ts`)**
   - Written with Vitest. Fully covers the API endpoint including validation checks (invalid UUID, non-existent tasks, non-done status, double-reward attempts) and a mocked successful blockchain reward flow.

---

## Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Configuration
Create a `.env.local` file from the template:
```bash
cp .env.local.template .env.local
```
Add your Supabase URL and keys. For local blockchain testing, add the following variables:
```env
WPT_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
WPT_OWNER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
HARDHAT_RPC_URL=http://127.0.0.1:8545
```

### 3. Database Update
Run the SQL migration in your Supabase SQL Editor:
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tx_hash TEXT DEFAULT NULL;
```

### 4. Start Local Blockchain Node
Run Hardhat's local node in a separate terminal:
```bash
npx hardhat node
```

### 5. Deploy the Token Contract
Deploy the contract to your running local node:
```bash
npx hardhat run scripts/deploy.js --network localhost
```

### 6. Run the App & Run Tests
Start the development server:
```bash
npm run dev
```
To run the Vitest test suite:
```bash
npx vitest run
```

---

## Future Improvements & Considerations

- **Dynamic Wallet Mapping:** In a production setting, we should fetch the task assignee's actual wallet address from their profile rather than routing rewards to a default test account address.
- **Gas Fee / Relay Handling:** Users shouldn't pay gas for receiving rewards. The current backend gas-paying mint design works well, but we could look into ERC-2771 meta-transactions or Gas Station Network (GSN) integrations as we scale.
- **On-Chain Event Listening:** Setting up a listener service (e.g., using Graph protocol or a simple backend listener) to monitor the mint transaction events and update UI states via WebSockets/Supabase Realtime once confirmed.
- **Role-Based Access Control:** Restrict the reward action to project managers or admin roles to secure the endpoint.
