use {
    crate::{errors::*, state::*},
    anchor_lang::prelude::*,
    anchor_spl::token::{Mint, Token, TokenAccount},
    solana_program::program::invoke_signed,
    spl_token::instruction::transfer_checked,
};

pub fn handler(ctx: Context<UnstakeCtx>) -> Result<()> {
    let out_amount: u128 = calculate_out_amount(&ctx.accounts.pool, &ctx.accounts.user_stake_entry);
    msg!("Out amount returned: {}", out_amount);
    msg!(
        "Total staked before withdrawal: {}",
        ctx.accounts.pool.amount
    );

    let auth_bump = ctx.accounts.pool.vault_auth_bump;
    let auth_seeds = &[VAULT_AUTH_SEED.as_bytes(), &[auth_bump]];
    let signer = &[&auth_seeds[..]];

    // transfer out_amount from stake vault to user
    let transfer_ix = transfer_checked(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.token_vault.key(),
        &ctx.accounts.token_mint.key(),
        &ctx.accounts.user_token_account.key(),
        &ctx.accounts.vault_authority.key(),
        &[&ctx.accounts.vault_authority.key()],
        out_amount as u64,
        6,
    )
    .unwrap();

    invoke_signed(
        &transfer_ix,
        &[
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.token_vault.to_account_info(),
            ctx.accounts.token_mint.to_account_info(),
            ctx.accounts.user_token_account.to_account_info(),
            ctx.accounts.vault_authority.to_account_info(),
        ],
        signer,
    )?;

    let pool = &mut ctx.accounts.pool;
    let user_entry = &mut ctx.accounts.user_stake_entry;

    pool.amount = pool
        .amount
        .checked_sub(out_amount.try_into().unwrap())
        .unwrap();
    pool.user_deposit_amt = pool
        .user_deposit_amt
        .checked_sub(user_entry.balance)
        .unwrap();

    msg!("Total staked after withdrawal: {}", pool.amount);
    msg!("Amount deposited by users: {}", pool.user_deposit_amt);

    user_entry.balance = 0;
    user_entry.last_staked = Clock::get().unwrap().unix_timestamp;

    Ok(())
}

#[derive(Accounts)]
pub struct UnstakeCtx<'info> {
    #[account(
        mut,
        seeds = [pool.token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
        bump = pool.bump
    )]
    pub pool: Account<'info, PoolState>,
    #[account(
        mut,
        seeds = [pool.token_mint.key().as_ref(), pool.vault_authority.key().as_ref(), VAULT_SEED.as_bytes()],
        bump = pool.vault_bump
    )]
    pub token_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = user.key() == user_stake_entry.user
        @ StakeError::InvalidUser
    )]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [user.key().as_ref(), pool.token_mint.key().as_ref(), STAKE_ENTRY_SEED.as_bytes()],
        bump = user_stake_entry.bump
    )]
    pub user_stake_entry: Account<'info, StakeEntry>,
    #[account(
        mut,
        constraint = user_token_account.mint == pool.token_mint
        @ StakeError::InvalidMint
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    /// CHECK: This is not dangerous because we're only using this as a program signer
    #[account(
        seeds = [VAULT_AUTH_SEED.as_bytes()],
        bump = pool.vault_auth_bump
    )]
    pub vault_authority: AccountInfo<'info>,
    #[account(
        mut,
        constraint = token_mint.key() == pool.token_mint
        @ StakeError::InvalidMint
    )]
    pub token_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
