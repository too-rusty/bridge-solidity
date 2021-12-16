// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract A {
    constructor () {}
    event Done(uint256, string);
    function something(uint256 x, string memory y) public {
        emit Done(x,y);
    }
}