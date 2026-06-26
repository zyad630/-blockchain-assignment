// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WorkloProjectToken (WPT)
 * @dev Minimal ERC-20 token where only the owner can mint.
 *      Used to reward team members for completing tasks on the Worklo platform.
 */
contract WorkloProjectToken is ERC20, Ownable {
    constructor(address initialOwner)
        ERC20("Worklo Project Token", "WPT")
        Ownable(initialOwner)
    {}

    /**
     * @notice Mint WPT tokens to a given address.
     * @dev Only callable by the contract owner (the deployer / Worklo backend).
     * @param to      Recipient wallet address
     * @param amount  Number of tokens to mint (in wei units, 18 decimals)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
