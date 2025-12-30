#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/crypto.hpp>

#include "../library/totems.hpp"
using namespace eosio;

CONTRACT wrapper : public contract {
   public:
    using contract::contract;

    struct [[eosio::table]] Pairing {
        uint64_t id;
		symbol totem_ticker;
		symbol wrappable_ticker;
		// this is the contract of the other token, one contract is always TOTEMS
		name contract;
		uint64_t primary_key() const { return id; }
		checksum256 by_pair() const { return get_pair_key(totem_ticker, wrappable_ticker, contract); }
	};

    struct [[eosio::table]] Balances {
        // matches the pairing id
        uint64_t id;
        asset balance_totem;
        asset balance_wrappable;
        uint64_t primary_key() const { return id; }
    };

    typedef eosio::multi_index<"balances"_n, Balances> balances_table;
    typedef eosio::multi_index<"pairings"_n, Pairing,
    		indexed_by<"bypair"_n, const_mem_fun<Pairing, checksum256, &Pairing::by_pair>>> pairings_table;

    [[eosio::action]]
    void setup(const symbol& totem_ticker, const symbol& wrappable_ticker, const name& wrappable_contract) {
        check(totem_ticker != wrappable_ticker, "Tickers must be different");
        check(totem_ticker.precision() == wrappable_ticker.precision(), "Tickers must have the same precision");
        check(is_account(wrappable_contract), "Wrappable contract account does not exist");



		pairings_table pairings(get_self(), get_self().value);
		balances_table balances(get_self(), get_self().value);

		auto pair_idx = pairings.get_index<"bypair"_n>();
        auto pair_key = get_pair_key(totem_ticker, wrappable_ticker, wrappable_contract);
        auto pair_itr = pair_idx.find(pair_key);
        check(pair_itr == pair_idx.end(), "Pairing for this ticker already exists");

		uint64_t id = pairings.available_primary_key();
		auto balance = totems::get_balance(get_self(), totem_ticker);
		balances.emplace(get_self(), [&](auto& row) {
			row.id = id;
			row.balance_totem = balance;
			row.balance_wrappable = asset{0, wrappable_ticker};
		});

		pairings.emplace(get_self(), [&](auto& row) {
			row.id = id;
			row.totem_ticker = totem_ticker;
			row.wrappable_ticker = wrappable_ticker;
			row.contract = wrappable_contract;
		});
    }

    // quantity is totem ticker, memo is wrappable ticker
    [[eosio::action]]
    void mint(const name& mod, const name& minter, const asset& quantity, const asset& payment, const std::string& memo) {
        symbol totem_ticker = quantity.symbol;
        std::pair<symbol, name> parsed = parse_memo(memo);
        symbol wrappable_ticker = parsed.first;
        name contract = parsed.second;
        
        pairings_table pairings(get_self(), get_self().value);
        auto pair_idx = pairings.get_index<"bypair"_n>();
        auto pair_key = get_pair_key(totem_ticker, wrappable_ticker, contract);
        auto pair_itr = pair_idx.find(pair_key);
        check(pair_itr != pair_idx.end(), "No pairing exists for the given tickers");
        
        balances_table balances(get_self(), get_self().value);
        auto balances_itr = balances.find(pair_itr->id);
        check(balances_itr != balances.end(), "Balance not found for pairing");

		asset unregistered_balance = totems::get_balance(get_self(), wrappable_ticker, contract);
		auto delta = unregistered_balance - balances_itr->balance_wrappable;
		check(delta.amount > 0, "No new wrappable tokens deposited for wrapping");
		check(delta.symbol == wrappable_ticker, "Unregistered balance symbol mismatch");
		balances.modify(balances_itr, get_self(), [&](auto& row) {
			row.balance_wrappable += delta;
			row.balance_totem -= asset{delta.amount, totem_ticker};
		});

		totems::transfer(
			get_self(),
			minter,
			asset{delta.amount, totem_ticker},
			std::string("Wrapped tokens")
		);
    }

    [[eosio::on_notify(TOTEMS_MINT_NOTIFY)]]
    void on_mint(const name& mod, const name& minter, const asset& quantity, const asset& payment, const std::string& memo) {}


	// transfer to this contract swap back to wrappable
    [[eosio::on_notify(TOTEMS_TRANSFER_NOTIFY)]]
    void on_incoming(const name& from, const name& to, const asset& quantity, const std::string& memo) {
        if (to != get_self() || from == get_self()) {
            return;
        }

        symbol totem_ticker = quantity.symbol;
        std::pair<symbol, name> parsed = parse_memo(memo);
        symbol wrappable_ticker = parsed.first;
        name contract = parsed.second;

        pairings_table pairings(get_self(), get_self().value);
        auto pair_idx = pairings.get_index<"bypair"_n>();
        auto pair_key = get_pair_key(totem_ticker, wrappable_ticker, contract);
        auto pair_itr = pair_idx.find(pair_key);
        check(pair_itr != pair_idx.end(), "No pairing exists for the given tickers");

        balances_table balances(get_self(), get_self().value);
        auto balances_itr = balances.find(pair_itr->id);
        check(balances_itr != balances.end(), "Balance not found for pairing");

//         asset unregistered_balance = totems::get_balance(get_self(), totem_ticker);
//         auto delta = unregistered_balance - balances_itr->balance_totem;

		check(balances_itr->balance_wrappable.amount >= quantity.amount, "Insufficient wrapped totem balance for unwrapping: " + balances_itr->balance_wrappable.to_string() + " available, " + balances_itr->balance_totem.to_string() + " to unwrap");
		balances.modify(balances_itr, get_self(), [&](auto& row) {
			row.balance_wrappable -= asset{quantity.amount, wrappable_ticker};
			row.balance_totem += asset{quantity.amount, totem_ticker};
		});

		totems::transfer(
			get_self(),
			from,
			asset{quantity.amount, wrappable_ticker},
			std::string("Unwrapped tokens"),
			contract
		);
    }

private:
    static checksum256 get_pair_key(const symbol& a, const symbol& b, const name& contract) {
        uint64_t high = std::max(a.code().raw(), b.code().raw());
        uint64_t low  = std::min(a.code().raw(), b.code().raw());

        std::array<char, sizeof(uint64_t) * 2 + sizeof(name)> buf{};
        size_t offset = 0;

        memcpy(buf.data() + offset, &high, sizeof(high));
        offset += sizeof(high);
        memcpy(buf.data() + offset, &low, sizeof(low));
        offset += sizeof(low);
        memcpy(buf.data() + offset, &contract, sizeof(contract));

        return sha256(buf.data(), buf.size());
    }

    std::pair<symbol, name> parse_memo(const std::string& memo) {
        // Expected: DECIMALS,TICKER,CONTRACT

        size_t first = memo.find(',');
        check(first != std::string::npos, "Invalid memo format");

        size_t second = memo.find(',', first + 1);
        check(second != std::string::npos, "Invalid memo format");

        uint8_t decimals = static_cast<uint8_t>(
            std::stoi(memo.substr(0, first))
        );

        std::string ticker = memo.substr(
            first + 1,
            second - first - 1
        );

        std::string contract_str = memo.substr(second + 1);

        check(decimals <= 18, "Invalid symbol precision");
        check(!ticker.empty() && ticker.size() <= 7, "Invalid symbol name");

        return {
            symbol(symbol_code(ticker), decimals),
            name(contract_str)
        };
    }
};