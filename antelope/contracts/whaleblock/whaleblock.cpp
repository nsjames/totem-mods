#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>

#include "../library/totems.hpp"
using namespace eosio;

CONTRACT whaleblock : public contract {
   public:
    using contract::contract;

    struct [[eosio::table]] TotemConfig {
        symbol_code ticker;
        uint8_t max_holdings_percent; // e.g. 5 for 5%, 0 to disable
        uint64_t max_totem_cap; // e.g. 10'0000 for 10 with 4 decimals, 0 to disable

        uint64_t primary_key() const { return ticker.raw(); }
    };

    typedef eosio::multi_index<"totems"_n, TotemConfig> configs_table;

    [[eosio::action]]
    void configure(const symbol_code& ticker, const uint8_t& max_holdings_percent, const uint64_t& max_totem_cap) {
		require_auth(totems::get_totem_creator(ticker));
		check(max_holdings_percent <= 100, "max_holdings_percent must be between 0 and 100");

		configs_table configs(get_self(), get_self().value);
		auto config = configs.find(ticker.raw());

		if(max_holdings_percent == 0 && max_totem_cap == 0){
			// remove caps
			if (config != configs.end()) {
				configs.erase(config);
			}
		} else {

			check(
                !(max_holdings_percent > 0 && max_totem_cap > 0),
                "Cannot set both max_holdings_percent and max_totem_cap at the same time"
            );

			if (config == configs.end()) {
                configs.emplace(get_self(), [&](auto& row) {
                    row.ticker = ticker;
                    row.max_holdings_percent = max_holdings_percent;
                    row.max_totem_cap = max_totem_cap;
                });
            } else {
                configs.modify(config, get_self(), [&](auto& row) {
                    row.max_holdings_percent = max_holdings_percent;
                    row.max_totem_cap = max_totem_cap;
                });
            }
		}
	}

    [[eosio::on_notify(TOTEMS_MINT_NOTIFY)]]
    void on_mint(const name& mod, const name& minter, const asset& quantity, const asset& payment, const std::string& memo) {
		totems::check_license(quantity.symbol.code(), get_self());

		check_whale(quantity, minter);
	}


    [[eosio::on_notify(TOTEMS_TRANSFER_NOTIFY)]]
    void on_transfer(name from, name to, asset quantity, std::string memo) {
        totems::check_license(quantity.symbol.code(), get_self());
        if (from == get_self() || to == get_self()) {
            return;
        }

        check_whale(quantity, to);
    }

private:
	void check_whale(const asset& quantity, const name& account){
		configs_table configs(get_self(), get_self().value);
        auto config = configs.find(quantity.symbol.code().raw());
        if (config != configs.end()) {
            auto balance = totems::get_balance(account, quantity.symbol);
            if (config->max_holdings_percent > 0) {
                auto totem = totems::get_totem(quantity.symbol.code());
                check(totem.has_value(), "Totem does not exist");
                int64_t max_holdings =
                    static_cast<int64_t>(
                        ( (__int128) totem->max_supply.amount * config->max_holdings_percent ) / 100
                    );
                check(balance.amount <= max_holdings, "No whales allowed.");
            }
            if (config->max_totem_cap > 0) {
                check(balance.amount <= static_cast<int64_t>(config->max_totem_cap), "No whales allowed.");
            }
        }
	}
};