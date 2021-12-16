require('dotenv').config()
const fs = require('fs')
const Web3 = require('web3')
const bridge_abi = require('./BridgeV1.json')
// const Bridge = require('./bridge_bsc_abi.json')
const settingsPath = `${__dirname}/settings-dev.json` // change this to prod for prod
let settings = JSON.parse(fs.readFileSync(settingsPath))

const SIGNER_PRIVATE = process.env.SIGNER_PRIVATE
const PRIVATE = process.env.MNEMONIC_TEST

const w3_bsc = new Web3(settings["BSC"]["RPC"])
const w3_matic = new Web3(settings["POLYGON"]["RPC"])


const { address: signer } = w3_bsc.eth.accounts.wallet.add(SIGNER_PRIVATE);
const { address: api } = w3_bsc.eth.accounts.wallet.add(PRIVATE);
w3_matic.eth.accounts.wallet.add(SIGNER_PRIVATE);
w3_matic.eth.accounts.wallet.add(PRIVATE);

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

const ALREADY_MINTED = "Bridge: Txn Already Minted"
// api is same as owner here ,that doesnt matter , it can be different but set in contracts too
// https://ethereum.stackexchange.com/questions/83413/signing-a-raw-transaction-wrong-r-and-s-values

const send_mint_txn = (srcChain, destChain) => {
    let w3;
    switch(destChain) {
    case "BSC":
        w3 = w3_bsc
        break;
    case "POLYGON":
        w3 = w3_matic
        break;
    }
    let bridge = get_bridge_instance(destChain)

    return async (from, to, amount, nonce) => {

        // const [api] = await w3.eth.personal.getAccounts();
        // const api = "0x405b3cA1047C933F8d0714009Bfa43B5F1DA6376"
        // console.log(api)
        const encoded = await w3.eth.abi.encodeParameters(
            ["address", "address", "uint256", "string", "string", "address", "address", "uint256"],
            [from, to, amount, srcChain, destChain, settings[srcChain]["BRIDGE"], settings[destChain]["BRIDGE"], nonce]
        )
        // console.log(encoded)
        const hash = await w3.utils.keccak256(encoded)
        // console.log("---- HASH: ", hash)

        const signedHash = await w3.eth.sign(hash, signer) // WORKS
        // console.log(`----- SIGNED HASH: ${JSON.stringify(signedHash)}`)
        
        const v = "0x"+signedHash.slice(130,132);
        const r = "0x"+signedHash.slice(2,66);
        const s = "0x"+signedHash.slice(66,130);
        // console.log("V R S", v, r, s)
        const tx = bridge.methods.transferMint(
            from, to, amount, srcChain, nonce, v, r, s
        )
        console.log(`API: ${api}`)
        console.log("-----PROCESSING-----")
        console.log(`SrcChain: ${srcChain}\nDestChain: ${destChain}\nFrom : ${from}\nTo: ${to}\nAmount: ${amount}\nNonce: ${nonce}`)
        const [gasPrice, gasCost] = await Promise.all([
            w3.eth.getGasPrice(),
            tx.estimateGas({from:api})
        ]);
        const data = tx.encodeABI();
        // console.log("-----DATA", data)
        const txData = {
            from:api,
            to:settings[destChain]["BRIDGE"],
            data,
            gas:gasCost,
            gasPrice
        };
        // var bufTxData = Buffer.from(JSON.stringify(txData));
        // var transactionHash = w3.utils.sha3(bufTxData, { encoding: "hex" });
        // console.log(`TRANSACTION HASH: ${transactionHash}`)

        // doest work, use status of the receipt to know if the transaction was successful or not

        let receipt = await w3.eth.sendTransaction(txData)
        console.log("TXN HASH: ", receipt.logs[0].transactionHash)
        console.log("BLOCK NUM: ", receipt.logs[0].blockNumber)
        console.log("TXN STATUS: ", receipt.status)
        console.log(`----- SUCCESSFULLY MINTED --------`)
        // console.log("Full Receipt: ", receipt)
        return {"txn_hash" : receipt.logs[0].transactionHash, "status": receipt.status}
    }
}

const runEventListener = async (srcChain, fromBlock, toBlock, txnHash=undefined) => {
    const bridge = get_bridge_instance(srcChain)
    const eventName = "CrossChainBurn"
    const offset = 1
    let events
    try {
        events = await bridge.getPastEvents(eventName, {
            fromBlock : fromBlock-offset,
            toBlock : toBlock+offset
        })
    } catch (e) {
        return {"data": null, "error": e.message}
    }
    let arr = []
    for (let i = 0; i < events.length; i++) {
        const currentBlock = events[i]['blockNumber']
        if (currentBlock < fromBlock || currentBlock > toBlock) continue
        const e = events[i].returnValues
        const curr_txn_hash = events[i]['transactionHash']
        const data_before = {
            "src_address": e['from'],
            "src_chain": srcChain,
            "src_chain_txn_hash": curr_txn_hash,
            "src_block_number": currentBlock
        }
        console.log("TxnHash",curr_txn_hash)
        console.log("Current BlockNumber",currentBlock)
        if (txnHash && curr_txn_hash !== txnHash) continue
        let status = false
        let txn_hash = null
        let dest_chain = e.toChain
        try {
            let ret = await send_mint_txn(srcChain, dest_chain)(e.from, e.to, e.amountOut, e.nonce)
            arr.push({
                ...data_before, 
                "dest_chain": dest_chain,
                "dest_chain_txn_hash": ret["txn_hash"],
                "txn_status": ret["status"],
                "error_msg":null
            })
        } catch (e) {
            const msg = e.message.replace("Returned error: execution reverted: ","")
            console.log("ERROR: ",msg)
            let _status = false
            if (msg === ALREADY_MINTED) _status = true
            arr.push({
                ...data_before,
                "dest_chain": dest_chain,
                "dest_chain_txn_hash": null,
                "txn_status": _status,
                "error_msg":msg
            })
        }
        console.log("Txn Status Returned:", status)
    }
    return {"data": arr, "error": null}
}



// const txn_hash = "0x2a65623e32534900e626b64a746c3fe6f05c21b7aa2d36babaeffdca0d4844b8"
// runEventListener("BSC", 14996766, 14996766, txn_hash).then(res => console.log("RES", res)).catch(console.log)
// runEventListener("CrossChainBurn", bridge_matic, "POLYGON").catch(console.log)

const runMinter = async (chain, start_block, end_block=undefined, txn_hash=undefined) => {
    return await runEventListener(chain, start_block, end_block || start_block, txn_hash)
}

module.exports.runMinter = runMinter

/*
Possible ERRORS - Solution

1. Only API can call the function - the api should be whitelisted as a minter
2. insufficient funds for gas * price + value - Should send the require tokens as a fee
3. Wrong signer - signer is wrong, need to correct that
4.


*/