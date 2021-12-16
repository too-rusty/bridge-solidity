require('dotenv').config()
const fs = require('fs')
const Web3 = require('web3')
const Bridge = require('./truffle/build/contracts/BridgeV1.json')
// const Bridge = require('./bridge_bsc_abi.json')
const settingsPath = `${__dirname}/settings.json` // change this to prod for prod
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
    // Bridge.abi
    Bridge.abi,
    settings["BSC"]["BRIDGE"] // bridge contract on bsc
)
const bridge_matic = new w3_matic.eth.Contract(
    Bridge.abi,
    settings["POLYGON"]["BRIDGE"] // bridge contract on polygon
)

const ALREADY_MINTED_ERROR = "Bridge: Txn Already Minted"
// api is same as owner here ,that doesnt matter , it can be different but set in contracts too
// https://ethereum.stackexchange.com/questions/83413/signing-a-raw-transaction-wrong-r-and-s-values

const send_mint_txn = (srcChain, destChain) => {
    let bridge, w3;
    switch(destChain) {
    case "BSC":
        bridge = bridge_bsc
        w3 = w3_bsc
        break;
    case "POLYGON":
        bridge = bridge_matic
        w3 = w3_matic
        break;
    default:
    }

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
        console.log(`----- SUCCESSFULLY MINTED --------`)
        return receipt.status
    }
}

const runEventListener = async (eventName, bridge, srcChain) => {
    const events = await bridge.getPastEvents(eventName, {
        fromBlock : settings[srcChain]["LAST_BLOCK_SYNCED"] - settings[srcChain]["BLOCK_SYNC_RANGE"],
        toBlock : settings[srcChain]["LAST_BLOCK_SYNCED"]
    })

    let isErr = false;
    // console.log(events)
    for (let i = 0; i < events.length; i++) {
        const e = events[i].returnValues
        console.log("TxnHash",events[i]['transactionHash'])
        console.log("BlockNumber",events[i]['blockNumber'])
        try {
            await send_mint_txn(srcChain, e.toChain)(e.from, e.to, e.amountOut, e.nonce)
        } catch (e) {
            // isErr = true;
            const msg = e.message.replace("Returned error: execution reverted: ","")
            if (msg === ALREADY_MINTED_ERROR) {
            } else {
                isErr = true
            }
            console.log("ERROR: ",msg)
        }
    }
    if (!isErr) {
        settings[srcChain]["LAST_BLOCK_SYNCED"] += settings[srcChain]["BLOCK_SYNC_RANGE"];
        settings[srcChain]["LAST_BLOCK_SYNCED"] -= 10; // maintain some offset for overlapping ranges
        // fs.writeFileSync(settingsPath, JSON.stringify(settings))
    }
}

runEventListener("CrossChainBurn", bridge_bsc, "BSC").catch(console.log)
// runEventListener("CrossChainBurn", bridge_matic, "POLYGON").catch(console.log)

// 22034303
// 14514129


// 0xD1213e8832dc462115824598BA5b8c5Fe014970F

// prod POLY Block START - 22131671


/*

some improvements

1. use files like json etc                                              - DONE
2. error handling to know that txn took place or not, very imp
3. periodic , every few minutes
4. UI and error handling should be top notch
5. deployment etc should be easier
6. understand account addition and matic stuff, how it works for web3
7. better to have a source chain , destination chain maybe

*/


/*

get transaction hash and then the receipt
if it is false then transaction failed
else passed

fail reason ???


https://ethereum.stackexchange.com/questions/39237/how-to-get-transaction-hash-of-a-function-call-from-web3/67859

ANSWER

so use await and also know the transaction hash ! to send to the users , awesome 


SOME TODOS
-----------
1. add a function to calculate price on each chain so that the bridging goes according to that

*/