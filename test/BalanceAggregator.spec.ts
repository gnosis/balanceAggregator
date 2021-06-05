import { expect } from "chai";
import hre, { deployments, ethers, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";

describe("BalanceAggregator", async () => {

    const ZEROADDRESS = "0x0000000000000000000000000000000000000000";
    const SENTINELADDRESS = "0x0000000000000000000000000000000000000001";

    const setup = deployments.createFixture(async () => {
        await deployments.fixture();
        const Mock = await hre.ethers.getContractFactory("Mock");
        const mock1 = await Mock.deploy();
        const adapter1 = await hre.ethers.getContractAt("IAdapter", mock1.address);
        const mock2 = await Mock.deploy();
        const adapter2 = await hre.ethers.getContractAt("IAdapter", mock2.address);
        const mock3 = await Mock.deploy();
        const token = await hre.ethers.getContractAt("IERC20", mock3.address);

        const signers = await hre.ethers.getSigners();

        await mock1.givenMethodReturnUint(adapter1.interface.getSighash("getBalance"), 1);
        await mock2.givenMethodReturnUint(adapter2.interface.getSighash("getBalance"), 3);
        await mock3.givenMethodReturnUint(token.interface.getSighash("balanceOf"), 5);

        const BalanceAggregator = await hre.ethers.getContractFactory("BalanceAggregator");
        const balanceAggregator = await BalanceAggregator.deploy(token.address, [adapter1.address]);

        return { BalanceAggregator, balanceAggregator, adapter1, adapter2, token, signers };
    })

    const [user1] = waffle.provider.getWallets();

    describe("constructor()", async () => {
        it("throws if null or sentinel", async () => {
            const { BalanceAggregator} = await setup();
            await expect(
                BalanceAggregator.deploy(ZEROADDRESS, [ZEROADDRESS])
            ).to.be.revertedWith("Adapter address cannot be null, the sentinel, or this contract.");
            await expect(
                BalanceAggregator.deploy(ZEROADDRESS, [SENTINELADDRESS])
            ).to.be.revertedWith("Adapter address cannot be null, the sentinel, or this contract.");
        })

        it("throws if duplicate", async () => {
            const { BalanceAggregator, adapter1, adapter2} = await setup();
            await expect(
                BalanceAggregator.deploy(ZEROADDRESS, [adapter2.address, adapter1.address, adapter2.address])
            ).to.be.revertedWith("No duplicate adapters allowed.");
        })

        it("deploys with one adapter", async () => {
            const { BalanceAggregator, adapter1} = await setup();
            await expect(
                BalanceAggregator.deploy(ZEROADDRESS, [adapter1.address])
            );
        })

        it("deploys with multiple adapters", async () => {
            const { BalanceAggregator, adapter1, adapter2} = await setup();
            await expect(
                BalanceAggregator.deploy(ZEROADDRESS, [adapter1.address, adapter2.address])
            );
        })
    })

    describe("addAdapter()", async () => {
        it("throws if not authorized", async () => {
            const { balanceAggregator, adapter2, signers} = await setup();
            await balanceAggregator.transferOwnership(signers[1].address);
            await expect(
                balanceAggregator.addAdapter(adapter2.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("throws if null, sentinal, or this address", async () => {
            const { balanceAggregator} = await setup();
            await expect(
                balanceAggregator.addAdapter(ZEROADDRESS)
            ).to.be.revertedWith("Adapter address cannot be null, the sentinel, or this contract.");
            await expect(
                balanceAggregator.addAdapter(SENTINELADDRESS)
            ).to.be.revertedWith("Adapter address cannot be null, the sentinel, or this contract.");
            await expect(
                balanceAggregator.addAdapter(balanceAggregator.address)
            ).to.be.revertedWith("Adapter address cannot be null, the sentinel, or this contract.");
        })

        it("throws if duplicate", async () => {
            const { balanceAggregator, adapter1} = await setup();
            await expect(
                balanceAggregator.addAdapter(adapter1.address)
            ).to.be.revertedWith("No duplicate adapters allowed.");
        })

        it("adds an adapter", async () => {
            const { balanceAggregator, adapter1, adapter2} = await setup();
            const expectedAdapters = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512,0x5FbDB2315678afecb367f032d93F642f64180aa3"
            await balanceAggregator.addAdapter(adapter2.address);
            let adapters = (await balanceAggregator.getAdapters()).toString();
            await expect(adapters).to.be.equals(expectedAdapters);
        })
    })

    describe("removeAdapter()", async () => {
        it("throws if not authorized", async () => {
            const { balanceAggregator, adapter2, signers} = await setup();
            await balanceAggregator.transferOwnership(signers[1].address);
            await expect(
                balanceAggregator.removeAdapter(ZEROADDRESS, adapter2.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("throws if null or sentinal", async () => {
            const { balanceAggregator} = await setup();
            await expect(
                balanceAggregator.removeAdapter(ZEROADDRESS, ZEROADDRESS)
            ).to.be.revertedWith("Adapter address cannot be null or the sentinel.");
            await expect(
                balanceAggregator.removeAdapter(ZEROADDRESS, SENTINELADDRESS)
            ).to.be.revertedWith("Adapter address cannot be null or the sentinel.");
        })

        it("throws if prevAdapter does not point to adapter.", async () => {
            const { balanceAggregator, adapter1} = await setup();
            await expect(
                balanceAggregator.removeAdapter(ZEROADDRESS, adapter1.address)
            ).to.be.revertedWith("prevAdapter does not point to adapter.");
        })

        it("removes an adapter", async () => {
            const { balanceAggregator, adapter1, adapter2} = await setup();
            await balanceAggregator.addAdapter(adapter2.address);
            await balanceAggregator.removeAdapter(adapter2.address, adapter1.address);
            let adapters = await balanceAggregator.getAdapters();
            await expect(adapters[0]).to.be.equals(adapter2.address);
        })
    })

    describe("getAdapters()", async () => {
        it("returns the correct array of adapters", async () => {
            const { balanceAggregator, adapter1, adapter2} = await setup();
            const expected = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512,0x5FbDB2315678afecb367f032d93F642f64180aa3";
            await balanceAggregator.addAdapter(adapter2.address);
            await expect(
                (await balanceAggregator.getAdapters()).toString()
            ).to.be.equals(expected);
        })
    })

    describe("balanceOf()", async () => {
        it("returns the correct correct balance", async () => {
            const { balanceAggregator, adapter1, adapter2, token} = await setup();
            const expected = '0x09';
            await balanceAggregator.addAdapter(adapter2.address);
            const balance = await balanceAggregator.balanceOf(user1.address);
            await expect(balance._hex).to.be.equals(expected);
        })
    })
})
