#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>

#include "../library/totems.hpp"
using namespace eosio;
using std::string;

CONTRACT scamdefender : public contract {
   public:
    using contract::contract;

    struct [[eosio::table]] BlockedAccount {
        name account;
        time_point_sec blocked_at;
		uint64_t primary_key() const { return account.value; }
    };

    typedef eosio::multi_index<"blocked"_n, BlockedAccount> blocked_table;

    [[eosio::action]]
    void block(const symbol_code& ticker, const name& account){
		require_auth(get_self());

		blocked_table blocked(get_self(), get_self().value);
		auto it = blocked.find(account.value);
		check(it == blocked.end(), "Account is already blocked for this totem");
		blocked.emplace(get_self(), [&](auto& row) {
			row.account = account;
			row.blocked_at = time_point_sec(current_time_point());
		});
	}

	[[eosio::action]]
	void unblock(const symbol_code& ticker, const name& account){
		require_auth(get_self());

		blocked_table blocked(get_self(), get_self().value);
		auto it = blocked.find(account.value);
		check(it != blocked.end(), "Account is not blocked for this totem");
		blocked.erase(it);
	}

	[[eosio::on_notify(TOTEMS_TRANSFER_NOTIFY)]]
	void on_transfer(const name& from, const name& to, const asset& quantity, const string& memo){
		totems::check_license(quantity.symbol.code(), get_self());
		if(from == get_self() || to == get_self()){
			return;
		}

		blocked_table blocked(get_self(), get_self().value);
		auto from_it = blocked.find(from.value);
		check(from_it == blocked.end(), "blocked!");
		auto to_it = blocked.find(to.value);
		check(to_it == blocked.end(), "blocked!");
	}

	[[eosio::on_notify(TOTEMS_MINT_NOTIFY)]]
	void on_mint(const name& mod, const name& minter, const asset& quantity, const asset& payment, const std::string& memo){
		totems::check_license(quantity.symbol.code(), get_self());
		blocked_table blocked(get_self(), get_self().value);
		auto minter_it = blocked.find(minter.value);
		check(minter_it == blocked.end(), "blocked!");
	}

	[[eosio::on_notify(TOTEMS_BURN_NOTIFY)]]
	void on_burn(const name& owner, const asset& quantity, const string& memo){
		totems::check_license(quantity.symbol.code(), get_self());
		blocked_table blocked(get_self(), get_self().value);
		auto owner_it = blocked.find(owner.value);
		check(owner_it == blocked.end(), "blocked!");
	}
};