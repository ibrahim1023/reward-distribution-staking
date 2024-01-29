use {
    crate::{errors::*, state::*},
    anchor_lang::prelude::*,
    anchor_spl::token::{Mint, Token, TokenAccount},
};

pub fn handler(ctx: Context<InitializePool>) -> Result<()> {
    let pool_state = &mut ctx.accounts.pool_state;
    pool_state.authority = ctx.accounts.program_authority.key();
    pool_state.bump = ctx.bumps.pool_state;
    pool_state.amount = 0;
    pool_state.user_deposit_amt = 0;
    pool_state.token_vault = ctx.accounts.token_vault.key();
    pool_state.token_mint = ctx.accounts.token_mint.key();
    pool_state.initialized_at = Clock::get().unwrap().unix_timestamp;
    pool_state.vault_bump = ctx.bumps.token_vault;
    pool_state.vault_auth_bump = ctx.bumps.vault_authority;
    pool_state.vault_authority = ctx.accounts.vault_authority.key();
    pool_state.distribution_rate = 1;

    Ok(())
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(init, seeds=[token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()], bump, payer=program_authority, space=STAKE_POOL_SIZE)]
    pub pool_state: Account<'info, PoolState>,
    #[account(init, token::mint = token_mint, token::authority=vault_authority, seeds=[token_mint.key().as_ref(), vault_authority.key().as_ref(), VAULT_SEED.as_bytes()], bump, payer=program_authority)]
    pub token_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub token_mint: Account<'info, Mint>,
    #[account(mut, constraint=program_authority.key() == PROGRAM_AUTHORITY @ StakeError::InvalidProgramAuthority)]
    pub program_authority: Signer<'info>,
    #[account(seeds=[VAULT_AUTH_SEED.as_bytes()], bump)]
    pub vault_authority: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
