// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;


import "@openzeppelin/contracts/access/Ownable.sol";

contract BridgeV1 is Ownable {
    using ECDSA for bytes32;

    uint256 public FEE;         // fee taken per trade
    uint256 public LIMIT;       // limit of tokens that can be transferred
    uint256 public BURN_PERCENTAGE;  // percentage of tokens that are burned on the first chain
    uint256 public MINT_PERCENTAGE;  // percentage of tokens that are minted on the second chain
    address public API;         // only API can call mint on this contract
    address private SIGNER;      // Signer public address
    address public TOKEN;       // token address

    string public THIS_CHAIN;   // this chain string


    mapping(bytes32 => bool) done;              // was this transaction executed ( not signed transaction )
    mapping(string => address) chainToBridge;   // chainname and the bridge contract address
    mapping(address => uint256) burnNonce;
    mapping(address => bool) blackListed;
    // mapping(address => string) bridgeToChain;   // bridge to chain , dont know why i need this

    enum State { PAUSED, ACTIVE }
    State public state;

    event CrossChainBurn(address from, address to, uint256 amountOut, string toChain, address toBridgeAddress, uint256 nonce);
    event CrossChainBurnReceipt(address from, address to, string chain, uint timeStamp, uint blockNumber, bytes32 onChainHash);
    // also let the user save the trnsaction hash

    event CrossChainMint(address from, address to, uint256 amountOut, string fromChain, address fromBridgeAddress);
    event CrossChainMintReceipt(address from, address to, string chain, uint timeStamp, uint blockNumber, bytes32 onChainHash);

    modifier onlyAPI() {
        require(API != address(0), "Bridge: API not set");
        require(msg.sender == API, "Bridge: Only API can call the function");
        _;
    }

    modifier active() {
      require(state == State.ACTIVE, "Bridge: Contract paused");
      _;
    }

    constructor(address _token, string memory _currentChain) Ownable() {
        THIS_CHAIN = _currentChain;
        TOKEN = _token;
        MINT_PERCENTAGE = BURN_PERCENTAGE = 10_000; // Default for both of them is 100%
        state = State.PAUSED;
    }

    // function setChainName(string memory _chain) external onlyOwner {
    //     THIS_CHAIN = _chain;
    // } // this function is not needed

    // function getNonce(address account) public view returns (uint256) {
    //     return nonce[account];
    // }

    // ------------------------- SETTERS , GETTERS ------------------------------
    function updateToken(address _token) external virtual onlyOwner { TOKEN = _token; }

    function pauseContract() external virtual onlyOwner { state = State.PAUSED; }

    function unpauseContract() external virtual onlyOwner { state = State.ACTIVE; }

    function isDone(bytes32 txn) external view virtual returns(bool) { return done[txn]; }

    function getNonce(address addr) external view virtual returns(uint256) { return burnNonce[addr]; }

    function setFee(uint256 _fee) external virtual onlyOwner { FEE = _fee; }

    function setBurnPercentage(uint256 _percentage) external virtual onlyOwner { BURN_PERCENTAGE = _percentage; }

    function setMintPercentage(uint256 _percentage) external virtual onlyOwner { MINT_PERCENTAGE = _percentage; }

    function setLimit(uint256 _limit) external virtual onlyOwner { LIMIT = _limit; }
    
    function setAPI(address _API) external virtual onlyOwner { API = _API; }

    function setSigner(address _signer) external virtual onlyOwner { SIGNER = _signer; }
    
    function getSigner() external view virtual onlyOwner returns(address) { return SIGNER; }
    
    function setBridgeAddressOnChain(string memory chain, address bridge) external virtual onlyOwner { chainToBridge[chain] = bridge; }

    function setBlackListed(address wallet, bool isBlackListed) external virtual onlyOwner { blackListed[wallet] = isBlackListed; }

    function getBlackListed(address wallet) external virtual returns(bool) { return blackListed[wallet]; }

    function amountIn(uint256 amount) public view virtual returns (uint256) {
        uint256 _amountIn = (amount * BURN_PERCENTAGE) / 10_000;
        return _amountIn;
    }

    function amountOut(uint256 amount) public view virtual returns (uint256) {
        uint256 _amountOut = (amount * MINT_PERCENTAGE) / 10_000;
        return _amountOut;
    }

    function transferBurn(address to, uint256 amount, string memory destChain) external virtual payable active {
        // to is the evm compatible address on other chain
        require(amount <= LIMIT, "Bridge: Amount should be less than limit");
        require(msg.value >= FEE, "Bridge: Fee not sufficient");
        
        address from = _msgSender();
        require(!blackListed[from], "Bridge: Caller BlackListed!");
        require(IERC20Burnable(TOKEN).burnFrom(from, amount), "Bridge: Unable to burn token, check allowance and/or token address");
        uint256 _amountIn = amountIn(amount);

        // transfer fee to the API address
        (bool sent, ) = API.call{value: address(this).balance}("");
        require(sent, "Bridge: Could not send FEE to API Contract");

        bytes32 _hash = _buildHash(from, to, amount, THIS_CHAIN, destChain, address(this), chainToBridge[destChain], burnNonce[from]++);
        // the api can try to process the same transaction multiple times i.e. it can read the same event multiple times , that wont be a problem
        emit CrossChainBurn(from, to, _amountIn, destChain, chainToBridge[destChain], burnNonce[from] - 1);
        emit CrossChainBurnReceipt(from, to, THIS_CHAIN, block.timestamp, block.number, _hash);
        // let the user save the transaction hash and also the hash
    }
    // web3 sign txn with params -> from, to, amountOut, fromChainName, toChainName, addressBridge1, addressBridge2
    // no need to pass the current chain name and address since we are listening to those events, we know them

// address origin chain is known
    function transferMint(address from, address to, uint256 amount, string memory srcChain, uint256 _nonce, uint8 v, bytes32 r, bytes32 s)
      external virtual onlyAPI active {
        // verify the data onchain
        // abi encode and keccack the input params
        // decode signer address
        // verify and then mint tokens to the the address
        bytes32 _hash = _buildHash(from, to, amount, srcChain, THIS_CHAIN, chainToBridge[srcChain], address(this), _nonce);
        require(!done[_hash], "Bridge: Txn Already Minted");
        done[_hash] = true;
        address _signer = ecrecover(_hash.toEthSignedMessageHash(),v,r,s);
        // address _signer = _hash.toEthSignedMessageHash().recover(signature);
        // return _signer;
        require(SIGNER == _signer, "Bridge: wrong signer!");
        uint256 _amountOut = amountOut(amount);
        require(IERC20Mintable(TOKEN).mint(to, _amountOut), "Bridge: Failed to mint tokens");

        emit CrossChainMint(from, to, amount, srcChain, chainToBridge[srcChain]);
        emit CrossChainMintReceipt(from, to, THIS_CHAIN, block.timestamp, block.number, _hash);
    }

    function _buildHash(
      address from, 
      address to, 
      uint256 amount, 
      string memory srcChain, 
      string memory destChain, 
      address srcBridge,
      address destBridge,
      uint256 nonce
    ) internal virtual view returns (bytes32) {
      uint256 _now = block.timestamp;
      bytes4 thisChainHash = bytes4(keccak256(abi.encode(THIS_CHAIN,_now)));
      bytes4 srcChainHash = bytes4(keccak256(abi.encode(srcChain,_now)));
      bytes4 destChainHash = bytes4(keccak256(abi.encode(destChain,_now)));
      require(srcChainHash == thisChainHash || chainToBridge[srcChain] != address(0), "Bridge: Unregistered src Chain");
      require(destChainHash == thisChainHash || chainToBridge[destChain] != address(0), "Bridge: Unregistered Destination Chain");

      bytes32 hash = keccak256(abi.encode(
        from, to, amount, srcChain, destChain, srcBridge, destBridge, nonce
      ));
      return hash;
    }


}
/*
Better make in the form of structs and test, structs sending etc via frontend
*/


