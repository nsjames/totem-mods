#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>

#include "../library/totems.hpp"
using namespace eosio;
using std::string;

CONTRACT innercircle : public contract {
   public:
    using contract::contract;


    struct [[eosio::table]] Member {
        name account;
		uint64_t primary_key() const { return account.value; }
    };

    typedef eosio::multi_index<"members"_n, Member> members_table;

    [[eosio::action]]
    void togglemember(const symbol_code& ticker, const name& sponsor, const name& account){
        require_auth(sponsor);

		members_table members(get_self(), ticker.raw());
		auto creator = totems::get_totem_creator(ticker);
		if(creator != sponsor){
			auto it = members.find(sponsor.value);
			check(it != members.end(), sponsor.to_string() + " cannot sponsor membership!");
		}

		auto it = members.find(account.value);
		if(it == members.end()){
			members.emplace(get_self(), [&](auto& row) {
				row.account = account;
			});
		} else {
			check(sponsor == creator, "Only the totem creator can remove members!");
			members.erase(it);
		}
	}

	[[eosio::on_notify(TOTEMS_TRANSFER_NOTIFY)]]
	void on_transfer(const name& from, const name& to, const asset& quantity, const string& memo){
		totems::check_license(quantity.symbol.code(), get_self());
		if(from == get_self() || to == get_self()){
			return;
		}

		auto creator = totems::get_totem_creator(quantity.symbol.code());
		if(from == creator || to == creator){
			return;
		}

		// all minter mods are able to transfer
		auto totem = totems::get_totem(quantity.symbol.code());
		for(const auto& alloc : totem->allocations){
			if(alloc.recipient == from || alloc.recipient == to){
				if(alloc.is_minter) return;
			}
		}

		members_table members(get_self(), quantity.symbol.code().raw());
		auto from_it = members.find(from.value);
		check(from_it != members.end(), from.to_string() + " is not a member!");
		auto to_it = members.find(to.value);
		check(to_it != members.end(), to.to_string() + " is not a member!");
	}

	[[eosio::on_notify(TOTEMS_MINT_NOTIFY)]]
	void on_mint(const name& mod, const name& minter, const asset& quantity, const asset& payment, const std::string& memo){
		totems::check_license(quantity.symbol.code(), get_self());
		auto creator = totems::get_totem_creator(quantity.symbol.code());
		if(minter == creator){
			return;
		}

		members_table members(get_self(), quantity.symbol.code().raw());
		auto minter_it = members.find(minter.value);
		check(minter_it != members.end(), minter.to_string() + " is not a member!");
	}

	[[eosio::on_notify(TOTEMS_BURN_NOTIFY)]]
	void on_burn(const name& owner, const asset& quantity, const string& memo){
		totems::check_license(quantity.symbol.code(), get_self());
		auto creator = totems::get_totem_creator(quantity.symbol.code());
		if(owner == creator){
			return;
		}

		members_table members(get_self(), quantity.symbol.code().raw());
		auto owner_it = members.find(owner.value);
		check(owner_it != members.end(), owner.to_string() + " is not a member!");
	}
};