
const Token = artifacts.require("Token");
const Bridge = artifacts.require("BridgeV1");
const jsonPath = `${__dirname}/../common.json`
module.exports = async done => {
    
    const dashdashNetwork = process.argv[process.argv.length - 2]
    if (dashdashNetwork !== '--network') {
        console.log(`--network NETWORK_NAME should be the last set of arguments`)
        return
    }
    const network = process.argv[process.argv.length - 1] // should end with --network something
    let common = require(jsonPath)
    const bridge = await Bridge.at(common[network]['bridge'])
    
    const matic_test = common['matic_mumbai']['bridge']
    const bsc_test = common['bsc_testnet']['bridge']
    const bsc_main = common['bsc_mainnet']['bridge']
    const matic_main = common['matic_mainnet']['bridge']

    if(network === 'bsc_testnet') {
        // set matic_mumbai
        await bridge.setBridgeAddressOnChain("BSC", bsc_test)
        console.log(`self bridge address set`)
        if(matic_test !== '') {
            await bridge.setBridgeAddressOnChain("POLYGON", matic_test)
            console.log(`cross chain bridge set`)
            done()
            return
        }
        console.log(`matic_test not deployed`)
    }
    
    if(network === 'matic_mumbai') {
        await bridge.setBridgeAddressOnChain("POLYGON", matic_test)
        console.log(`self bridge address set`)
        if(bsc_test !== '') {
            await bridge.setBridgeAddressOnChain("BSC", bsc_test)
            console.log(`cross chain bridge set`)
            done()
            return
        }
        console.log(`bsc_testnet not deployed`)        
    }

    if(network === 'bsc_mainnet') {
        await bridge.setBridgeAddressOnChain("BSC", bsc_main)
        console.log(`self bridge address set`)
        if(matic_main !== '') {
            await bridge.setBridgeAddressOnChain("POLYGON", matic_main)
            console.log(`cross chain bridge set`)
            done()
            return
        }
        console.log(`matic_main not deployed`)
    }
    if(network === 'matic_mainnet') {
        await bridge.setBridgeAddressOnChain("POLYGON", matic_main)
        console.log(`self bridge address set`)
        if(bsc_main !== '') {
            await bridge.setBridgeAddressOnChain("BSC", bsc_main)
            console.log(`cross chain bridge set`)
            done()
            return
        }
        console.log(`bsc_mainnet not deployed`)
    }

    done()
}

// DONT FORGET TO SET THE SELF BRIDGE ADDRESS FOR BURNING AND MINTING ON SAME BRIDGE