interface IERC20Burnable {
    function burnFrom(address account, uint256 amount) external returns (bool success);
}

interface IERC20Mintable {
    function mint(address account, uint256 amount) external returns (bool success);
}

interface IERC20 {
  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);

  function totalSupply() external view returns (uint256);
  function balanceOf(address account) external view returns (uint256);
  function transfer(address recipient, uint256 amount) external returns (bool);
  function allowance(address owner, address spender) external view returns (uint256);
  function approve(address spender, uint256 amount) external returns (bool);
  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);
}


library ECDSA {

  /**
   * @dev Recover signer address from a message by using their signature
   * @param hash bytes32 message, the hash is the signed message. What is recovered is the signer address.
   * @param signature bytes signature, the signature is generated using web3.eth.sign()
   */
  function recover(bytes32 hash, bytes memory signature) internal pure returns (address) {
    bytes32 r;
    bytes32 s;
    uint8 v;

    // Check the signature length
    if (signature.length != 65) {
      return (address(0));
    }

    // Divide the signature in r, s and v variables with inline assembly.
    assembly {
      r := mload(add(signature, 0x20))
      s := mload(add(signature, 0x40))
      v := byte(0, mload(add(signature, 0x60)))
    }

    // Version of signature should be 27 or 28, but 0 and 1 are also possible versions
    if (v < 27) {
      v += 27;
    }

    // If the version is correct return the signer address
    if (v != 27 && v != 28) {
      return (address(0));
    } else {
      // solium-disable-next-line arg-overflow
      return ecrecover(hash, v, r, s);
    }
  }

  /**
    * toEthSignedMessageHash
    * @dev prefix a bytes32 value with "\x19Ethereum Signed Message:"
    * and hash the result
    */
  function toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
    return keccak256(
      abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
    );
  }  
}


/*

FLOW
----
set the following after deployment

function unpause
function setLimit(uint256 _limit) external onlyOwner
function setAPI(address _API) external onlyOwner
function setSigner(address _signer) external onlyOwner
function setBridgeAddressOnChain(string memory chain, address bridge)


Approve token so that it can be sent to the contract

*/



