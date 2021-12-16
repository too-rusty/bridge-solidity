const express = require("express")
const fs = require('fs');
const { exit } = require("process");
const { runMinter } = require("./index.js");
const app = express()
app.use(express.json())

const Database = require('better-sqlite3');
const db = new Database('./db/foobar.db', { verbose: console.log });

// API key verification middleware
const auth_middleware = (req, res, next) => {
    try {
        const token = req.headers.key;
        if (parseInt(token) !== 1654317612) {
            throw 'Invalid key!';
        } else {
            next();
        }
    } catch {
        res.status(401).json({
            "error": "Invalid key"
        });
    }
};




// {
//     "src_chain":"BSC" | "POLYGON",
//     "start_block": number,
//     "end_block": maybe number, >= start_block
//     "txn_hash": maybe hash
// }

// {
//     "data": [
//         {
//             "src_address": "0x405b3cA1047C933F8d0714009Bfa43B5F1DA6376",
//             "src_chain": "BSC",
//             "src_chain_txn_hash": "0x978caeaeb7ce880ba1dcd33e13e40d07ab37fa765f457ca733c6a78c01b82eaa",
//             "src_block_number": 15027285,
//             "dest_chain": "POLYGON",
//             "dest_chain_txn_hash": null,
//             "txn_status": true,
//             "error_msg": "Bridge: Txn Already Minted"
//         }
//     ],
//     "error": null
// }
app.post('/mint', auth_middleware,  async (req, res) => {
    console.log("runmInt", runMinter)
    const { src_chain, start_block, end_block, txn_hash } = req.body
    let ret = await runMinter(src_chain, start_block, end_block, txn_hash)
    const data = ret["data"]
    for(let i = 0; i < data.length; i++) {
        let r = data[i]
        // console.log("R", r)
        // console.log(r["src_address"], r["src_chain_txn_hash"], r["src_block_number"], r["src_chain"], r["dest_chain"], r["txn_status"])
        const txn = get_by_chain_txnHash(r["src_chain"],r["src_chain_txn_hash"])
        // console.log(txn)
        if(txn.length > 0){
            console.log(`Txn already present`)
            // maybe update it
            if(txn[0]["dest_chain_txn_hash"] && txn[0]["dest_chain_txn_hash"].length > 0) {
                r["dest_chain_txn_hash"] = txn[0]["dest_chain_txn_hash"]
                console.log("dest_chain_txn_hash: ", r["dest_chain_txn_hash"])
            }
            update_txn_into_table(r["src_chain_txn_hash"], r["src_chain"], r["dest_chain_txn_hash"], r["txn_status"])
        } else {
            insert_txn_into_table(
                r["src_chain_txn_hash"], r["src_address"], r["src_block_number"], r["src_chain"], r["dest_chain"], r["dest_chain_txn_hash"], r["txn_status"]
            )
        }
        console.log("ALL",find_all())
    }
    res.json(ret)
})


/*

getByChain
getByTxnHash
getByAddress

*/

app.listen(3000,"127.0.0.1", async () => {
    create_tables()
})

// key 1654317612

//DB STUFF
const create_tables = () => {
    db.prepare(`CREATE TABLE IF NOT EXISTS Transactions (
        txn_hash_with_chain TEXT PRIMARY KEY,
        txn_hash TEXT,
        src_address TEXT,
        src_chain TEXT,
        src_block_number INTEGER,
        dest_chain TEXT,
        dest_chain_txn_hash TEXT,
        minted INTEGER
    );`).run()
}

const insert_txn_into_table = (txn_hash, src_address, src_block_number, src_chain, dest_chain, dest_chain_txn_hash, minted) => {
    let minted_txn = 0;
    if(minted) minted_txn = 1;
    let combined = src_chain + '_' + txn_hash
    const insert_query = `INSERT INTO Transactions (
        txn_hash_with_chain,
        txn_hash,
        src_address,
        src_chain,
        src_block_number,
        dest_chain,
        dest_chain_txn_hash,
        minted
    ) VALUES(?,?,?,?,?,?,?,?)`
    const info = db.prepare(
        insert_query
    ).run(combined, txn_hash, src_address, src_chain, src_block_number, dest_chain, dest_chain_txn_hash, minted_txn)
    console.log(`ROWS INSERTED: ${info.changes}`)
}

const update_txn_into_table = (txn_hash, src_chain, dest_chain_txn_hash, minted) => {
    let minted_txn = 0;
    if(minted) minted_txn = 1;
    let combined = src_chain + '_' + txn_hash
    const insert_query = `UPDATE Transactions SET
        dest_chain_txn_hash = ?,
        minted = ?
        WHERE txn_hash_with_chain = ?`
    const info = db.prepare(
        insert_query
    ).run(dest_chain_txn_hash, minted_txn, combined)
    console.log(`ROWS UPDATED: ${info.changes}`)
}


const get_by_chain_txnHash = (chain, txnHash) => {
    let combined = chain + '_' + txnHash
    return db.prepare(`select * from Transactions where txn_hash_with_chain = ?`).all(combined)
}
const find_all = () => {
    return db.prepare(`select * from Transactions`).all()
}
const find_by_address = (src_address) => {
    return db.prepare(`select * from Transactions where src_address = ?`).all(src_address)
}
const find_by_txnHash = (txn_hash) => {
    return db.prepare(`select * from Transactions where txn_hash = ?`).all(txn_hash)
}
const find_by_chain = (chain) => {
    return db.prepare(`select * from Transactions where src_chain = ?`).all(chain)
}


// ping to know if server is alive
app.get('/PING', async (req, res) => {
    res.status(200).json({
        'data' : 'PONG'
    })
})




/*
The bridge server

Flow -> user approve their token , one time thing

1. User clicks on transfer burn
2. the function returns a receipt ( for this the receipt need to be returned by frontend )
    receipt must contain the transaction hash and the block number ( atleast nearby block number )
3. the user queries with the block number and the transaction hash
4. the api gets called and the response is awaited and returned, also saved in the local map (used as db)
5. cross chain mint happens and the response is sent back to user
    case DONE: this is easy, update the map and send success to user
    case FAIL: update map with fail and tell user to try again with txn hash and block number

user also pings to sync all blocks in a range



TXNS
{
    "txn_hash_string" : {
        "block_number" : int,
        "state" : int,
        "reason" : string     
    }
}

0 -> FAIL
1 -> MINTED



Integration test also needs to written
which simulates all the action with server started !


API1 -> { tx_hash, block_number } -> try minting and return response , also SAVE in db
API2 -> { block number , from , to } -> mint all in between and return the status , how many minted in detail, also save in db
    also query from db before to check if the status is true, only if it is not true, mint it
API3 -> status of a transaction hash or block number , get all transactions , getter so that the frontend can query
    this is to query the db

take db backup from time to time

script to change the signer etc
script to verify things and stuff




FINAL FLOW
-----------
1. user approves the token 
    - TO BE DONE BY FRONTEND
2. user sends the transaction to burn the token , receipt is returned after sending transaction 
    - TO BE DONE BY FRONTEND ONLY
3, frontend sends the transaction hash and block number , calling the backend API which handles the minting part after verifying the block and event 
    - TO BE DONE BY BACKEND
4. backend mints and returns sucess to frontend
    ERROR CASES
        1. if fee is not enough - CHECK THIS SCENARIO ( just try with a random empty address )
        2. some contract error - this will be returned so store it



APPROVE -> BURN -> (RECEIPT, TXN_HASH, BLOCK_NUMBER) -> MINT


*/