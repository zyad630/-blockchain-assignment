import { NextRequest, NextResponse } from 'next/server';
import { requireAuthentication, handleGuardError } from '@/lib/server-guards';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { logger } from '@/lib/debug-logger';
import { isValidUUID } from '@/lib/validation-helpers';
import { JsonRpcProvider, Wallet, Contract, parseUnits } from 'ethers';

const WPT_ABI = [
  'function mint(address to, uint256 amount) external',
  'function balanceOf(address account) external view returns (uint256)',
];

const REWARD_AMOUNT = parseUnits('10', 18);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> | { taskId: string } },
): Promise<NextResponse> {
  const params = 'then' in context.params ? await context.params : context.params;
  const { taskId } = params;

  if (!isValidUUID(taskId)) {
    return NextResponse.json({ error: 'Invalid task ID format' }, { status: 400 });
  }

  try {
    await requireAuthentication(request);

    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, name, status, tx_hash, assigned_to, project_id')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.status !== 'done') {
      return NextResponse.json(
        { error: 'Only completed tasks can be rewarded' },
        { status: 400 },
      );
    }

    if (task.tx_hash) {
      return NextResponse.json(
        { error: 'This task has already been rewarded', txHash: task.tx_hash },
        { status: 409 },
      );
    }

    const recipientAddress =
      process.env.WPT_RECIPIENT_ADDRESS ||
      '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

    const rpcUrl = process.env.HARDHAT_RPC_URL || 'http://127.0.0.1:8545';
    const privateKey = process.env.WPT_OWNER_PRIVATE_KEY;
    const contractAddress = process.env.WPT_CONTRACT_ADDRESS;

    if (!privateKey || !contractAddress) {
      logger.error('Blockchain env vars missing', { action: 'rewardTask' });
      return NextResponse.json(
        { error: 'Blockchain not configured. Check WPT_OWNER_PRIVATE_KEY and WPT_CONTRACT_ADDRESS in .env.local' },
        { status: 500 },
      );
    }

    const provider = new JsonRpcProvider(rpcUrl);
    const signer = new Wallet(privateKey, provider);
    const contract = new Contract(contractAddress, WPT_ABI, signer);

    let txHash: string;
    try {
      const tx = await contract.mint(recipientAddress, REWARD_AMOUNT);
      const receipt = await tx.wait();
      txHash = receipt.hash;
    } catch (err) {
      logger.error('mint() failed', { action: 'rewardTask', taskId }, err as Error);
      return NextResponse.json(
        { error: 'Blockchain transaction failed. Is the Hardhat node running?' },
        { status: 502 },
      );
    }

    const { error: updateError } = await supabase
      .from('tasks')
      .update({ tx_hash: txHash, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (updateError) {
      logger.error('Failed to persist tx_hash', { taskId, txHash }, updateError);
    }

    logger.info('Task rewarded', { taskId, txHash });
    return NextResponse.json({ txHash });
  } catch (error: unknown) {
    return handleGuardError(error);
  }
}
