#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>

#include "../library/totems.hpp"
using namespace eosio;
using std::string;

CONTRACT controls : public contract {
   public:
    using contract::contract;

    struct TransferLimits {
		uint64_t daily_limit;
		uint64_t transferred_today;
	};

    struct [[eosio::table]] TransferControls {
        symbol_code ticker;
        TransferLimits global_limits;
        time_point_sec last_transfer_reset;

        uint64_t primary_key() const { return ticker.raw(); }
    };

    struct [[eosio::table]] PerAccountLimits {
        name recipient;
        symbol_code ticker;
		TransferLimits limits;
        time_point_sec last_transfer_reset;

		uint64_t primary_key() const { return recipient.value; }

		uint128_t by_ticker_account() const {
            return get_account_key(ticker, recipient);
        }
	};

	// scoped to account name
    typedef eosio::multi_index<"controls"_n, TransferControls> controls_table;
    typedef eosio::multi_index<"acc.limits"_n, PerAccountLimits,
		indexed_by<"bytickeracct"_n, const_mem_fun<PerAccountLimits, uint128_t, &PerAccountLimits::by_ticker_account>>
	> per_account_limits_table;

	struct AccountLimitParam {
		name recipient;
		uint64_t daily_limit;
	};

    [[eosio::action]]
    void limit(const name& account, const symbol_code& ticker, const uint64_t& global_daily_limit, const std::vector<AccountLimitParam>& account_limits){
		require_auth(account);

		controls_table controls(get_self(), account.value);
		auto control = controls.find(ticker.raw());

		if (control == controls.end()) {
			controls.emplace(account, [&](auto& row) {
				row.ticker = ticker;
				row.global_limits.daily_limit = global_daily_limit;
				row.last_transfer_reset = start_of_day();
			});
		} else {
			controls.modify(control, account, [&](auto& row) {
				row.global_limits.daily_limit = global_daily_limit;
			});
		}

		if(account_limits.size() > 0){
			per_account_limits_table per_account_limits(get_self(), account.value);
			for (const auto& limit : account_limits) {
                auto idx = per_account_limits.get_index<"bytickeracct"_n>();
                auto key = get_account_key(ticker, limit.recipient);
                auto limit_itr = idx.find(key);

                if (limit_itr == idx.end()) {
                    per_account_limits.emplace(account, [&](auto& row) {
                        row.recipient = limit.recipient;
                        row.ticker = ticker;
                        row.limits.daily_limit = limit.daily_limit;
                    });
                } else {
                    idx.modify(limit_itr, account, [&](auto& row) {
                        row.limits.daily_limit = limit.daily_limit;
                    });
                }
            }
		}
	}

    [[eosio::action]]
    void unlimit(const name& account, const symbol_code& ticker, const std::vector<name>& accounts){
		require_auth(account);

		check(accounts.size() > 0, "Must specify at least one account to unlimit");
		per_account_limits_table per_account_limits(get_self(), account.value);
        auto idx = per_account_limits.get_index<"bytickeracct"_n>();

		for(const auto& recipient : accounts){
            auto key = get_account_key(ticker, recipient);
            auto limit_itr = idx.find(key);
            if(limit_itr != idx.end()){
                idx.erase(limit_itr);
            }
        }
	}

	[[eosio::on_notify(TOTEMS_TRANSFER_NOTIFY)]]
	void on_transfer(const name& from, const name& to, const asset& quantity, const string& memo){
		if(from == get_self() || to == get_self()){
			return;
		}

		time_point_sec current_time = time_point_sec(current_time_point());

		controls_table controls(get_self(), from.value);
		auto control = controls.find(quantity.symbol.code().raw());
		if(control != controls.end()){
            if(current_time.sec_since_epoch() - control->last_transfer_reset.sec_since_epoch() >= 86400){
                controls.modify(control, same_payer, [&](auto& row){
                    row.global_limits.transferred_today = 0;
                    row.last_transfer_reset = start_of_day();
                });
                control = controls.find(quantity.symbol.code().raw());
            }
        }

		per_account_limits_table per_account_limits(get_self(), from.value);
        auto idx = per_account_limits.get_index<"bytickeracct"_n>();
        auto key = get_account_key(quantity.symbol.code(), to);
        auto limit_itr = idx.find(key);
        if(limit_itr != idx.end()){
            if(current_time.sec_since_epoch() - limit_itr->last_transfer_reset.sec_since_epoch() >= 86400){
                idx.modify(limit_itr, same_payer, [&](auto& row){
                    row.limits.transferred_today = 0;
                    row.last_transfer_reset = start_of_day();
                });

                limit_itr = idx.find(key);
            }

            if(limit_itr->limits.daily_limit > 0){
                check(limit_itr->limits.transferred_today + quantity.amount <= limit_itr->limits.daily_limit,
                    "Transfer exceeds recipient daily limit");
            }

            idx.modify(limit_itr, same_payer, [&](auto& row){
                row.limits.transferred_today += quantity.amount;
            });

            // Per account limits supersede global limits but still count towards global limits
            if(control != controls.end()){
                controls.modify(control, same_payer, [&](auto& row){
                    row.global_limits.transferred_today += quantity.amount;
				});
			}

            return;
        }

		if(control != controls.end()){
			if(control->global_limits.daily_limit > 0){
				check(control->global_limits.transferred_today + quantity.amount <= control->global_limits.daily_limit,
					"Transfer exceeds global daily limit");
			}

			controls.modify(control, same_payer, [&](auto& row){
				row.global_limits.transferred_today += quantity.amount;
			});
		}
	}

private:
	time_point_sec start_of_day() {
		auto now = current_time_point();
		auto secs_in_day = now.sec_since_epoch() - (now.sec_since_epoch() % 86400);
		return time_point_sec(secs_in_day);
	}

	static uint128_t get_account_key(const symbol_code& ticker, const name& account) {
		return (uint128_t(ticker.raw()) << 64) | account.value;
	}
};