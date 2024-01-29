import { userKeypair1, userKeypair2, userKeypair3 } from './testKeypairs';
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
  Connection
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  mintTo,
  createAssociatedTokenAccount
} from '@solana/spl-token';

export const MULT: number = 1_000_000;
export const RATE_MULT: number = 100_000_000_000;

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function initializeTestUsers(
  connection: Connection,
  mint: PublicKey,
  mintAuthority: Keypair
) {
  await safeAirdrop(userKeypair1.publicKey, connection);
  delay(10000);

  await safeAirdrop(userKeypair2.publicKey, connection);
  delay(10000);

  await safeAirdrop(userKeypair3.publicKey, connection);
  delay(10000);

  // create RND ATA for test users
  let user1Ata = await createAssociatedTokenAccount(
    connection,
    userKeypair1,
    mint,
    userKeypair1.publicKey
  );
  let user2Ata = await createAssociatedTokenAccount(
    connection,
    userKeypair2,
    mint,
    userKeypair2.publicKey
  );
  let user3Ata = await createAssociatedTokenAccount(
    connection,
    userKeypair3,
    mint,
    userKeypair3.publicKey
  );

  // mint RND to users
  await mintTo(
    connection,
    userKeypair1,
    mint,
    user1Ata,
    mintAuthority,
    1000 * LAMPORTS_PER_SOL
  );

  await mintTo(
    connection,
    userKeypair2,
    mint,
    user2Ata,
    mintAuthority,
    1000 * LAMPORTS_PER_SOL
  );
  await mintTo(
    connection,
    userKeypair3,
    mint,
    user3Ata,
    mintAuthority,
    1000 * LAMPORTS_PER_SOL
  );
}

export async function safeAirdrop(address: PublicKey, connection: Connection) {
  const acctInfo = await connection.getAccountInfo(address, 'confirmed');

  if (acctInfo == null || acctInfo.lamports < LAMPORTS_PER_SOL) {
    let signature = await connection.requestAirdrop(address, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature);
  }
}
