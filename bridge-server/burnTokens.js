require('dotenv').config()
const fs = require('fs')
const Web3 = require('web3')
// let bridge_abi_json = require('./BridgeV1.json')
// let bridge_abi = bridge_abi_json["abi"]

let bridge_abi = require('./BridgeV1_2.json')

const erc20_abi = require('./ERC20.json')
const settingsPath = `${__dirname}/settings-dev.json` // change this to prod for prod
let settings = JSON.parse(fs.readFileSync(settingsPath))

const PRIVATE = process.env.MNEMONIC_TEST
const user = "0x405b3cA1047C933F8d0714009Bfa43B5F1DA6376"

const w3_bsc = new Web3(settings["BSC"]["RPC"])
const w3_matic = new Web3(settings["POLYGON"]["RPC"])

const { address: api } = w3_bsc.eth.accounts.wallet.add(PRIVATE);
w3_matic.eth.accounts.wallet.add(PRIVATE);

const toWei = (x) => { return w3_bsc.utils.toWei(x, "ether") }
const fromWei = (x) => { return w3_bsc.utils.fromWei(x, "ether") }

const bridge_bsc = new w3_bsc.eth.Contract(
    bridge_abi,
    // Bridge.abi,
    settings["BSC"]["BRIDGE"] // bridge contract on bsc
)
const bridge_matic = new w3_matic.eth.Contract(
    bridge_abi,
    // Bridge.abi,
    settings["POLYGON"]["BRIDGE"] // bridge contract on polygon
)

const get_bridge_instance = (_chain) => {
    switch (_chain) {
    case "BSC":
        return new w3_bsc.eth.Contract(bridge_abi, settings[_chain]["BRIDGE"])
    case "POLYGON":
        return new w3_matic.eth.Contract(bridge_abi, settings[_chain]["BRIDGE"])
    }
    return null
}

const send_burn_txn = (srcChain, destChain) => {
    let w3;
    switch(srcChain) {
    case "BSC":
        w3 = w3_bsc
        break;
    case "POLYGON":
        w3 = w3_matic
        break;
    }
    let bridge = get_bridge_instance(srcChain)
    return async (to, amount) => {
        try {
            const fee = await bridge.methods.FEE().call({from:user})
            console.log(`BURN FEE: ${fromWei(fee)} ETH`)
            console.log("TRYING BURNING")
            const tx = bridge.methods.transferBurn(
                to, amount, destChain
            )
            const [gasPrice, gasCost] = await Promise.all([
                w3.eth.getGasPrice(),
                tx.estimateGas({from:user, value:toWei("0.1") })
            ]);
            const data = tx.encodeABI();
            // const [user] = await w3.eth.getAccounts()
            console.log(`MSG SENDER: ${user}`)
            const txData = {
                from:user,
                to: settings[srcChain]["BRIDGE"],
                data,
                gas:gasCost,
                gasPrice
            };
            let receipt = await w3.eth.sendTransaction(txData)
            console.log("TXN HASH: ", receipt.logs[0].transactionHash)
            console.log("BLOCK NUM: ", receipt.logs[0].blockNumber)
            console.log("TXN STATUS: ", receipt.status)
            console.log(`----- SUCCESSFULLY BURNED --------\n`)
        } catch (e) {
            throw e
        }
    }
}

const approve_token = async (srcChain, amount) => {
    // amount is in wei
    try {
        let w3, token_addr;
        switch(srcChain) {
        case "BSC":
            w3 = w3_bsc
            token_addr = "0xd528Ce8Ec79b3899F6BE84edd2b5Fc8224c14997"
            break;
        case "POLYGON":
            w3 = w3_matic
            token_addr = ""
            break;
        }
        const token = new w3.eth.Contract(erc20_abi["abi"], token_addr)
        const tx = token.methods.approve(settings[srcChain]["BRIDGE"], amount)
        const [gasPrice, gasCost] = await Promise.all([
            w3.eth.getGasPrice(),
            tx.estimateGas({from:user})
        ]);
        const data = tx.encodeABI();
        const txData = {
            from:user,
            to: token_addr,
            data,
            gas:gasCost,
            gasPrice
        };
        let receipt = await w3.eth.sendTransaction(txData)
        console.log("TXN HASH: ", receipt.logs[0].transactionHash)
        console.log("BLOCK NUM: ", receipt.logs[0].blockNumber)
        console.log("TXN STATUS: ", receipt.status)
        console.log(`----- SUCCESSFULLY APPROVED --------\n`)
    } catch (e) {
        throw e
    }
}

const check_balance = async (srcChain) => {
    try {
        let w3, token_addr;
        switch(srcChain) {
        case "BSC":
            w3 = w3_bsc
            token_addr = "0xd528Ce8Ec79b3899F6BE84edd2b5Fc8224c14997"
            break;
        case "POLYGON":
            w3 = w3_matic
            token_addr = ""
            break;
        }
        const token = new w3.eth.Contract(erc20_abi["abi"], token_addr)
        const val = await token.methods.balanceOf(user).call({from:user})
        console.log("NUMBER OF TOKENS",fromWei(val)," ETH")
        console.log(`ETH BALANCE: ${fromWei(await w3.eth.getBalance(user))} ETH\n`)
    } catch (e) {
        throw e
    }
}

// dont forget to approve on metamask before trying this out
check_balance("BSC").
    then(_ => approve_token("BSC", toWei("10"))).
        then(_ => send_burn_txn("BSC", "POLYGON")(user, toWei("10"))).
            then(_ => check_balance("BSC")).
                catch(console.log)
// approve_token("BSC", toWei("10")).
//     then(_ => send_burn_txn("BSC", "POLYGON")(user, toWei("10"))).
//         catch(console.log)