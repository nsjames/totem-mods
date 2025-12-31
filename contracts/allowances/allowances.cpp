#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

#include "../library/totems.hpp"
using namespace eosio;

CONTRACT allowances : public contract {
   public:
    using contract::contract;

    struct [[eosio::table]] Allowance {
        uint64_t id;
		name owner;
		name spender;
		asset allowance;

		uint64_t primary_key() const { return id; }
		uint128_t by_owner_spender() const { return get_owner_spender_key(owner, spender); }
	};

    typedef eosio::multi_index<"accounts"_n, totems::Balance> balances_table;
	typedef eosio::multi_index<"allowances"_n, Allowance,
		indexed_by<"byownerspndr"_n, const_mem_fun<Allowance, uint128_t, &Allowance::by_owner_spender>>
	> allowances_table;

    [[eosio::action]]
    void open(const name& owner, const symbol& ticker) {
        totems::check_license(ticker.code(), get_self());

        require_auth(owner);

        balances_table balances(get_self(), owner.value);
        auto it = balances.find(ticker.code().raw());
        if (it == balances.end()) {
			balances.emplace(owner, [&](auto& a) { a.balance = asset{0, ticker}; });
		}
    }

    [[eosio::action]]
    void approve(const name& owner, const name& spender, const asset& quantity) {
		totems::check_license(quantity.symbol.code(), get_self());

		require_auth(owner);
		check(is_account(spender), "Spender account does not exist.");
		check(quantity.is_valid(), "Invalid quantity.");
		check(quantity.amount >= 0, "Cannot approve negative amount.");

		allowances_table allowances(get_self(), quantity.symbol.code().raw());
		auto index = allowances.get_index<"byownerspndr"_n>();
		auto it = index.find(get_owner_spender_key(owner, spender));
		if (it == index.end()) {
			allowances.emplace(owner, [&](auto& row) {
				row.id = allowances.available_primary_key();
				row.owner = owner;
				row.spender = spender;
				row.allowance = quantity;
			});
		} else {
			if(quantity.amount > 0){
				index.modify(it, owner, [&](auto& row) {
					row.allowance = quantity;
				});
			} else {
				index.erase(it);
			}
		}
	}

	[[eosio::action]]
	void spend(const name& owner, const name& spender, const name& recipient, const asset& quantity,const std::string& memo){
		totems::check_license(quantity.symbol.code(), get_self());

		require_auth(spender);
		check(quantity.is_valid(), "Invalid quantity.");
		check(quantity.amount > 0, "Cannot spend negative amount.");

		allowances_table allowances(get_self(), quantity.symbol.code().raw());
		auto index = allowances.get_index<"byownerspndr"_n>();
		auto it = index.find(get_owner_spender_key(owner, spender));
		check(it != index.end(), "No allowance found for this spender.");
		check(it->allowance.amount >= quantity.amount, "Insufficient allowance to spend.");

		index.modify(it, same_payer, [&](auto& row) {
			row.allowance -= quantity;
		});

		balances_table balances(get_self(), owner.value);
		auto bal_it = balances.find(quantity.symbol.code().raw());
		check(bal_it != balances.end(), "Owner has no balance for this totem.");
		check(bal_it->balance.amount >= quantity.amount, "Owner has insufficient balance.");

		balances.modify(bal_it, same_payer, [&](auto& row) {
			row.balance -= quantity;
		});

		totems::transfer(
			get_self(),
			recipient,
			quantity,
			std::move(memo)
		);
	}

	[[eosio::action]]
	void withdraw(const name& owner, const asset& quantity, const std::string& memo){
		totems::check_license(quantity.symbol.code(), get_self());

		require_auth(owner);
		check(quantity.is_valid(), "Invalid quantity.");
		check(quantity.amount > 0, "Cannot withdraw negative amount.");

		balances_table balances(get_self(), owner.value);
		auto it = balances.find(quantity.symbol.code().raw());
		check(it != balances.end(), "You have no balance for this totem.");
		check(it->balance.amount >= quantity.amount, "Insufficient balance to withdraw.");

		balances.modify(it, same_payer, [&](auto& row) {
			row.balance -= quantity;
		});

		totems::transfer(
			get_self(),
			owner,
			quantity,
			std::move(memo)
		);
	}

	[[eosio::action, eosio::read_only]]
	asset getallowance(const name& owner, const name& spender, const symbol& ticker){
		allowances_table allowances(get_self(), ticker.code().raw());
		auto index = allowances.get_index<"byownerspndr"_n>();
		auto it = index.find(get_owner_spender_key(owner, spender));
		if(it != index.end() && it->owner == owner){
			return it->allowance;
		}
		return asset{0, ticker};
	}

	[[eosio::action, eosio::read_only]]
	bool isopen(const name& owner, const symbol& ticker){
		balances_table balances(get_self(), owner.value);
		auto it = balances.find(ticker.code().raw());
		return it != balances.end();
	}

	[[eosio::action, eosio::read_only]]
	asset getbalance(const name& owner, const symbol& ticker){
		balances_table balances(get_self(), owner.value);
		auto it = balances.find(ticker.code().raw());
		if(it != balances.end()){
			return it->balance;
		}
		return asset{0, ticker};
	}

    [[eosio::on_notify(TOTEMS_TRANSFER_NOTIFY)]]
    void on_transfer(const name& from, const name& to, const asset& quantity, const std::string& memo) {
        totems::check_license(quantity.symbol.code(), get_self());
        if (from == get_self()) {
			return;
		}

		if(to == get_self()){
			balances_table balances(get_self(), from.value);
			auto it = balances.find(quantity.symbol.code().raw());
			check(it != balances.end(), "You must open a balance first.");
			balances.modify(it, same_payer, [&](auto& a) { a.balance += quantity; });
		}
    }

private:
	static uint128_t get_owner_spender_key(const name& owner, const name& spender) {
		return (uint128_t{owner.value} << 64) | spender.value;
	}
};