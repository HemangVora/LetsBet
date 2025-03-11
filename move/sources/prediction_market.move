module prediction_market::market {
    use std::error;
    use std::signer;
    use std::string::{Self, String};
    use aptos_framework::account;
    use aptos_framework::coin;
    use aptos_framework::timestamp;
    use aptos_std::table::{Self, Table};
    
    /// Error codes
    const E_MARKET_EXISTS: u64 = 1;
    const E_MARKET_DOES_NOT_EXIST: u64 = 2;
    const E_NOT_MARKET_CREATOR: u64 = 3;
    const E_MARKET_ALREADY_RESOLVED: u64 = 4;
    const E_MARKET_NOT_RESOLVED: u64 = 5;
    const E_INSUFFICIENT_FUNDS: u64 = 6;
    const E_INVALID_OUTCOME: u64 = 7;
    
    /// Outcome state
    const OUTCOME_YES: u8 = 1;
    const OUTCOME_NO: u8 = 2;
    const OUTCOME_UNRESOLVED: u8 = 0;
    
    /// A prediction market
    struct Market has store {
        creator: address,
        question: String,
        description: String,
        expiration_time: u64,
        resolved_outcome: u8,
        yes_pool: u64,
        no_pool: u64,
    }
    
    /// Represents a position in a market
    struct Position has store {
        yes_amount: u64,
        no_amount: u64,
    }
    
    /// Resource that stores all markets created by the account
    struct MarketStore has key {
        markets: Table<u64, Market>,
        market_count: u64,
    }
    
    /// Resource that stores all positions held by the account
    struct PositionStore has key {
        positions: Table<u64, Position>,
    }
    
    /// Initialize a user's market and position stores
    public entry fun init_user(account: &signer) {
        let addr = signer::address_of(account);
        if (!exists<MarketStore>(addr)) {
            move_to(account, MarketStore {
                markets: table::new(),
                market_count: 0,
            });
        };
        
        if (!exists<PositionStore>(addr)) {
            move_to(account, PositionStore {
                positions: table::new(),
            });
        };
    }
    
    /// Create a new prediction market
    public entry fun create_market(
        creator: &signer,
        question: String,
        description: String,
        expiration_time: u64,
    ) acquires MarketStore {
        let creator_addr = signer::address_of(creator);
        
        // Initialize user if not already
        if (!exists<MarketStore>(creator_addr)) {
            init_user(creator);
        };
        
        let market_store = borrow_global_mut<MarketStore>(creator_addr);
        let market_id = market_store.market_count;
        
        // Create new market
        table::add(&mut market_store.markets, market_id, Market {
            creator: creator_addr,
            question,
            description,
            expiration_time,
            resolved_outcome: OUTCOME_UNRESOLVED,
            yes_pool: 0,
            no_pool: 0,
        });
        
        // Increment market count
        market_store.market_count = market_id + 1;
    }
    
    /// Buy shares in a prediction market
    public entry fun buy_shares(
        buyer: &signer,
        creator_addr: address,
        market_id: u64,
        outcome: u8,
        amount: u64
    ) acquires MarketStore, PositionStore {
        assert!(outcome == OUTCOME_YES || outcome == OUTCOME_NO, error::invalid_argument(E_INVALID_OUTCOME));
        
        let buyer_addr = signer::address_of(buyer);
        
        // Initialize user if not already
        if (!exists<PositionStore>(buyer_addr)) {
            init_user(buyer);
        };
        
        assert!(exists<MarketStore>(creator_addr), error::not_found(E_MARKET_DOES_NOT_EXIST));
        let market_store = borrow_global_mut<MarketStore>(creator_addr);
        assert!(table::contains(&market_store.markets, market_id), error::not_found(E_MARKET_DOES_NOT_EXIST));
        
        let market = table::borrow_mut(&mut market_store.markets, market_id);
        assert!(market.resolved_outcome == OUTCOME_UNRESOLVED, error::invalid_state(E_MARKET_ALREADY_RESOLVED));
        
        // Update market pools
        if (outcome == OUTCOME_YES) {
            market.yes_pool = market.yes_pool + amount;
        } else {
            market.no_pool = market.no_pool + amount;
        };
        
        // Update user position
        let position_store = borrow_global_mut<PositionStore>(buyer_addr);
        if (!table::contains(&position_store.positions, market_id)) {
            table::add(&mut position_store.positions, market_id, Position {
                yes_amount: 0,
                no_amount: 0,
            });
        };
        
        let position = table::borrow_mut(&mut position_store.positions, market_id);
        if (outcome == OUTCOME_YES) {
            position.yes_amount = position.yes_amount + amount;
        } else {
            position.no_amount = position.no_amount + amount;
        };
    }
    
    /// Resolve a prediction market
    public entry fun resolve_market(
        resolver: &signer,
        market_id: u64,
        outcome: u8
    ) acquires MarketStore {
        let resolver_addr = signer::address_of(resolver);
        
        assert!(exists<MarketStore>(resolver_addr), error::not_found(E_MARKET_DOES_NOT_EXIST));
        let market_store = borrow_global_mut<MarketStore>(resolver_addr);
        assert!(table::contains(&market_store.markets, market_id), error::not_found(E_MARKET_DOES_NOT_EXIST));
        
        let market = table::borrow_mut(&mut market_store.markets, market_id);
        assert!(market.creator == resolver_addr, error::permission_denied(E_NOT_MARKET_CREATOR));
        assert!(market.resolved_outcome == OUTCOME_UNRESOLVED, error::invalid_state(E_MARKET_ALREADY_RESOLVED));
        assert!(outcome == OUTCOME_YES || outcome == OUTCOME_NO, error::invalid_argument(E_INVALID_OUTCOME));
        
        // Check if market has expired
        assert!(timestamp::now_seconds() >= market.expiration_time, error::invalid_state(E_MARKET_NOT_RESOLVED));
        
        // Set the outcome
        market.resolved_outcome = outcome;
    }
    
    /// Claim winnings from a resolved market
    public entry fun claim_winnings(
        claimer: &signer,
        creator_addr: address,
        market_id: u64
    ) acquires MarketStore, PositionStore {
        let claimer_addr = signer::address_of(claimer);
        
        assert!(exists<MarketStore>(creator_addr), error::not_found(E_MARKET_DOES_NOT_EXIST));
        let market_store = borrow_global<MarketStore>(creator_addr);
        assert!(table::contains(&market_store.markets, market_id), error::not_found(E_MARKET_DOES_NOT_EXIST));
        
        let market = table::borrow(&market_store.markets, market_id);
        assert!(market.resolved_outcome != OUTCOME_UNRESOLVED, error::invalid_state(E_MARKET_NOT_RESOLVED));
        
        assert!(exists<PositionStore>(claimer_addr), error::not_found(E_MARKET_DOES_NOT_EXIST));
        let position_store = borrow_global_mut<PositionStore>(claimer_addr);
        assert!(table::contains(&position_store.positions, market_id), error::not_found(E_MARKET_DOES_NOT_EXIST));
        
        let position = table::borrow_mut(&mut position_store.positions, market_id);
        
        // Calculate winnings based on outcome and position
        let winnings = 0;
        if (market.resolved_outcome == OUTCOME_YES && position.yes_amount > 0) {
            let total_pool = market.yes_pool + market.no_pool;
            let winner_share = (position.yes_amount as u128) * (total_pool as u128) / (market.yes_pool as u128);
            winnings = (winner_share as u64);
            
            // Reset position after claiming
            position.yes_amount = 0;
        } else if (market.resolved_outcome == OUTCOME_NO && position.no_amount > 0) {
            let total_pool = market.yes_pool + market.no_pool;
            let winner_share = (position.no_amount as u128) * (total_pool as u128) / (market.no_pool as u128);
            winnings = (winner_share as u64);
            
            // Reset position after claiming
            position.no_amount = 0;
        };
        
        // Note: In a real implementation, you would transfer coins here
        // For simplicity, we're just calculating the winnings
    }
}