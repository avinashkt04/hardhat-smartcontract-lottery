const { ethers, deployments } = require("hardhat")

async function enterRaffle() {
    const raffle = await ethers.getContractAt("Raffle", (await deployments.get("Raffle")).address)
    const entranceFee = await raffle.getEntranceFee()
    await raffle.enterRaffle({ value: entranceFee })
    console.log("Entered!")
}

enterRaffle()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })