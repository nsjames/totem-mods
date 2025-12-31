#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include <eosio/transaction.hpp>

#include "../library/totems.hpp"
using namespace eosio;

CONTRACT miner : public contract {
   public:
    using contract::contract;

    struct [[eosio::table]] Config {
        symbol_code ticker;
        uint64_t totems_per_mine;
        uint64_t max_mines_per_day;
        uint64_t mined_today;
        time_point_sec last_mine_reset;
        uint64_t primary_key() const { return ticker.raw(); }
    };

    typedef eosio::multi_index<"config"_n, Config> config_table;

    [[eosio::action]]
    void configure(const symbol_code& ticker, const uint64_t& totems_per_mine, const uint64_t& max_mines_per_day) {
        check(totems_per_mine > 0, "totems_per_mine must be greater than 0");

		require_auth(totems::get_totem_creator(ticker));
		config_table configs(get_self(), get_self().value);
		auto config = configs.find(ticker.raw());
		if (config == configs.end()) {
			configs.emplace(get_self(), [&](auto& row) {
				row.ticker = ticker;
				row.totems_per_mine = totems_per_mine;
				row.max_mines_per_day = max_mines_per_day;
				row.mined_today = 0;
				row.last_mine_reset = time_point_sec(current_time_point());
			});
		} else {
			configs.modify(config, get_self(), [&](auto& row) {
				row.totems_per_mine = totems_per_mine;
				row.max_mines_per_day = max_mines_per_day;
			});
		}
	}

	[[eosio::action]]
	void mint(const name& mod, const name& minter, const asset& quantity, const asset& payment, const std::string& memo) {
		check(get_sender() == totems::TOTEMS_CONTRACT, "mint action can only be called by totems contract");
		totems::check_license(quantity.symbol.code(), get_self());
		check(payment.amount == 0, "Miner mod does not accept payment");

		auto totem = totems::get_totem(quantity.symbol.code());
		check(totem.has_value(), "Totem does not exist for this ticker");

		config_table configs(get_self(), get_self().value);
		auto config = configs.find(quantity.symbol.code().raw());
		check(config != configs.end(), "No mining configuration for this totem ticker");

		time_point_sec current_time = time_point_sec(current_time_point());
		if (current_time.sec_since_epoch() - config->last_mine_reset.sec_since_epoch() >= 86400) {
			configs.modify(config, get_self(), [&](auto& row) {
				row.mined_today = 0;
				row.last_mine_reset = start_of_day();
			});

			config = configs.find(quantity.symbol.code().raw());
		}

		if(config->max_mines_per_day > 0){
			check(config->mined_today + config->totems_per_mine <= config->max_mines_per_day, "Daily mining limit reached");
		}

		auto mined = asset{static_cast<int64_t>(config->totems_per_mine), quantity.symbol};

		configs.modify(config, get_self(), [&](auto& row) {
			row.mined_today += config->totems_per_mine;
		});

		totems::transfer(
			get_self(),
			minter,
			mined,
			std::string("Mined totems")
		);
	}

	[[eosio::on_notify(TOTEMS_MINT_NOTIFY)]]
	void on_mint(const name& mod, const name& minter, const asset& quantity, const asset& payment, const std::string& memo) {}

private:
    time_point_sec start_of_day() {
        auto now = current_time_point();
        auto secs_in_day = now.sec_since_epoch() - (now.sec_since_epoch() % 86400);
        return time_point_sec(secs_in_day);
    }
};