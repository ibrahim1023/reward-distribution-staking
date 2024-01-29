use {crate::state::*, anchor_lang::prelude::*};

pub fn handler(ctx: Context<InitEntryCtx>) -> Result<()> {
    let user_stake_entry = &mut ctx.accounts.user_stake_entry;
    user_stake_entry.user = ctx.accounts.user.key();
    user_stake_entry.bump = ctx.bumps.user_stake_entry;
    user_stake_entry.balance = 0;
    user_stake_entry.initial_distribution_rate = ctx.accounts.pool_state.distribution_rate;
    Ok(())
}

#[derive(Accounts)]
pub struct InitEntryCtx<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(init, seeds=[user.key().as_ref(), pool_state.token_mint.key().as_ref(), STAKE_ENTRY_SEED.as_bytes()], bump, payer=user, space=STAKE_ENTRY_SIZE)]
    pub user_stake_entry: Account<'info, StakeEntry>,
    #[account(seeds=[pool_state.token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()], bump=pool_state.bump)]
    pub pool_state: Account<'info, PoolState>,
    pub system_program: Program<'info, System>,
}
