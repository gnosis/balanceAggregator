// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Enum {
    enum Operation {
        Call, DelegateCall
    }
}

interface IAdapter {
    function getBalance(
        address token,
        address account
    )
        external
        returns(
            int256
        );
}

contract BalanceAggregator is Ownable{

    event AddedAdapter(address owner);
    event RemovedAdapter(address owner);

    uint256 public adapterCount;
    address public token;

    address internal constant SENTINEL_ADAPTERS = address(0x1);

    // Mapping of adapter contracts
    mapping(address => address) internal adapters;

    /// @param _adapters adapters that should be enabled immediately
    constructor(
        address _token,
        address[] memory _adapters
    ){
        token = _token;
        setupAdapters(_adapters);
    }

    /// @dev Setup function sets initial storage of contract.
    /// @param _adapters List of adapters.
    function setupAdapters(
        address[] memory _adapters
    )
        internal
    {
        // Initializing adapters.
        address currentAdapter = SENTINEL_ADAPTERS;
        for (uint256 i = 0; i < _adapters.length; i++) {
            address adapter = _adapters[i];
            require(adapter != address(0) && adapter != SENTINEL_ADAPTERS && adapter != address(this) && currentAdapter != adapter, "Adapter address cannot be null, the sentinel, or this contract.");
            require(adapters[adapter] == address(0), " No duplicate adapters allowed");
            adapters[currentAdapter] = adapter;
            currentAdapter = adapter;
        }
        adapters[currentAdapter] = SENTINEL_ADAPTERS;
        adapterCount = _adapters.length;
    }

    /// @dev Allows to add a new adapter.
    /// @notice Adds the adapter `adapter`.
    /// @param adapter New adapter address.
    function addAdapter(
        address adapter
    )
        public
        onlyOwner
    {
        require(adapter != address(0) && adapter != SENTINEL_ADAPTERS && adapter != address(this), "Adapter address cannot be null, the sentinel, or this contract.");
        require(adapters[adapter] == address(0), "No duplicate adapters allowed.");
        adapters[adapter] = adapters[SENTINEL_ADAPTERS];
        adapters[SENTINEL_ADAPTERS] = adapter;
        adapterCount++;
        emit AddedAdapter(adapter);
    }

    /// @dev Allows to remove an adapter.
    /// @notice Removes the adapter `adapter`.
    /// @param prevAdapter Adapter that pointed to the adapter to be removed in the linked list.
    /// @param adapter Adapter address to be removed.
    function removeAdapter(
        address prevAdapter,
        address adapter
    )
        public
        onlyOwner
    {
        // Validate adapter address and check that it corresponds to adapter index.
        require(adapter != address(0) && adapter != SENTINEL_ADAPTERS, "Adapter address cannot be null or the sentinel.");
        require(adapters[prevAdapter] == adapter, "prevAdapter does not point to adapter.");
        adapters[prevAdapter] = adapters[adapter];
        adapters[adapter] = address(0);
        adapterCount--;
        emit RemovedAdapter(adapter);
    }

    /// @dev Allows to swap/replace an adapter.
    /// @notice Replaces the adapter `oldAdapter` with `newAdapter`.
    /// @param prevAdapter Adapter that pointed to the adapter to be replaced in the linked list
    /// @param oldAdapter Adapter address to be replaced.
    /// @param newAdapter New adapter address.
    function swapAdapter(
        address prevAdapter,
        address oldAdapter,
        address newAdapter
    )
        public
        onlyOwner
    {
        require(newAdapter != address(0) && newAdapter != SENTINEL_ADAPTERS && newAdapter != address(this), "Adapter address cannot be null, the sentinel, or this contract.");
        require(adapters[newAdapter] == address(0), "No duplicate adapters allowed.");
        // Validate oldAdapter address and check that it corresponds to adapter index.
        require(oldAdapter != address(0) && oldAdapter != SENTINEL_ADAPTERS, "Adapter address cannot be null or the sentinel.");
        require(adapters[prevAdapter] == oldAdapter, "prevAdapter does not point to adapter.");
        adapters[newAdapter] = adapters[oldAdapter];
        adapters[prevAdapter] = newAdapter;
        adapters[oldAdapter] = address(0);
        emit RemovedAdapter(oldAdapter);
        emit AddedAdapter(newAdapter);
    }

    /// @dev Returns array of adapters.
    /// @return Array of adapters.
    function getAdapters()
        public
        view
        returns (
            address[] memory
        )
    {
        address[] memory array = new address[](adapterCount);

        // populate return array
        uint256 index = 0;
        address currentAdapter = adapters[SENTINEL_ADAPTERS];
        while (currentAdapter != SENTINEL_ADAPTERS) {
            array[index] = currentAdapter;
            currentAdapter = adapters[currentAdapter];
            index++;
        }
        return array;
    }
}
