#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>

#include "../library/totems.hpp"
using namespace eosio;

CONTRACT kyc : public contract {
   public:
    using contract::contract;

    struct [[eosio::table]] Manager {
        name manager;

        uint64_t primary_key() const { return manager.value; }
    };

    typedef eosio::multi_index<"managers"_n, Manager> managers_table;

    struct [[eosio::table]] KYC {
        name account;

        uint64_t primary_key() const { return account.value; }
    };

    using kyc_table = eosio::multi_index<"kyc"_n, KYC>;

    [[eosio::action]]
    void addmanager(name manager) {
		require_auth(get_self());
		check(is_account(manager), "Manager account does not exist");
		managers_table managers(get_self(), get_self().value);
		auto itr = managers.find(manager.value);
		check(itr == managers.end(), "Manager already exists");
		managers.emplace(get_self(), [&](auto& row) { row.manager = manager; });
	}

	[[eosio::action]]
	void delmanager(name manager) {
		require_auth(get_self());
		managers_table managers(get_self(), get_self().value);
		auto itr = managers.find(manager.value);
		check(itr != managers.end(), "Manager does not exist");
		managers.erase(itr);
	}

	[[eosio::action]]
    void setkyc(const name& manager, const name& account, const bool& has_kyc) {
        check_manager(manager);
        kyc_table kyc(get_self(), get_self().value);
        auto itr = kyc.find(account.value);

        if (has_kyc) {
            kyc.emplace(get_self(), [&](auto& row) { row.account = account; });
        } else {
            kyc.erase(itr);
        }
    }

    [[eosio::on_notify(TOTEMS_TRANSFER_NOTIFY)]]
    void on_transfer(name from, name to, asset quantity, std::string memo) {
        totems::check_license(quantity.symbol.code(), get_self());
        if (from == get_self() || to == get_self()) {
            return;
        }

        auto totem = totems::get_totem(quantity.symbol.code());
        check(totem.has_value(), "Totem does not exist");

        check_kyc(from, totem->allocations);
        check_kyc(to, totem->allocations);
    }

   private:
    void check_kyc(const name& user, const std::vector<totems::MintAllocation>& allocations) {
        // Minter mods are exempt from KYC
        if (!allocations.empty()) {
			auto allocated_user = std::find_if(
				allocations.begin(),
				allocations.end(),
				[&](const totems::MintAllocation& alloc) {
					return alloc.recipient == user;
				}
			);

			if (allocated_user != allocations.end()){
				if(allocated_user->is_minter.has_value() && allocated_user->is_minter.value() == true){
					return;
				}
			}
		}

        kyc_table kyc(get_self(), get_self().value);
        auto itr = kyc.find(user.value);
        check(itr != kyc.end(), "KYC required.");
    }

    void check_manager(const name& signer) {
		managers_table managers(get_self(), get_self().value);
		auto itr = managers.find(signer.value);
		check(itr != managers.end(), "Signer is not an authorized KYC manager");
	}
};