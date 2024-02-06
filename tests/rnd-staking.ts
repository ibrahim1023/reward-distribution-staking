import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RndStaking } from "../target/types/rnd_staking";

import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

import {
  TOKEN_PROGRAM_ID,
  createMint,
  setAuthority,
  AuthorityType,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";

import {
  delay,
  initializeTestUsers,
  safeAirdrop,
  MULT,
  RATE_MULT,
} from "./utils/util";

import {
  userKeypair1,
  userKeypair2,
  userKeypair3,
  programAuthority,
} from "./utils/testKeypairs";

import { assert } from "chai";
import { BN } from "bn.js";

describe("rnd-staking", async () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.RndStaking as Program<RndStaking>;
  const provider = anchor.AnchorProvider.env();

  let tokenMint: PublicKey = null;
  let stakeVault: PublicKey = null;
  let pool: PublicKey = null;
  let user1StakeEntry: PublicKey = null;
  let user2StakeEntry: PublicKey = null;
  let user3StakeEntry: PublicKey = null;

  let [vaultAuthority, _vaultAuthBump] = await PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    program.programId
  );

  it("Create RND Token mint", async () => {
    await safeAirdrop(programAuthority.publicKey, provider.connection);
    await safeAirdrop(provider.wallet.publicKey, provider.connection);
    delay(10000);

    // create RND mint
    tokenMint = await createMint(
      provider.connection,
      programAuthority,
      programAuthority.publicKey,
      programAuthority.publicKey,
      6
    );

    // mint RND to test users
    await initializeTestUsers(provider.connection, tokenMint, programAuthority);

    // assign RND mint to a PDA of the staking program
    await setAuthority(
      provider.connection,
      programAuthority,
      tokenMint,
      programAuthority,
      AuthorityType.MintTokens,
      vaultAuthority
    );
  });

  it("Initialize Stake Pool", async () => {
    const [poolState, poolBump] = await PublicKey.findProgramAddressSync(
      [tokenMint.toBuffer(), Buffer.from("state")],
      program.programId
    );
    pool = poolState;

    const [vault, vaultBump] = await PublicKey.findProgramAddressSync(
      [tokenMint.toBuffer(), vaultAuthority.toBuffer(), Buffer.from("vault")],
      program.programId
    );

    stakeVault = vault;

    await program.methods
      .initPool()
      .accounts({
        poolState: pool,
        tokenVault: stakeVault,
        tokenMint: tokenMint,
        programAuthority: programAuthority.publicKey,
        vaultAuthority: vaultAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([programAuthority])
      .rpc();

    const poolAcct = await program.account.poolState.fetch(pool);
    assert(
      poolAcct.authority.toBase58() == programAuthority.publicKey.toBase58()
    );
    assert(poolAcct.amount.toNumber() == 0);
    assert(poolAcct.distributionRate.toNumber() == 1);
  });

  it("Create user stake entry accounts", async () => {
    const [user1StakeE, entryBump1] = await PublicKey.findProgramAddressSync(
      [
        userKeypair1.publicKey.toBuffer(),
        tokenMint.toBuffer(),
        Buffer.from("stake_entry"),
      ],
      program.programId
    );

    user1StakeEntry = user1StakeE;

    let userEntryAcct = await provider.connection.getAccountInfo(user1StakeE);

    if (userEntryAcct == null) {
      await program.methods
        .initStakeEntry()
        .accounts({
          user: userKeypair1.publicKey,
          userStakeEntry: user1StakeE,
          poolState: pool,
        })
        .signers([userKeypair1])
        .rpc();
    }

    const [user2StakeE, entryBump2] = await PublicKey.findProgramAddressSync(
      [
        userKeypair2.publicKey.toBuffer(),
        tokenMint.toBuffer(),
        Buffer.from("stake_entry"),
      ],
      program.programId
    );

    user2StakeEntry = user2StakeE;

    userEntryAcct = await provider.connection.getAccountInfo(user2StakeE);

    if (userEntryAcct == null) {
      await program.methods
        .initStakeEntry()
        .accounts({
          user: userKeypair2.publicKey,
          userStakeEntry: user2StakeE,
          poolState: pool,
        })
        .signers([userKeypair2])
        .rpc();
    }

    const [user3StakeE, entryBump3] = await PublicKey.findProgramAddressSync(
      [
        userKeypair3.publicKey.toBuffer(),
        tokenMint.toBuffer(),
        Buffer.from("stake_entry"),
      ],
      program.programId
    );

    user3StakeEntry = user3StakeE;

    userEntryAcct = await provider.connection.getAccountInfo(user3StakeE);

    if (userEntryAcct == null) {
      await program.methods
        .initStakeEntry()
        .accounts({
          user: userKeypair3.publicKey,
          userStakeEntry: user3StakeE,
          poolState: pool,
        })
        .signers([userKeypair3])
        .rpc();
    }

    const user1Account = await program.account.stakeEntry.fetch(user1StakeE);
    assert(user1Account.user.toBase58() == userKeypair1.publicKey.toBase58());
    assert(user1Account.bump == entryBump1);
    assert(user1Account.balance.toNumber() == 0);

    const user2Account = await program.account.stakeEntry.fetch(user2StakeE);
    assert(user2Account.user.toBase58() == userKeypair2.publicKey.toBase58());
    assert(user2Account.bump == entryBump2);
    assert(user2Account.balance.toNumber() == 0);

    const user3Account = await program.account.stakeEntry.fetch(user3StakeE);
    assert(user3Account.user.toBase58() == userKeypair3.publicKey.toBase58());
    assert(user3Account.bump == entryBump3);
    assert(user3Account.balance.toNumber() == 0);
  });

  it("User 1 stakes RND token", async () => {
    const userAta = await getAssociatedTokenAddress(
      tokenMint,
      userKeypair1.publicKey
    );

    let userTokenAcct = await getAccount(provider.connection, userAta);
    let initialUserBalance = userTokenAcct.amount;

    let stakeVaultAcct = await getAccount(provider.connection, stakeVault);
    let initialVaultBalance = stakeVaultAcct.amount;

    let poolAcct = await program.account.poolState.fetch(pool);
    let initialPoolAmt = poolAcct.amount;

    let userEntryAcct = await program.account.stakeEntry.fetch(user1StakeEntry);
    let initialEntryBalance = userEntryAcct.balance;

    await program.methods
      .stake(new BN(200 * MULT))
      .accounts({
        pool: pool,
        tokenVault: stakeVault,
        user: userKeypair1.publicKey,
        userStakeEntry: user1StakeEntry,
        userTokenAccount: userAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([userKeypair1])
      .rpc();

    userTokenAcct = await getAccount(provider.connection, userAta);
    stakeVaultAcct = await getAccount(provider.connection, stakeVault);

    assert(userTokenAcct.amount == initialUserBalance - BigInt(200 * MULT));
    assert(stakeVaultAcct.amount == initialVaultBalance + BigInt(200 * MULT));

    let updatedUserEntryAcct = await program.account.stakeEntry.fetch(
      user1StakeEntry
    );
    assert(
      updatedUserEntryAcct.balance.toNumber() / MULT ==
        initialEntryBalance.toNumber() + 200
    );

    poolAcct = await program.account.poolState.fetch(pool);
    assert(
      poolAcct.amount.toNumber() / MULT == initialPoolAmt.toNumber() + 200
    );
    assert(
      poolAcct.amount.toNumber() == updatedUserEntryAcct.balance.toNumber()
    );
    assert(
      poolAcct.distributionRate.toNumber() ==
        updatedUserEntryAcct.initialDistributionRate.toNumber()
    );
  });

  it("User 2 stakes RND token", async () => {
    const userAta = await getAssociatedTokenAddress(
      tokenMint,
      userKeypair2.publicKey
    );

    let userTokenAcct = await getAccount(provider.connection, userAta);
    let initialUserBalance = userTokenAcct.amount;

    let stakeVaultAcct = await getAccount(provider.connection, stakeVault);
    let initialVaultBalance = stakeVaultAcct.amount;

    let poolAcct = await program.account.poolState.fetch(pool);
    let initialPoolAmt = poolAcct.amount;

    let userEntryAcct = await program.account.stakeEntry.fetch(user2StakeEntry);
    let initialEntryBalance = userEntryAcct.balance;

    await program.methods
      .stake(new BN(400 * MULT))
      .accounts({
        pool: pool,
        tokenVault: stakeVault,
        user: userKeypair2.publicKey,
        userStakeEntry: user2StakeEntry,
        userTokenAccount: userAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([userKeypair2])
      .rpc();

    userTokenAcct = await getAccount(provider.connection, userAta);
    stakeVaultAcct = await getAccount(provider.connection, stakeVault);

    assert(userTokenAcct.amount == initialUserBalance - BigInt(400 * MULT));
    assert(stakeVaultAcct.amount == initialVaultBalance + BigInt(400 * MULT));

    let updatedUserEntryAcct = await program.account.stakeEntry.fetch(
      user2StakeEntry
    );
    assert(
      updatedUserEntryAcct.balance.toNumber() ==
        initialEntryBalance.toNumber() + 400 * MULT
    );

    poolAcct = await program.account.poolState.fetch(pool);
    assert(
      poolAcct.amount.toNumber() == initialPoolAmt.toNumber() + 400 * MULT
    );
    assert(
      poolAcct.distributionRate.toNumber() ==
        updatedUserEntryAcct.initialDistributionRate.toNumber()
    );
  });

  it("Distribute RND", async () => {
    let poolAcct = await program.account.poolState.fetch(pool);
    const initialStakeAmt = poolAcct.amount;
    const initialDistributionRate = poolAcct.distributionRate;

    let vaultAcct = await getAccount(provider.connection, stakeVault);
    const initialVaultAmt = vaultAcct.amount;

    await program.methods
      .distribute(new BN(30 * MULT))
      .accounts({
        programAuthority: programAuthority.publicKey,
        poolState: pool,
        tokenVault: stakeVault,
        tokenMint: tokenMint,
        mintAuth: vaultAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([programAuthority])
      .rpc();

    poolAcct = await program.account.poolState.fetch(pool);
    assert(
      poolAcct.amount.toNumber() == initialStakeAmt.toNumber() + 30 * MULT
    );

    vaultAcct = await getAccount(provider.connection, stakeVault);
    assert(vaultAcct.amount == initialVaultAmt + BigInt(30 * MULT));

    let tempDistributionRate = 1 + (30 * MULT) / initialStakeAmt.toNumber();
    let distributionRate =
      tempDistributionRate * initialDistributionRate.toNumber();

    console.log("Derived Distribution rate: ", distributionRate);
    assert(
      poolAcct.distributionRate.toNumber() / RATE_MULT == distributionRate
    );
  });

  it("User 3 stakes RND token", async () => {
    const userAta = await getAssociatedTokenAddress(
      tokenMint,
      userKeypair3.publicKey
    );

    let userTokenAcct = await getAccount(provider.connection, userAta);
    let initialUserBalance = userTokenAcct.amount;

    let stakeVaultAcct = await getAccount(provider.connection, stakeVault);
    let initialVaultBalance = stakeVaultAcct.amount;

    let poolAcct = await program.account.poolState.fetch(pool);
    let initialPoolAmt = poolAcct.amount;

    let userEntryAcct = await program.account.stakeEntry.fetch(user3StakeEntry);
    let initialEntryBalance = userEntryAcct.balance;

    await program.methods
      .stake(new BN(200 * MULT))
      .accounts({
        pool: pool,
        tokenVault: stakeVault,
        user: userKeypair3.publicKey,
        userStakeEntry: user3StakeEntry,
        userTokenAccount: userAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([userKeypair3])
      .rpc();

    userTokenAcct = await getAccount(provider.connection, userAta);
    stakeVaultAcct = await getAccount(provider.connection, stakeVault);

    assert(userTokenAcct.amount == initialUserBalance - BigInt(200 * MULT));
    assert(stakeVaultAcct.amount == initialVaultBalance + BigInt(200 * MULT));

    let updatedUserEntryAcct = await program.account.stakeEntry.fetch(
      user3StakeEntry
    );
    assert(
      updatedUserEntryAcct.balance.toNumber() ==
        initialEntryBalance.toNumber() + 200 * MULT
    );

    poolAcct = await program.account.poolState.fetch(pool);
    assert(
      poolAcct.amount.toNumber() == initialPoolAmt.toNumber() + 200 * MULT
    );
    assert(
      poolAcct.distributionRate.toNumber() ==
        updatedUserEntryAcct.initialDistributionRate.toNumber()
    );
  });

  it("Burn RND", async () => {
    let poolAcct = await program.account.poolState.fetch(pool);
    const initialStakeAmt = poolAcct.amount;

    let vaultAcct = await getAccount(provider.connection, stakeVault);
    const initialVaultAmt = vaultAcct.amount;

    await program.methods
      .burn(new BN(20 * MULT))
      .accounts({
        programAuthority: programAuthority.publicKey,
        poolState: pool,
        tokenVault: stakeVault,
        tokenMint: tokenMint,
        vaultAuthority: vaultAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([programAuthority])
      .rpc();

    poolAcct = await program.account.poolState.fetch(pool);
    assert(
      poolAcct.amount.toNumber() == initialStakeAmt.toNumber() - 20 * MULT
    );

    vaultAcct = await getAccount(provider.connection, stakeVault);
    assert(vaultAcct.amount == initialVaultAmt - BigInt(20 * MULT));

    let burnRate = 1 - (20 * MULT) / initialStakeAmt.toNumber();
    console.log("Derived burn rate: ", burnRate);
  });

  it("User 1 unstakes RND", async () => {
    const userAta = await getAssociatedTokenAddress(
      tokenMint,
      userKeypair1.publicKey
    );

    let userTokenAcct = await getAccount(provider.connection, userAta);
    let initialUserBalance = Number(userTokenAcct.amount);

    let stakeVaultAcct = await getAccount(provider.connection, stakeVault);
    let initialVaultBalance = Number(stakeVaultAcct.amount);

    let poolAcct = await program.account.poolState.fetch(pool);
    let initialPoolAmt = Number(poolAcct.amount);

    console.log("Initial Amount in pool state: ", Number(poolAcct.amount));

    let userEntryAcct = await program.account.stakeEntry.fetch(user1StakeEntry);
    let initialEntryBalance = Number(userEntryAcct.balance);

    await program.methods
      .unstake()
      .accounts({
        pool: pool,
        tokenVault: stakeVault,
        user: userKeypair1.publicKey,
        userStakeEntry: user1StakeEntry,
        userTokenAccount: userAta,
        vaultAuthority: vaultAuthority,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([userKeypair1])
      .rpc();

    userTokenAcct = await getAccount(provider.connection, userAta);
    stakeVaultAcct = await getAccount(provider.connection, stakeVault);

    const distributionRate =
      (poolAcct.distributionRate.toNumber() -
        userEntryAcct.initialDistributionRate.toNumber()) /
      RATE_MULT;
    let expectedAmt = Math.round(initialEntryBalance * distributionRate);

    assert(Number(userTokenAcct.amount) == initialUserBalance + expectedAmt);
    assert(Number(stakeVaultAcct.amount) == initialVaultBalance - expectedAmt);

    let updatedUserEntryAcct = await program.account.stakeEntry.fetch(
      user1StakeEntry
    );
    assert(updatedUserEntryAcct.balance.toNumber() == 0);

    poolAcct = await program.account.poolState.fetch(pool);
    assert(poolAcct.amount.toNumber() == initialPoolAmt - expectedAmt);
    console.log(
      "[After unstake] Amount in pool state: ",
      Number(poolAcct.amount)
    );
  });

  it("User 2 unstakes RND", async () => {
    const userAta = await getAssociatedTokenAddress(
      tokenMint,
      userKeypair2.publicKey
    );

    let userTokenAcct = await getAccount(provider.connection, userAta);
    let initialUserBalance = Number(userTokenAcct.amount);

    let stakeVaultAcct = await getAccount(provider.connection, stakeVault);
    let initialVaultBalance = Number(stakeVaultAcct.amount);

    let poolAcct = await program.account.poolState.fetch(pool);
    let initialPoolAmt = Number(poolAcct.amount);

    console.log("Initial Amount in pool state: ", Number(poolAcct.amount));

    let userEntryAcct = await program.account.stakeEntry.fetch(user2StakeEntry);
    let initialEntryBalance = Number(userEntryAcct.balance);

    await program.methods
      .unstake()
      .accounts({
        pool: pool,
        tokenVault: stakeVault,
        user: userKeypair2.publicKey,
        userStakeEntry: user2StakeEntry,
        userTokenAccount: userAta,
        vaultAuthority: vaultAuthority,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([userKeypair2])
      .rpc();

    userTokenAcct = await getAccount(provider.connection, userAta);
    stakeVaultAcct = await getAccount(provider.connection, stakeVault);

    const distributionRate =
      (poolAcct.distributionRate.toNumber() -
        userEntryAcct.initialDistributionRate.toNumber()) /
      RATE_MULT;
    let expectedAmt = Math.round(initialEntryBalance * distributionRate);

    assert(Number(userTokenAcct.amount) == initialUserBalance + expectedAmt);
    assert(Number(stakeVaultAcct.amount) == initialVaultBalance - expectedAmt);

    let updatedUserEntryAcct = await program.account.stakeEntry.fetch(
      user2StakeEntry
    );
    assert(updatedUserEntryAcct.balance.toNumber() == 0);

    poolAcct = await program.account.poolState.fetch(pool);
    assert(poolAcct.amount.toNumber() == initialPoolAmt - expectedAmt);
    console.log(
      "[After unstake] Amount in pool state: ",
      Number(poolAcct.amount)
    );
  });
});
