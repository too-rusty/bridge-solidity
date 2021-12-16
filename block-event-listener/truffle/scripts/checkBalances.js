
const Token = artifacts.require("Token")
const jsonPath = `${__dirname}/../common.json`
module.exports = async done => {
    
    const dashdashNetwork = process.argv[process.argv.length - 2]
    if (dashdashNetwork !== '--network') {
        console.log(`--network NETWORK_NAME should be the last set of arguments`)
        return
    }
    const network = process.argv[process.argv.length - 1] // should end with --network something
    let common = require(jsonPath)

    try {
        const [admin] = await web3.eth.getAccounts()
        const token = await Token.at(common[network]['token'])
        const adminBalance = await token.balanceOf(admin)
        console.log(`NETWORK - ${network} , BALANCE - ${adminBalance}\n`)
    } catch (e) {
        console.log(`EXCEPTION: ${e}`)
    }

    done()
}