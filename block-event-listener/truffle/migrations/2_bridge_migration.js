
require('dotenv').config()
const Token = artifacts.require("Token")
const Bridge = artifacts.require("BridgeV1");
const LIMIT = web3.utils.toWei("10","ether")
const FEE_MATIC = web3.utils.toWei("0.1","ether")
const FEE_BNB = web3.utils.toWei("0.05","ether")


const jsonPath = `${__dirname}/../common.json`
module.exports = async(deployer, network, accounts) => {

    let common = require(jsonPath)
    const fs = require('fs')
    let bridge, token;

    if (network === 'matic_mumbai') {
        if (!common[network]["token"] || common[network]["token"] === "" ) {
            console.log(`Token Not DEPLOYED!!`)
            return
        }

        try {
            token = await Token.at(common[network]['token'])

            if(!common[network]['bridge'] || common[network]['bridge'] === "") {
                await deployer.deploy(Bridge, token.address, "POLYGON");
                bridge = await Bridge.deployed();
            } else {
                bridge = await Bridge.at(common[network]['bridge'])
                console.log(`bridge already Deployed at: ${common[network]['bridge']}`)
            }
        } catch (e) {
            console.log(`Error while deploying bridge: ${e}`);
        }
    }

    if (network === 'bsc_testnet') {
        if (!common[network]["token"] || common[network]["token"] === "" ) {
            console.log(`Token Not DEPLOYED`)
            return
        }

        try {
            token = await Token.at(common[network]['token'])
            if(!common[network]['bridge'] || common[network]['bridge'] === "") {
                await deployer.deploy(Bridge, token.address, "BSC");
                bridge = await Bridge.deployed();
            } else {
                bridge = await Bridge.at(common[network]['bridge'])
                console.log(`bridge already Deployed at: ${common[network]['bridge']}`)
            }
        } catch (e) {
            console.log(`Error while deploying bridge: ${e}`);
        }
    }

    if (network === 'matic_mainnet') {
    }

    if (network === 'bsc_mainnet') {    
    }

    common[network]['bridge'] = bridge.address
    fs.writeFileSync(jsonPath, JSON.stringify(common)) // write down the common of deployed tokens

    try {
        await token.setBridge(bridge.address);
        console.log(`Unpausing Contract!`)
        await bridge.unpauseContract();
        console.log(`Unpaused Contract!`)
        await bridge.setLimit(LIMIT);

        console.log(`setting signer ${process.env.SIGNER_PUBLIC}`)
        await bridge.setSigner(process.env.SIGNER_PUBLIC);
        console.log(`signer SET ${process.env.SIGNER_PUBLIC}`)

        console.log(`setting API ${process.env.API_PUBLIC_TEST}`)
        await bridge.setAPI(process.env.API_PUBLIC_TEST);
        console.log(`API SET ${process.env.API_PUBLIC_TEST}`)
        
        console.log(`setting FEE`)
        await bridge.setFee(FEE_BNB); //wei
        console.log(`FEE SET`)

        console.log(`DEPLOYED SUCCESFULLY AND PARAMS SET!!!`)
    } catch(e) {
        console.log(`EXCEPTION: ${e}`)
    }

    

}