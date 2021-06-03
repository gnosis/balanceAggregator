import { expect } from "chai";
import hre, { deployments, ethers, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";

describe("BalanceAggregator", async () => {

    const FORTYTWO = "0x000000000000000000000000000000000000000000000000000000000000002a";
    const ZEROADDRESS = "0x0000000000000000000000000000000000000000";

    const setup = deployments.createFixture(async () => {
        await deployments.fixture();
        const Mock = await hre.ethers.getContractFactory("Mock");
        const mock1 = await Mock.deploy();
        const adapter1 = await hre.ethers.getContractAt("IAdapter", mock1.address);
        const mock2 = await Mock.deploy();
        const adapter2 = await hre.ethers.getContractAt("IAdapter", mock2.address);
        const mock3 = await Mock.deploy();
        const adapter3 = await hre.ethers.getContractAt("IAdapter", mock3.address);

        const signers = await hre.ethers.getSigners();

        await mock1.givenMethodReturnUint(adapter1.interface.getSighash("getBalance"), 1);
        await mock2.givenMethodReturnUint(adapter2.interface.getSighash("getBalance"), 4);
        await mock3.givenMethodReturnUint(adapter3.interface.getSighash("getBalance"), 7);

        const BalanceAggregator = await hre.ethers.getContractFactory("BalanceAggregator");
        const balanceAggregator = await BalanceAggregator.deploy(ZEROADDRESS, [adapter1.address]);

        return { BalanceAggregator, balanceAggregator, adapter1, adapter2, adapter3, signers };
    })

    const [user1] = waffle.provider.getWallets();

    describe("deploys with:", async () => {
        it("one adapter", async () => {
            const { BalanceAggregator, adapter1, adapter2, adapter3 } = await setup();
            await expect(
                BalanceAggregator.deploy(ZEROADDRESS, [adapter1.address])
            );
        })

        it("multiple adapters", async () => {
            const { BalanceAggregator, adapter1, adapter2, adapter3 } = await setup();
            await expect(
                BalanceAggregator.deploy(ZEROADDRESS, [adapter1.address, adapter2.address])
            );
        })
    })

    describe("addAdapter()", async () => {
        it("throws if not authorized", async () => {
            const { balanceAggregator, adapter1, adapter2, adapter3, signers } = await setup();
            await balanceAggregator.transferOwnership(signers[1].address);
            await expect(
                balanceAggregator.addAdapter(adapter2.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        })
    })

    describe("addAdapter()", async () => {
        it("adds an adapter", async () => {
            const { balanceAggregator, adapter1, adapter2, adapter3, signers } = await setup();
            const expectedAdapters = [ '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', '0x5FbDB2315678afecb367f032d93F642f64180aa3' ]
            console.log(await balanceAggregator.getAdapters());

            await balanceAggregator.addAdapter(adapter2.address);
            console.log(await balanceAggregator.getAdapters());
            await expect(
                await balanceAggregator.getAdapters()
            ).to.be.equals(expectedAdapters);
        })
    })

})
