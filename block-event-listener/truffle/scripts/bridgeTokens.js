

const Token = artifacts.require("Token");
const Bridge = artifacts.require("BridgeV1");
const jsonPath = `${__dirname}/../common.json`

const toWei = (x) => web3.utils.toWei(x, "ether")

module.exports = async done => {
    const dashdashNetwork = process.argv[process.argv.length - 2]
    if (dashdashNetwork !== '--network') {
        console.log(`--network NETWORK_NAME should be the last set of arguments`)
        return
    }
    const network = process.argv[process.argv.length - 1] // should end with --network something
    let common = require(jsonPath)
    
    const bridge = await Bridge.at(common[network]['bridge'])
    const token = await Token.at(common[network]['token'])
    
    const [admin] = await web3.eth.getAccounts()
    
    console.log(`--------- Admin addr : ${admin}`)
    console.log(`--------- Deployed token at ${token.address}`);
    console.log(`--------- Deployed bridge at ${bridge.address}`);
    try {
        console.log(`--- my balance before : ${parseInt(await token.balanceOf(admin))} WEI`)
        let b = await web3.eth.getBlockNumber()
        console.log(`(before burn)CURRENT BLOCK : ${b}`)

        await token.approve(bridge.address, 10);
        const txn = await bridge.transferBurn(admin, 10, "BSC", { from : admin, value: toWei(common[network]['fee']) } );
        // console.log(`TXN DETAILS: ${JSON.stringify(txn)}`)

        const txn_hash = txn['tx']
        const block_number = txn['receipt']['blockNumber']
        console.log(`txnHash: ${txn_hash} , blockNumber: ${block_number}`)

        console.log(`--- my balance after : ${parseInt(await token.balanceOf(admin))} WEI`)
        b = await web3.eth.getBlockNumber()

    } catch (e) {
        console.log(`ERROR THROWN: ${e.message}`)
    }

    done()

}