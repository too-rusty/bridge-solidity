const A = artifacts.require("A")

module.exports = async done => {
    const a = await A.at("0xa4A40F32d41De2c8D60ca807BfB8E86e69131DC3")
    for(let i = 0; i < 10; i++) {
        console.log(`triggering with value ${i+1} ${"helloworld"}`)
        await a.something(i+1,"helloworld")
    }
    done()
}