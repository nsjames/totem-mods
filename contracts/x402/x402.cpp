#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>

#include "../library/totems.hpp"
using namespace eosio;

CONTRACT x402 : public contract {
   public:
    using contract::contract;

    struct [[eosio::table]] Intent {
        uint64_t        id;
        name            owner;
        name            consumer;     // API / mod / service
        asset           price;
        checksum256     request_hash; // binds to API request
        time_point_sec  expires;

        uint64_t primary_key() const { return id; }
        checksum256 by_hash() const { return request_hash; }
        uint128_t by_owner_id() const {
            return (uint128_t(owner.value) << 64) | id;
        }
    };

    struct [[eosio::table]] ID {
		uint64_t id;
		uint64_t primary_key() const { return 0; }
	};

    typedef eosio::multi_index<
        "intents"_n,
        Intent,
        indexed_by<"byhash"_n, const_mem_fun<Intent, checksum256, &Intent::by_hash>>,
        indexed_by<"byowner"_n, const_mem_fun<Intent, uint128_t, &Intent::by_owner_id>>
    > intents_table;
    typedef eosio::multi_index<"accounts"_n, totems::Balance> balances_table;
    typedef eosio::multi_index<"lockedbals"_n, totems::Balance> locked_balances_table;
    typedef eosio::multi_index<"ids"_n, ID> ids_table;




    [[eosio::action]]
    Intent authorize(
        const name& owner,
        const name& consumer,
        const asset& price,
        const checksum256& request_hash,
        uint32_t expires_sec
    ) {
        require_auth(owner);

        balances_table balances(get_self(), owner.value);
        auto bal = balances.find(price.symbol.code().raw());
        check(bal != balances.end(), "No balance for this totem");
        check(bal->balance >= price, "Insufficient funds to authorize intent");

        balances.modify(bal, same_payer, [&](auto& b){
			b.balance -= price;
		});

		locked_balances_table locked_bals(get_self(), owner.value);
		auto locked_it = locked_bals.find(price.symbol.code().raw());
		if(locked_it == locked_bals.end()){
			locked_bals.emplace(owner, [&](auto& lb){
				lb.balance = price;
			});
		} else {
			locked_bals.modify(locked_it, same_payer, [&](auto& lb){
				lb.balance += price;
			});
		}

        intents_table intents(get_self(), get_self().value);
        Intent intent{
            .id = get_next_id(),
            .owner = owner,
            .consumer = consumer,
            .price = price,
            .request_hash = request_hash,
            .expires = time_point_sec(current_time_point()) + expires_sec
        };

        intents.emplace(owner, [&](auto& row){
            row = intent;
        });

		return intent;
    }

	[[eosio::action]]
    void revoke(const uint64_t& id){
        intents_table intents(get_self(), get_self().value);
		auto it = intents.find(id);
		check(it != intents.end(), "Intent not found");
		require_auth(it->owner);

		// no need to confirm existence for locked/unlocked balances, they must exist if the intent exists
		locked_balances_table locked_bals(get_self(), it->owner.value);
		locked_bals.modify(locked_bals.find(it->price.symbol.code().raw()), same_payer, [&](auto& b){
			b.balance -= it->price;
		});

		balances_table balances(get_self(), it->owner.value);
		balances.modify(balances.find(it->price.symbol.code().raw()), same_payer, [&](auto& b){
			b.balance += it->price;
		});

		intents.erase(it);
    }

    [[eosio::action]]
    bool consume(
        const uint64_t& id,
        const checksum256& request_hash
    ) {
        intents_table intents(get_self(), get_self().value);
        auto it = intents.find(id);
        check(it != intents.end(), "Invalid or already used intent");

        require_auth(it->consumer);

        check(it->request_hash == request_hash, "Request hash does not match.");

        locked_balances_table locked_bals(get_self(), it->owner.value);
        auto bal = locked_bals.find(it->price.symbol.code().raw());
        check(bal->balance >= it->price, "Insufficient funds");

        locked_bals.modify(bal, same_payer, [&](auto& b){
            b.balance -= it->price;
        });

        if(it->expires < current_time_point()){
            balances_table balances(get_self(), it->owner.value);
            // there's no way to close the balance, no need to check existence
            balances.modify(balances.find(it->price.symbol.code().raw()), same_payer, [&](auto& b){
            	b.balance += it->price;
			});

			intents.erase(it);
			return false;
        }

        totems::transfer(
            get_self(),
            it->consumer,
            it->price,
            "x402 payment"
        );

        intents.erase(it);
        return true;
    }





	[[eosio::action]]
	void transfer(const name& from, const name& to, const asset& quantity, const std::string& memo){
		totems::check_license(quantity.symbol.code(), get_self());

		require_auth(from);

		check(is_account(to), "Recipient account does not exist.");
		check(quantity.is_valid(), "Invalid quantity.");
		check(quantity.amount > 0, "Cannot withdraw negative amount.");

		balances_table balances(get_self(), from.value);
		auto it = balances.find(quantity.symbol.code().raw());
		check(it != balances.end(), "You have no balance for this totem.");
		check(it->balance.amount >= quantity.amount, "Insufficient balance.");

		balances.modify(it, same_payer, [&](auto& row) {
			row.balance -= quantity;
		});

		totems::transfer(
			get_self(),
			to,
			quantity,
			std::move(memo)
		);
	}

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

    [[eosio::action, eosio::read_only]]
    std::optional<Intent> getintent(const uint64_t& id){
    	intents_table intents(get_self(), get_self().value);
	    auto it = intents.find(id);
	    if(it != intents.end()){
			return *it;
		}
		return std::nullopt;
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

    [[eosio::action, eosio::read_only]]
    asset getlockedbal(const name& owner, const symbol& ticker){
        locked_balances_table locked_bals(get_self(), owner.value);
		auto it = locked_bals.find(ticker.code().raw());
		if(it != locked_bals.end()){
			return it->balance;
		}
		return asset{0, ticker};
    }

	struct MyIntentsResult {
        std::vector<Intent> intents;
        std::optional<uint128_t> cursor;
    };

    [[eosio::action, eosio::read_only]]
    MyIntentsResult getmyintents(
        const name& owner,
        const uint32_t& limit,
        const std::optional<uint128_t>& cursor
    ){
        MyIntentsResult result;

        intents_table intents(get_self(), get_self().value);
        auto idx = intents.get_index<"byowner"_n>();

        uint128_t base = uint128_t(owner.value) << 64;

        auto itr = cursor.has_value()
            ? idx.upper_bound(cursor.value())
            : idx.lower_bound(base);

        uint32_t count = 0;
        while (
            itr != idx.end() &&
            itr->owner == owner &&
            count < limit
        ){
            result.intents.push_back(*itr);
            result.cursor = itr->by_owner_id(); // last emitted key
            ++itr;
            ++count;
        }

        return result;
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
	uint64_t get_next_id(){
		ids_table ids(get_self(), get_self().value);
		auto it = ids.find(0);
		uint64_t next_id = 0;
		if(it == ids.end()){
			ids.emplace(get_self(), [&](auto& id){
				id.id = next_id;
			});
		} else {
			next_id = it->id + 1;
			ids.modify(it, same_payer, [&](auto& id){
				id.id = next_id;
			});
		}
		return next_id;
	}
};