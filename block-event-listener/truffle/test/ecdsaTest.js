const { ether, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const { expect } = require("chai");

const Bridge = artifacts.require("BridgeV1")
const Token = artifacts.require("Token")

contract("Bridge Contract", async (accounts) => {
    
    const [owner, user, api] = accounts
    const PRIVATE_KEY = process.env.SIGNER_PRIVATE;
    const PUBLIC_KEY = process.env.SIGNER_PUBLIC;

    // beforeEach(async () => {
    //     this.token = await Token.new()
    //     this.bridge = await Bridge.new(this.token.address,"BSC")
    //     console.log(`---- BRIDGE deployed at ${this.bridge.address} ------`)
    // })

    describe("when contract is deployed and paused", function () {
        before(async () => {
            this.token = await Token.new();
            this.token2 = await Token.new();
            this.bridge = await Bridge.new(this.token.address,"CHAIN1");
            this.bridge2 = await Bridge.new(this.token2.address,"CHAIN2")
            console.log(`---- BRIDGE deployed at: ${this.bridge.address} ------`);
            console.log(`---- BRIDGE2 deployed at: ${this.bridge2.address} ------`);
            await this.token.setBridge(this.bridge.address)
            await this.bridge.unpauseContract();
            await this.bridge.setLimit(100);
            await this.bridge.setSigner(PUBLIC_KEY);
            await this.bridge.setAPI(api);
            await this.bridge.setBridgeAddressOnChain("CHAIN2", this.bridge2.address);
            await this.bridge.setFee(10);
            // console.log(`------State: ${await this.bridge.state()}`)

            await this.token2.setBridge(this.bridge2.address)
            await this.bridge2.unpauseContract();
            await this.bridge2.setLimit(100);
            await this.bridge2.setSigner(PUBLIC_KEY);
            await this.bridge2.setAPI(api);
            await this.bridge2.setBridgeAddressOnChain("CHAIN1", this.bridge.address);
            await this.bridge2.setFee(10);
        })
        
        it("should not let the non owner set the params", async () => {
            await expectRevert(
                this.bridge.setSigner(PUBLIC_KEY, { from : user }),
                "Ownable: caller is not the owner."
            )
        })

        it("should have correct params: token contract", async () => {
            expect(await this.token.totalSupply()).to.be.bignumber.equal("1000");
        })

        it("should have correct params: bridge contract", async () => {
            expect(await this.bridge.owner()).to.be.equal(owner);
            expect(await this.bridge.state()).to.be.bignumber.equal("1");
            expect(await this.bridge.LIMIT()).to.be.bignumber.equal("100");
            expect(await this.bridge.FEE()).to.be.bignumber.equal("10");
        })


        it("should burn and emit event", async () => {
            // function transferBurn(address to, uint256 amount, string memory destChain) 
            // allow tokens
            await this.token.approve(this.bridge.address, 50)
            const nonce = parseInt(await this.bridge.getNonce(owner))
            const receipt = await this.bridge.transferBurn(user, "50", "CHAIN2", { from : owner, value : 10 } );
            
            expectEvent(
                receipt,
                "CrossChainBurn",
                {
                    from: owner,
                    to: user,
                    amountOut: "50",
                    toChain: 'CHAIN2',
                    toBridgeAddress: this.bridge2.address,
                    nonce: web3.utils.toBN(nonce)
                }
            )

            // console.log(`web3 balance ${await web3.eth.getBalance(api)}`)
            // const balanceAfter = await web3.eth.getBalance(api);

            expect(await web3.eth.getBalance(api)).to.be.bignumber.equal("100000000000000000010");
            console.log("RECEIPT onchainHash",receipt.logs[1].args.onChainHash)

            // construct the offchainHash again
            const encoded = web3.eth.abi.encodeParameters(
                ["address", "address", "uint256", "string", "string", "address", "address", "uint256"],
                [owner, user, "10", "CHAIN1", "CHAIN2", this.bridge.address, this.bridge2.address, nonce]
            )
    //         "POLYGON" : "0xD1213e8832dc462115824598BA5b8c5Fe014970F",
    // "BSC" : "0xd625D767De746cfE0a9b476bbA5C54F20CfD41eC"
            // const encoded = web3.eth.abi.encodeParameters(
            //     ["address", "address", "uint256", "string", "string", "address", "address", "uint256"],
            //     ['0x405b3cA1047C933F8d0714009Bfa43B5F1DA6376', "0x405b3cA1047C933F8d0714009Bfa43B5F1DA6376", "10", "POLYGON", "BSC", "0xD1213e8832dc462115824598BA5b8c5Fe014970F", "0xd625D767De746cfE0a9b476bbA5C54F20CfD41eC", nonce]
            // )
            
            const hash = web3.utils.keccak256(encoded)
            const signedHash = await web3.eth.accounts.sign(hash, PRIVATE_KEY)
            console.log(`hash: ${JSON.stringify(signedHash)}`)

            let x = await this.bridge2.transferMint(
                owner, user, 50, "CHAIN1", nonce, signedHash["v"], signedHash["r"], signedHash["s"], { from : api }
            )
            // console.log(`---------signer : ${x}`)
            expectEvent(
                x,
                "CrossChainMint",
                {
                    from: owner,
                    to: user,
                    amountOut: "50",
                    fromChain: 'CHAIN1',
                    fromBridgeAddress: this.bridge.address
                }
            )

            expect(await this.token2.balanceOf(user)).to.be.bignumber.equal("50");
            expect(await this.bridge2.isDone(hash)).to.be.equal(true);

    //   address from, 
    //   address to, 
    //   uint256 amount, 
    //   string memory srcChain, 
    //   string memory destChain, 
    //   address srcBridge,
    //   address destBridge

        })

    })    

})

/**/


/*

function unpause
function setLimit(uint256 _limit) external onlyOwner
setFee
function setAPI(address _API) external onlyOwner
function setSigner(address _signer) external onlyOwner
function setBridgeAddressOnChain(string memory chain, address bridge)

*/





/*

using nonce while sending transaction from the first side
so that overlapping blocks if processed dont mint twice

only API can mint the token

only valid signer should be able to mint the tokens

onChainHash is shown to users so that they can query the data on the other chain
whether it was processed or not

--------------------------------------------------------------------------------

json file in the backend to listen to the blocks and write those blocks from time to time
every few seconds

same json file should also contain all the details like
chain and address mapping of bridges,
last block processed

in env file private parmas like private key for signer, for API

make backend api using the above settings with manual intervention
then automate it after that

*/