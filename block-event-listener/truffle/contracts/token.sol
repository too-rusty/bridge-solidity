// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


abstract contract ERC20Burnable is ERC20 {

  function burn(uint256 amount) external virtual returns (bool success) {
    _burn(_msgSender(), amount);
    return true;
  }

  function burnFrom(address account, uint256 amount) external virtual returns (bool success) {
    uint256 decreasedAllowance = allowance(account, _msgSender()) - amount;
    _approve(account, _msgSender(), decreasedAllowance);
    _burn(account, amount);
    return true;
  }
}

abstract contract ERC20Mintable is ERC20 {
  /**
   */
    address public BRIDGE;
  
  function mint(address account, uint256 amount) external virtual returns (bool success) {
    require(_msgSender() == BRIDGE, "only bridge can mint tokens"); // and only api can call bridge
    _mint(account, amount);
    return true;
  }
}

contract Token is ERC20Burnable, ERC20Mintable, Ownable {
    constructor () ERC20("Token", "TK1") {
        _mint(msg.sender, 1000);
    }
    function setBridge(address bridge) external virtual onlyOwner {
      BRIDGE = bridge;
    }
}