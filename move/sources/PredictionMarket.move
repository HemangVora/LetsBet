module PredictionMarket::prediction_market {
    use std::string::String;
    use aptos_framework::account::{Self, SignerCapability};
    use aptos_framework::coin;
    use aptos_std::table::{Self, Table};
    use std::signer;
    use aptos_framework::aptos_coin::AptosCoin;
    use std::vector;

    // Error codes
    const E_MARKET_NOT_FOUND: u64 = 1;
    const E_MARKET_ALREADY_RESOLVED: u64 = 2;
    const E_MARKET_NOT_RESOLVED: u64 = 3;
    const E_INSUFFICIENT_BALANCE: u64 = 4;
    const E_NOT_MARKET_CREATOR: u64 = 5;
    const E_INVALID_OUTCOME: u64 = 6;

    // Market status
    const MARKET_ACTIVE: u8 = 0;
    const MARKET_RESOLVED: u8 = 1;

    struct Market has store {
        creator: address,
        question: String,
        description: String,
        end_time: u64,
        total_yes_amount: u64,
        total_no_amount: u64,
        outcome: u8, // 0 = unresolved, 1 = yes, 2 = no
        status: u8
    }

    struct MarketInfo has copy, drop {
        id: u64,
        question: String,
        description: String,
        end_time: u64,
        total_yes_amount: u64,
        total_no_amount: u64,
        outcome: u8,
        status: u8
    }

    struct UserPosition has store {
        yes_amount: u64,
        no_amount: u64
    }

    struct PredictionMarketState has key {
        markets: Table<u64, Market>,
        market_count: u64,
        positions: Table<address, Table<u64, UserPosition>>,
        signer_cap: SignerCapability
    }

    fun init_module(account: &signer) {
        // Create a resource account for handling funds
        let (resource_signer, signer_cap) =
            account::create_resource_account(account, b"prediction_market_seed");

        move_to(
            account,
            PredictionMarketState {
                markets: table::new(),
                market_count: 0,
                positions: table::new(),
                signer_cap
            }
        );
    }

    public entry fun create_market(
        creator: &signer,
        question: String,
        description: String,
        end_time: u64
    ) acquires PredictionMarketState {
        let state = borrow_global_mut<PredictionMarketState>(@PredictionMarket);
        let market_id = state.market_count + 1;

        let market = Market {
            creator: signer::address_of(creator),
            question,
            description,
            end_time,
            total_yes_amount: 0,
            total_no_amount: 0,
            outcome: 0,
            status: MARKET_ACTIVE
        };

        table::add(&mut state.markets, market_id, market);
        state.market_count = market_id;
    }

    public entry fun place_bet(
        bettor: &signer,
        market_id: u64,
        is_yes: bool,
        amount: u64
    ) acquires PredictionMarketState {
        let state = borrow_global_mut<PredictionMarketState>(@PredictionMarket);
        assert!(table::contains(&state.markets, market_id), E_MARKET_NOT_FOUND);

        let market = table::borrow_mut(&mut state.markets, market_id);
        assert!(market.status == MARKET_ACTIVE, E_MARKET_ALREADY_RESOLVED);

        let bettor_addr = signer::address_of(bettor);

        // Transfer APT tokens from bettor to contract
        coin::transfer<AptosCoin>(bettor, @PredictionMarket, amount);

        // Update market totals
        if (is_yes) {
            market.total_yes_amount = market.total_yes_amount + amount;
        } else {
            market.total_no_amount = market.total_no_amount + amount;
        };

        // Update user position
        if (!table::contains(&state.positions, bettor_addr)) {
            table::add(&mut state.positions, bettor_addr, table::new());
        };

        let positions = table::borrow_mut(&mut state.positions, bettor_addr);
        if (!table::contains(positions, market_id)) {
            table::add(
                positions,
                market_id,
                UserPosition { yes_amount: 0, no_amount: 0 }
            );
        };

        let position = table::borrow_mut(positions, market_id);
        if (is_yes) {
            position.yes_amount = position.yes_amount + amount;
        } else {
            position.no_amount = position.no_amount + amount;
        };
    }

    public entry fun resolve_market(
        creator: &signer, market_id: u64, outcome: u8
    ) acquires PredictionMarketState {
        let state = borrow_global_mut<PredictionMarketState>(@PredictionMarket);
        assert!(table::contains(&state.markets, market_id), E_MARKET_NOT_FOUND);

        let market = table::borrow_mut(&mut state.markets, market_id);
        assert!(signer::address_of(creator) == market.creator, E_NOT_MARKET_CREATOR);
        assert!(market.status == MARKET_ACTIVE, E_MARKET_ALREADY_RESOLVED);
        assert!(outcome == 1 || outcome == 2, E_INVALID_OUTCOME);

        market.outcome = outcome;
        market.status = MARKET_RESOLVED;
    }

    public entry fun claim_winnings(bettor: &signer, market_id: u64) acquires PredictionMarketState {
        let state = borrow_global_mut<PredictionMarketState>(@PredictionMarket);
        assert!(table::contains(&state.markets, market_id), E_MARKET_NOT_FOUND);

        let market = table::borrow_mut(&mut state.markets, market_id);
        assert!(market.status == MARKET_RESOLVED, E_MARKET_NOT_RESOLVED);

        let bettor_addr = signer::address_of(bettor);
        assert!(table::contains(&state.positions, bettor_addr), E_MARKET_NOT_FOUND);

        let positions = table::borrow_mut(&mut state.positions, bettor_addr);
        assert!(table::contains(positions, market_id), E_MARKET_NOT_FOUND);

        let position = table::borrow_mut(positions, market_id);
        let winning_amount =
            if (market.outcome == 1) {
                // Yes won
                if (position.yes_amount > 0) {
                    let total_pool = market.total_yes_amount + market.total_no_amount;
                    let share =
                        (position.yes_amount as u128) * (total_pool as u128)
                            / (market.total_yes_amount as u128);
                    (share as u64)
                } else { 0 }
            } else {
                // No won
                if (position.no_amount > 0) {
                    let total_pool = market.total_yes_amount + market.total_no_amount;
                    let share =
                        (position.no_amount as u128) * (total_pool as u128)
                            / (market.total_no_amount as u128);
                    (share as u64)
                } else { 0 }
            };

        if (winning_amount > 0) {
            let resource_signer =
                account::create_signer_with_capability(&state.signer_cap);
            coin::transfer<AptosCoin>(&resource_signer, bettor_addr, winning_amount);
        };

        // Reset position after claiming
        position.yes_amount = 0;
        position.no_amount = 0;
    }

    #[view]
    public fun get_market(
        market_id: u64
    ): (String, String, u64, u64, u64, u8, u8) acquires PredictionMarketState {
        let state = borrow_global<PredictionMarketState>(@PredictionMarket);
        assert!(table::contains(&state.markets, market_id), E_MARKET_NOT_FOUND);

        let market = table::borrow(&state.markets, market_id);
        (
            market.question,
            market.description,
            market.end_time,
            market.total_yes_amount,
            market.total_no_amount,
            market.outcome,
            market.status
        )
    }

    #[view]
    public fun get_user_position(
        user: address, market_id: u64
    ): (u64, u64) acquires PredictionMarketState {
        let state = borrow_global<PredictionMarketState>(@PredictionMarket);
        assert!(table::contains(&state.positions, user), E_MARKET_NOT_FOUND);

        let positions = table::borrow(&state.positions, user);
        assert!(table::contains(positions, market_id), E_MARKET_NOT_FOUND);

        let position = table::borrow(positions, market_id);
        (position.yes_amount, position.no_amount)
    }

    #[view]
    public fun get_all_markets(): vector<u64> acquires PredictionMarketState {
        let state = borrow_global<PredictionMarketState>(@PredictionMarket);
        let market_ids = vector::empty();
        let i = 1;

        while (i <= state.market_count) {
            if (table::contains(&state.markets, i)) {
                vector::push_back(&mut market_ids, i);
            };
            i = i + 1;
        };

        market_ids
    }

    #[view]
    public fun get_all_markets_data(): vector<MarketInfo> acquires PredictionMarketState {
        let state = borrow_global<PredictionMarketState>(@PredictionMarket);
        let markets_info = vector::empty<MarketInfo>();
        let i = 1;

        while (i <= state.market_count) {
            if (table::contains(&state.markets, i)) {
                let market = table::borrow(&state.markets, i);
                let market_info = MarketInfo {
                    id: i,
                    question: market.question,
                    description: market.description,
                    end_time: market.end_time,
                    total_yes_amount: market.total_yes_amount,
                    total_no_amount: market.total_no_amount,
                    outcome: market.outcome,
                    status: market.status
                };
                vector::push_back(&mut markets_info, market_info);
            };
            i = i + 1;
        };

        markets_info
    }
}
