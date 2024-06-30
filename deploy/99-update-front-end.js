const { ethers, network, deployments } = require("hardhat")
const fs = require("fs")

const FRONT_END_ADDRESS_FILE = "../nextjs-smartcontract-lottery-fcc/src/constants/contractAddresses.json"

const FRONT_END_ABI_FILE = "../nextjs-smartcontract-lottery-fcc/src/constants/abi.json"

module.exports = async function () {
    if (process.env.UPDATE_FRONT_END === "true") {
        console.log("Updating front end...")
        await updateContractAddresses()
        await updateAbi()
    }
}

async function updateAbi() { 
    const raffle = await ethers.getContractAt(
        "Raffle",
        (
            await deployments.get("Raffle")
        ).address
    )
    
    fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.formatJson())

}

async function updateContractAddresses() {
    const raffle = await ethers.getContractAt(
        "Raffle",
        (
            await deployments.get("Raffle")
        ).address
    )
    // const raffle = await ethers.getContract("Raffle")
    const chainId = network.config.chainId.toString()
    const currentAddress = JSON.parse(fs.readFileSync(FRONT_END_ADDRESS_FILE), "utf8")
    if (chainId in currentAddress) {
        if (!currentAddress[chainId].includes(raffle.target)) {
            currentAddress[chainId].push(raffle.target)
        }
    } {
        currentAddress[chainId] = [raffle.target]
    }

    fs.writeFileSync(FRONT_END_ADDRESS_FILE, JSON.stringify(currentAddress))
}

module.exports.tags = ["frontend"]
