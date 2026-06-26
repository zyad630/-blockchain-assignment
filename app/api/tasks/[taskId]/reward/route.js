const { NextResponse } = require('next/server');
const { requireAuthentication, handleGuardError } = require('../../../../../lib/server-guards');
const { createApiSupabaseClient } = require('../../../../../lib/supabase-server');
const { logger } = require('../../../../../lib/debug-logger');
const { isValidUUID } = require('../../../../../lib/validation-helpers');
const { ethers } = require('ethers');

// Minimal ABI — only the mint function we need
const WPT_ABI = [
  'function mint(address to, uint256 amount) external',
  'function balanceOf(address account) external view returns (uint256)',
];

// Reward amount: 10 WPT per completed task (18 decimals)
const REWARD_AMOUNT = ethers.parseUnits('10', 18);

/**
 * POST /api/tasks/[taskId]/reward
 *
 * Authenticates the user, verifies the task is completed ('done'),
 * calls mint() on the WPT contract, saves the tx_hash to Supabase,
 * and returns { txHash }.
 */
async function POST(request, { params }) {
  const { taskId } = await params;

  if (!isValidUUID(taskId)) {
    return NextResponse.json({ error: 'Invalid task ID format' }, { status: 400 });
  }

  try {
    // ── 1. Authenticate ──────────────────────────────────────────────────────
    const userProfile = await requireAuthentication(request);

    // ── 2. Supabase client ───────────────────────────────────────────────────
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      logger.error('Failed to create Supabase client', { action: 'rewardTask', taskId });
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // ── 3. Fetch the task ────────────────────────────────────────────────────
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, name, status, tx_hash, assigned_to, project_id')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      logger.error('Task not found', { action: 'rewardTask', taskId });
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // ── 4. Validate task is completed ────────────────────────────────────────
    if (task.status !== 'done') {
      return NextResponse.json(
        { error: 'Only completed tasks (status: done) can be rewarded' },
        { status: 400 },
      );
    }

    // ── 5. Prevent double-rewarding ──────────────────────────────────────────
    if (task.tx_hash) {
      return NextResponse.json(
        { error: 'This task has already been rewarded', txHash: task.tx_hash },
        { status: 409 },
      );
    }

    // ── 6. Determine recipient wallet ────────────────────────────────────────
    // Use the assigned user's wallet if available; fall back to a default test address.
    // In production you would store wallet addresses in user_profiles.
    const recipientAddress =
      process.env.WPT_RECIPIENT_ADDRESS ||
      '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // Hardhat account #1

    // ── 7. Connect to the WPT contract via ethers.js ─────────────────────────
    const rpcUrl = process.env.HARDHAT_RPC_URL || 'http://127.0.0.1:8545';
    const privateKey = process.env.WPT_OWNER_PRIVATE_KEY;
    const contractAddress = process.env.WPT_CONTRACT_ADDRESS;

    if (!privateKey || !contractAddress) {
      logger.error('Blockchain env vars not configured', { action: 'rewardTask' });
      return NextResponse.json(
        { error: 'Blockchain configuration missing. Set WPT_OWNER_PRIVATE_KEY and WPT_CONTRACT_ADDRESS in .env.local' },
        { status: 500 },
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, WPT_ABI, signer);

    // ── 8. Call mint() ───────────────────────────────────────────────────────
    logger.info('Calling mint() on WPT contract', {
      action: 'rewardTask',
      taskId,
      recipient: recipientAddress,
      amount: REWARD_AMOUNT.toString(),
    });

    let txHash;
    try {
      const tx = await contract.mint(recipientAddress, REWARD_AMOUNT);
      const receipt = await tx.wait();
      txHash = receipt.hash;
    } catch (blockchainError) {
      logger.error('Blockchain transaction failed', { action: 'rewardTask', taskId }, blockchainError);
      return NextResponse.json(
        { error: 'Blockchain transaction failed. Make sure the Hardhat node is running.' },
        { status: 502 },
      );
    }

    // ── 9. Save tx_hash to Supabase ──────────────────────────────────────────
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ tx_hash: txHash, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (updateError) {
      // Transaction went through on-chain but DB save failed — log it, still return txHash
      logger.error('Failed to save tx_hash to database', { action: 'rewardTask', taskId, txHash }, updateError);
    }

    logger.info('Task rewarded successfully', { action: 'rewardTask', taskId, txHash });

    // ── 10. Return txHash ────────────────────────────────────────────────────
    return NextResponse.json({ txHash });
  } catch (error) {
    return handleGuardError(error);
  }
}

exports.POST = POST;
