import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { RndStaking } from '../target/types/rnd_staking';

describe('rnd-staking', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.RndStaking as Program<RndStaking>;

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log('Your transaction signature', tx);
  });
});
