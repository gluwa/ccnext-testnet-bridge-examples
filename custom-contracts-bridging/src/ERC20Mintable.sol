// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "node_modules/@openzeppelin/contracts/access/AccessControl.sol";

interface IERC20Mintable {
    function mint(address to, uint256 amount) external;
}

contract ERC20Mintable is ERC20, AccessControl, IERC20Mintable {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /**
     * @dev Mint new tokens.
     * Can only be called by the owner of the contract.
     * @param to Address to receive the minted tokens.
     * @param amount Amount of tokens to mint (in smallest units, e.g., wei for Ether).
     */
    function mint(address to, uint256 amount) override external onlyRole(DEFAULT_ADMIN_ROLE) {
        _mint(to, amount);
    }
}