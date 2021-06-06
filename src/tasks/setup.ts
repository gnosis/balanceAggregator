import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import { task, types } from "hardhat/config";

task("setup", "deploy a BalanceAggregator")
    .addParam("token", "Address of the token balance to aggregate", undefined, types.string)
    .addParam("adapters", "Addresses of the Zerion adapters to pull balances from", undefined, types.string)
    .setAction(async (taskArgs, hardhatRuntime) => {
        const [caller] = await hardhatRuntime.ethers.getSigners();
        console.log("Using the account:", caller.address);
        const adapters = JSON.parse(taskArgs.adapters);
        const BalanceAggregator = await hardhatRuntime.ethers.getContractFactory("BalanceAggregator");
        const balanceAggregator = await BalanceAggregator.deploy(taskArgs.token, adapters);

        console.log("BalanceAggregator deployed to:", balanceAggregator.address);
    });

task("verifyEtherscan", "Verifies the contract on etherscan")
    .addParam("contract", "Address of the balanceAggregator contract", undefined, types.string)
    .addParam("token", "Address of the token balance to aggregate", undefined, types.string)
    .addParam("adapters", "Addresses of the Zerion adapters to pull balances from", undefined, types.string)
    .setAction(async (taskArgs, hardhatRuntime) => {
        const adapters = JSON.parse(taskArgs.adapters);
        await hardhatRuntime.run("verify", {
            address: taskArgs.contract,
            constructorArgsParams: [
                taskArgs.token, adapters
            ]
        })
    });

export { };
