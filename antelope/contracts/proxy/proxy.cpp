#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include "./shared.hpp"
#include "../library/totems.hpp"

using namespace eosio;
using std::string;

CONTRACT proxy : public contract {
   public:
    using contract::contract;

    struct [[eosio::table]] Proxy {
        symbol_code ticker;
        std::vector<name> transfer;
        std::vector<name> mint;
        std::vector<name> burn;
        std::vector<name> open;
        std::vector<name> close;
        std::vector<name> created;
		uint64_t primary_key() const { return ticker.raw(); }
    };

    typedef eosio::multi_index<"proxies"_n, Proxy> proxy_table;
    typedef eosio::multi_index<"licenses"_n, totems::License> license_table;

    [[eosio::action]]
    void add(
        const symbol_code& ticker,
        const std::vector<name>& hooks,
        const name& mod
    ){
        require_auth(totems::get_totem_creator(ticker));
        check(hooks.size() > 0, "At least one hook must be provided");

        auto _mod = totems::get_mod(mod);
        check(_mod.has_value(), "Mod is not published in market");
        for(const auto& hook : hooks){
			check(_mod.value().has_hook(hook), "Mod does not support required hook: " + hook.to_string());
		}
        auto price = _mod.value().price;
        if(price > 0){
            shared::ensure_tokens_available(price, get_self());
            shared::dispense_tokens(get_self(), {
				shared::FeeDisbursement{
					.recipient = _mod.value().seller,
					.amount = price
				}
			});
        }

        totems::license_table licenses(get_self(), ticker.raw());
        auto it_license = licenses.find(mod.value);
        if(it_license == licenses.end()){
			licenses.emplace(get_self(), [&](auto& row){
				row.mod = mod;
			});
		}

        proxy_table proxies(get_self(), get_self().value);
        auto it = proxies.find(ticker.raw());

        if(it == proxies.end()){
            proxies.emplace(get_self(), [&](auto& row) {
                row.ticker = ticker;
                row.transfer = {};
                row.mint = {};
                row.burn = {};
                row.open = {};
                row.close = {};
                row.created = {};

                for(const auto& hook : hooks){
                    add_mod_to_row(row, hook, mod);
                }
            });
        } else {
            proxies.modify(it, get_self(), [&](auto& row) {
                for(const auto& hook : hooks){
                    add_mod_to_row(row, hook, mod);
                }
            });
        }
    }

	[[eosio::action]]
	void remove(const symbol_code& ticker, const name& hook, const name& mod){
		require_auth(totems::get_totem_creator(ticker));

		proxy_table proxies(get_self(), get_self().value);
		auto it = proxies.find(ticker.raw());
		check(it != proxies.end(), "No proxy configuration for this totem ticker");

		proxies.modify(it, get_self(), [&](auto& row) {
			remove_mod_from_row(row, hook, mod);
		});
	}

	[[eosio::on_notify(TOTEMS_TRANSFER_NOTIFY)]]
	void on_transfer(const name& from, const name& to, const asset& quantity, const string& memo){
		if(from == get_self() || to == get_self()){
			return;
		}

		proxy_table proxies(get_self(), get_self().value);
		auto it = proxies.find(quantity.symbol.code().raw());
		if(it != proxies.end()){
			notify_mods(it->transfer);
		}
	}

	[[eosio::on_notify(TOTEMS_MINT_NOTIFY)]]
	void on_mint(const name& mod, const name& minter, const asset& quantity, const asset& payment, const std::string& memo){
		proxy_table proxies(get_self(), get_self().value);
        auto it = proxies.find(quantity.symbol.code().raw());
        if(it != proxies.end()){
            notify_mods(it->mint);
        }
	}

	[[eosio::on_notify(TOTEMS_BURN_NOTIFY)]]
	void on_burn(const name& owner, const asset& quantity, const string& memo){
		proxy_table proxies(get_self(), get_self().value);
        auto it = proxies.find(quantity.symbol.code().raw());
        if(it != proxies.end()){
            notify_mods(it->burn);
        }
	}

	[[eosio::on_notify(TOTEMS_OPEN_NOTIFY)]]
	void on_open(const name& owner, const symbol& ticker, const name& ram_payer){
		proxy_table proxies(get_self(), get_self().value);
		auto it = proxies.find(ticker.code().raw());
		if(it != proxies.end()){
			notify_mods(it->open);
		}
	}

	[[eosio::on_notify(TOTEMS_CLOSE_NOTIFY)]]
	void on_close(const name& owner, const symbol& ticker){
		proxy_table proxies(get_self(), get_self().value);
		auto it = proxies.find(ticker.code().raw());
		if(it != proxies.end()){
			notify_mods(it->close);
		}
	}

	[[eosio::on_notify(TOTEMS_CREATED_NOTIFY)]]
	void on_created(const name& creator, const symbol& ticker){
		proxy_table proxies(get_self(), get_self().value);
		auto it = proxies.find(ticker.code().raw());
		if(it != proxies.end()){
			notify_mods(it->created);
		}
	}

	[[eosio::on_notify("eosio.token::transfer")]]
	void on_eos_transfer(const name& from, const name& to, const asset& quantity, const std::string& memo){
	    shared::on_eos_transfer(get_self(), from, to, quantity, std::move(memo));
	}

private:
	void add_mod_to_row(Proxy& row, const name& hook, const name& mod){
        if(hook == "transfer"_n) add_unique(row.transfer, mod);
        else if(hook == "mint"_n) add_unique(row.mint, mod);
        else if(hook == "burn"_n) add_unique(row.burn, mod);
        else if(hook == "open"_n) add_unique(row.open, mod);
        else if(hook == "close"_n) add_unique(row.close, mod);
        else if(hook == "created"_n) add_unique(row.created, mod);
        else check(false, "Invalid hook name");
    }

    void add_unique(std::vector<name>& vec, const name& mod){
		if(std::find(vec.begin(), vec.end(), mod) == vec.end()){
			vec.push_back(mod);
		}
	}


	void remove_mod_from_row(Proxy& row, const name& hook, const name& mod){
		if(hook == "transfer"_n) remove_mod_from_vector(row.transfer, mod);
		else if(hook == "mint"_n) remove_mod_from_vector(row.mint, mod);
		else if(hook == "burn"_n) remove_mod_from_vector(row.burn, mod);
		else if(hook == "open"_n) remove_mod_from_vector(row.open, mod);
		else if(hook == "close"_n) remove_mod_from_vector(row.close, mod);
		else if(hook == "created"_n) remove_mod_from_vector(row.created, mod);
		else check(false, "Invalid hook name");
	}

	void remove_mod_from_vector(std::vector<name>& vec, const name& mod){
		auto it = std::find(vec.begin(), vec.end(), mod);
		if(it != vec.end()){
			vec.erase(it);
		}
	}

	void notify_mods(const std::vector<name>& mods) {
		for (const auto& mod : mods) {
			require_recipient(mod);
		}
    }
};