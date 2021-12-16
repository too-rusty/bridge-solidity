// const A = artifacts.require("A");

// module.exports = async (deployer, network, accounts) => {
//   await deployer.deploy(A);
//   const a = await A.deployed()
//   console.log(`deployed a at address : ${a.address}\n`)
// };

require('dotenv').config()
const Token = artifacts.require("Token");
// const Bridge = artifacts.require("BridgeV1");
// const LIMIT = web3.utils.toWei("10","ether")
// const FEE_MATIC = web3.utils.toWei("0.1","ether")
// const FEE_BNB = web3.utils.toWei("0.05","ether")
// const BSC_TOKEN_ADDRESS = "0xD663f7eEa56BC4e528C74B5F77F6D059629a0cbd"
// const POLYGON_TOKEN_ADDRESS = "0x6dd04Cf9D7221fEdd6a8008d1577F3aBBb011E1C"


const jsonPath = `${__dirname}/../common.json`
// deploy coins and set them up
module.exports = async(deployer, network, accounts) => {

  let common = require(jsonPath)
  const fs = require("fs")
  let token

  if (network === 'matic_mumbai') {
    if (!common[network]["token"]) {
      try {
          await deployer.deploy(Token);
          token = await Token.deployed();
          console.log(`--- DEPLOYED Token at address: ${token.address}`)
      } catch (e) {
          console.log(`exception thrown: ${e}`)
      }
    } else {
      token = await Token.at(common[network]['token'])
      console.log(`Token already deployed at address: ${common[network]['token']}`)
    }
  }

  if (network === 'bsc_testnet') {
    if (!common[network]["token"]) {
      try {
          await deployer.deploy(Token);
          token = await Token.deployed();
          console.log(`--- DEPLOYED Token at address: ${token.address}`)
      } catch (e) {
          console.log(`exception thrown: ${e}`)
      }
    } else {
      token = await Token.at(common[network]['token'])
      console.log(`Token already deployed at address: ${common[network]['token']}`)
    }
  }

  if (network === 'matic_mainnet') {
  }
  if (network === 'bsc_mainnet') {
  }
  common[network]["token"] = token.address
  console.log(`writing Token to file!!!`)
  fs.writeFileSync(jsonPath, JSON.stringify(common))
  console.log(`done writing!!!`)

}

/*

1. deploy token on the first network ( polygon ) -- only for testnet
2. deploy token on the second network -- only for testnet
3. deploy bridge on the first network and set all the params, allow in token contract to have the bridge mint them ( need to have that functionality )
4. deploy bridge on the second network and set all the params, allow in token contract to have the bridge mint them
5. build a backend to listen to the transactions and burn and mint the tokens


FLOW

user -> bridge ( burns the token ) | all fee transfered to the API -> API calls bridge -> bridge mint tokens on other side

so user should approve the bridge contract to burn the tokens
bridge contract transfers all the fee to the API
API calls the mint function on the bridge again paying the fee it has collectes
bridge mints the token again

*/