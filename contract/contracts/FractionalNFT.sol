// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FractionalNFT is ERC20 {
    address public vault;
    uint256 public totalShares;

    modifier onlyVault() {
        require(msg.sender == vault, "Not vault");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 _totalShares,
        address _vault
    ) ERC20(name_, symbol_) {
        vault = _vault;
        totalShares = _totalShares;
        _mint(_vault, _totalShares);
    }
}