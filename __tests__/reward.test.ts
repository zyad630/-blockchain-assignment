import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockRequireAuthentication,
  mockHandleGuardError,
  mockSupabase,
  mockMint,
  mockContract,
} = vi.hoisted(() => {
  const mint = vi.fn();
  const contract = vi.fn(() => ({ mint }));
  return {
    mockRequireAuthentication: vi.fn(),
    mockHandleGuardError: vi.fn((err) => ({
      status: 500,
      json: async () => ({ error: (err as Error).message }),
    })),
    mockSupabase: { from: vi.fn() },
    mockMint: mint,
    mockContract: contract,
  };
});

vi.mock('@/lib/server-guards', () => ({
  requireAuthentication: mockRequireAuthentication,
  handleGuardError: mockHandleGuardError,
}));

vi.mock('@/lib/supabase-server', () => ({
  createApiSupabaseClient: vi.fn(() => mockSupabase),
}));

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  return {
    ...actual,
    JsonRpcProvider: vi.fn(),
    Wallet: vi.fn(() => ({})),
    Contract: mockContract,
  };
});

import * as route from '@/app/api/tasks/[taskId]/reward/route.ts';

const VALID_UUID = '00000000-0000-0000-0000-000000000001';

describe('POST /api/tasks/[taskId]/reward', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.WPT_OWNER_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    process.env.WPT_CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    process.env.HARDHAT_RPC_URL = 'http://127.0.0.1:8545';
  });

  it('returns 400 for a non-UUID taskId', async () => {
    const req = new Request('http://localhost/api/tasks/bad-id/reward', { method: 'POST' });
    const res = await (route as any).POST(req, { params: Promise.resolve({ taskId: 'bad-id' }) });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Invalid task ID format' });
  });

  it('returns 404 when the task does not exist', async () => {
    mockRequireAuthentication.mockResolvedValue({ id: 'u1' });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    });

    const req = new Request(`http://localhost/api/tasks/${VALID_UUID}/reward`, { method: 'POST' });
    const res = await (route as any).POST(req, { params: Promise.resolve({ taskId: VALID_UUID }) });
    expect(res.status).toBe(404);
  });

  it('returns 400 when task status is not done', async () => {
    mockRequireAuthentication.mockResolvedValue({ id: 'u1' });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: VALID_UUID, status: 'in_progress', tx_hash: null },
        error: null,
      }),
    });

    const req = new Request(`http://localhost/api/tasks/${VALID_UUID}/reward`, { method: 'POST' });
    const res = await (route as any).POST(req, { params: Promise.resolve({ taskId: VALID_UUID }) });
    expect(res.status).toBe(400);
  });

  it('returns 409 when task was already rewarded', async () => {
    mockRequireAuthentication.mockResolvedValue({ id: 'u1' });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: VALID_UUID, status: 'done', tx_hash: '0xprevioustx' },
        error: null,
      }),
    });

    const req = new Request(`http://localhost/api/tasks/${VALID_UUID}/reward`, { method: 'POST' });
    const res = await (route as any).POST(req, { params: Promise.resolve({ taskId: VALID_UUID }) });
    expect(res.status).toBe(409);
  });

  it('mints tokens and returns txHash on success', async () => {
    mockRequireAuthentication.mockResolvedValue({ id: 'u1' });
    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: VALID_UUID, status: 'done', tx_hash: null },
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
    }));
    mockMint.mockResolvedValue({
      wait: vi.fn().mockResolvedValue({ hash: '0xabc123' }),
    });

    const req = new Request(`http://localhost/api/tasks/${VALID_UUID}/reward`, { method: 'POST' });
    const res = await (route as any).POST(req, { params: Promise.resolve({ taskId: VALID_UUID }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ txHash: '0xabc123' });
  });
});
