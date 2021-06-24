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
    const token = await hre.ethers.getContractAt("IERC20", mock1.address);
    const mock2 = await Mock.deploy();
    const pair = await hre.ethers.getContractAt("IERC20", mock2.address);
    const LPBalanceAdapter = await hre.ethers.getContractFactory(
      "LPBalanceAdapter"
    );
    const adapter1 = await LPBalanceAdapter.deploy(pair.address);
    const adapter2 = await LPBalanceAdapter.deploy(pair.address);
    const adapter3 = await LPBalanceAdapter.deploy(pair.address);

    const signers = await hre.ethers.getSigners();

    await mock1.givenMethodReturnUint(
      token.interface.getSighash("balanceOf"),
      1000
    );
    await mock2.givenMethodReturnUint(
      pair.interface.getSighash("balanceOf"),
      50
    );
    await mock2.givenMethodReturnUint(
      pair.interface.getSighash("totalSupply"),
      100
    );

    const BalanceAggregator = await hre.ethers.getContractFactory(
      "BalanceAggregator"
    );
    const balanceAggregator = await BalanceAggregator.deploy(token.address, [
      adapter1.address,
    ]);

    return {
      BalanceAggregator,
      balanceAggregator,
      adapter1,
      adapter2,
      adapter3,
      token,
      signers,
    };
  });

  const [user1] = waffle.provider.getWallets();

  describe("constructor()", async () => {
    it("throws if null or sentinel", async () => {
      const { BalanceAggregator } = await setup();
      await expect(
        BalanceAggregator.deploy(ZEROADDRESS, [ZEROADDRESS])
      ).to.be.revertedWith(
        "Adapter address cannot be null, the sentinel, or this contract."
      );
      await expect(
        BalanceAggregator.deploy(ZEROADDRESS, [SENTINELADDRESS])
      ).to.be.revertedWith(
        "Adapter address cannot be null, the sentinel, or this contract."
      );
    });

    it("throws if duplicate", async () => {
      const { BalanceAggregator, adapter1, adapter2 } = await setup();
      await expect(
        BalanceAggregator.deploy(ZEROADDRESS, [
          adapter2.address,
          adapter1.address,
          adapter2.address,
        ])
      ).to.be.revertedWith("No duplicate adapters allowed.");
    });

    it("deploys with one adapter", async () => {
      const { BalanceAggregator, adapter1 } = await setup();
      await expect(BalanceAggregator.deploy(ZEROADDRESS, [adapter1.address]));
    });

    it("deploys with multiple adapters", async () => {
      const { BalanceAggregator, adapter1, adapter2 } = await setup();
      await expect(
        BalanceAggregator.deploy(ZEROADDRESS, [
          adapter1.address,
          adapter2.address,
        ])
      );
    });
  });

  describe("addAdapter()", async () => {
    it("throws if not authorized", async () => {
      const { balanceAggregator, adapter2, signers } = await setup();
      await balanceAggregator.transferOwnership(signers[1].address);
      await expect(
        balanceAggregator.addAdapter(adapter2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("throws if null, sentinal, or this address", async () => {
      const { balanceAggregator } = await setup();
      await expect(
        balanceAggregator.addAdapter(ZEROADDRESS)
      ).to.be.revertedWith(
        "Adapter address cannot be null, the sentinel, or this contract."
      );
      await expect(
        balanceAggregator.addAdapter(SENTINELADDRESS)
      ).to.be.revertedWith(
        "Adapter address cannot be null, the sentinel, or this contract."
      );
      await expect(
        balanceAggregator.addAdapter(balanceAggregator.address)
      ).to.be.revertedWith(
        "Adapter address cannot be null, the sentinel, or this contract."
      );
    });

    it("throws if duplicate", async () => {
      const { balanceAggregator, adapter1 } = await setup();
      await expect(
        balanceAggregator.addAdapter(adapter1.address)
      ).to.be.revertedWith("No duplicate adapters allowed.");
    });

    it("adds an adapter", async () => {
      const { balanceAggregator, adapter1, adapter2 } = await setup();
      const expectedAdapters =
        "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9,0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
      await balanceAggregator.addAdapter(adapter2.address);
      let adapters = (await balanceAggregator.getAdapters()).toString();
      await expect(adapters).to.be.equals(expectedAdapters);
    });
  });

  describe("removeAdapter()", async () => {
    it("throws if not authorized", async () => {
      const { balanceAggregator, adapter2, signers } = await setup();
      await balanceAggregator.transferOwnership(signers[1].address);
      await expect(
        balanceAggregator.removeAdapter(ZEROADDRESS, adapter2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("throws if null or sentinal", async () => {
      const { balanceAggregator } = await setup();
      await expect(
        balanceAggregator.removeAdapter(ZEROADDRESS, ZEROADDRESS)
      ).to.be.revertedWith("Adapter address cannot be null or the sentinel.");
      await expect(
        balanceAggregator.removeAdapter(ZEROADDRESS, SENTINELADDRESS)
      ).to.be.revertedWith("Adapter address cannot be null or the sentinel.");
    });

    it("throws if prevAdapter does not point to adapter.", async () => {
      const { balanceAggregator, adapter1 } = await setup();
      await expect(
        balanceAggregator.removeAdapter(ZEROADDRESS, adapter1.address)
      ).to.be.revertedWith("prevAdapter does not point to adapter.");
    });

    it("removes an adapter", async () => {
      const { balanceAggregator, adapter1, adapter2 } = await setup();
      await balanceAggregator.addAdapter(adapter2.address);
      await balanceAggregator.removeAdapter(adapter2.address, adapter1.address);
      let adapters = await balanceAggregator.getAdapters();
      await expect(adapters[0]).to.be.equals(adapter2.address);
    });
  });

  describe("getAdapters()", async () => {
    it("returns the correct array of adapters", async () => {
      const { balanceAggregator, adapter1, adapter2 } = await setup();
      const expected =
        "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9,0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
      await balanceAggregator.addAdapter(adapter2.address);
      await expect(
        (await balanceAggregator.getAdapters()).toString()
      ).to.be.equals(expected);
    });
  });

  describe("balanceOf()", async () => {
    it("returns the correct correct balance", async () => {
      const { balanceAggregator, adapter1, adapter2, adapter3, token } =
        await setup();
      const expected = "0x09c4";
      await balanceAggregator.addAdapter(adapter2.address);
      await balanceAggregator.addAdapter(adapter3.address);

      const balance = await balanceAggregator.balanceOf(user1.address);
      await expect(balance._hex).to.be.equals(expected);
    });
  });
});

describe("LPBalanceAdapter", async () => {
  const ZEROADDRESS = "0x0000000000000000000000000000000000000000";
  const SENTINELADDRESS = "0x0000000000000000000000000000000000000001";

  const setup = deployments.createFixture(async () => {
    await deployments.fixture();
    const Mock = await hre.ethers.getContractFactory("Mock");
    const mock1 = await Mock.deploy();
    const token = await hre.ethers.getContractAt("IERC20", mock1.address);
    const mock2 = await Mock.deploy();
    const pair = await hre.ethers.getContractAt("IERC20", mock2.address);
    const LPBalanceAdapter = await hre.ethers.getContractFactory(
      "LPBalanceAdapter"
    );
    const adapter1 = await LPBalanceAdapter.deploy(pair.address);
    const adapter2 = await LPBalanceAdapter.deploy(pair.address);
    const adapter3 = await LPBalanceAdapter.deploy(pair.address);

    const signers = await hre.ethers.getSigners();

    await mock1.givenMethodReturnUint(
      token.interface.getSighash("balanceOf"),
      1000
    );
    await mock2.givenMethodReturnUint(
      pair.interface.getSighash("balanceOf"),
      50
    );
    await mock2.givenMethodReturnUint(
      pair.interface.getSighash("totalSupply"),
      100
    );

    const BalanceAggregator = await hre.ethers.getContractFactory(
      "BalanceAggregator"
    );
    const balanceAggregator = await BalanceAggregator.deploy(token.address, [
      adapter1.address,
    ]);

    return {
      BalanceAggregator,
      balanceAggregator,
      adapter1,
      adapter2,
      adapter3,
      LPBalanceAdapter,
      token,
      signers,
    };
  });

  const [user1] = waffle.provider.getWallets();

  describe("constructor()", async () => {
    it("deploys and sets pair", async () => {
      const { LPBalanceAdapter, adapter1 } = await setup();
      const adapter = await LPBalanceAdapter.deploy(ZEROADDRESS);
      const pair = await adapter.pair();

      await expect(pair).to.be.equals(ZEROADDRESS);
    });
  });

  describe("getBalance()", async () => {
    it("returns the correct correct balance", async () => {
      const { adapter1, token } = await setup();
      const expected = "0x01f4";
      const balance = await adapter1.getBalance(token.address, user1.address);
      await expect(balance._hex).to.be.equals(expected);
    });
  });
});
