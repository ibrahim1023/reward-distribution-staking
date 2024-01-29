use {anchor_lang::prelude::*, instructions::*};

pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

declare_id!("2hTWy1wA4dyL7xjsWBneuqo8s5UcZ3ZmDFrQvJoqS7rC");

#[program]
pub mod rnd_staking {
    use super::*;

    pub fn init_pool(ctx: Context<InitializePool>) -> Result<()> {
        init_pool::handler(ctx)
    }

    pub fn init_stake_entry(ctx: Context<InitEntryCtx>) -> Result<()> {
        init_stake_entry::handler(ctx)
    }
}
