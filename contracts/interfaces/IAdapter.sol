// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

interface IAdapter {
    function getBalance(address token, address account)
        external
        view
        returns (uint256);
}
