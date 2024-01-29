use anchor_lang::prelude::*;

#[error_code]
pub enum StakeError {
    #[msg("Incorrect program authority")]
    InvalidProgramAuthority,
    #[msg("Token mint is invalid")]
    InvalidMint,
    #[msg("Invalid user provided")]
    InvalidUser,
}
