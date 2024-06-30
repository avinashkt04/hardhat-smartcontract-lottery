const { network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

const BASE_FEE = ethers.parseEther("0.015") // 0.25 is the premium. It costs 0.25 LINK per request
const GAS_PRICE_LINK = 1e5// calculated value based on the gas price of the chain.
const WEI_PER_UNIT_LINK = 9000000000000000

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const args = [BASE_FEE, GAS_PRICE_LINK, WEI_PER_UNIT_LINK]

    if (developmentChains.includes(network.name)) {
        log("Local network detected! Deploying mocks...")
        // deploy a mock vrfcoordinator...
        await deploy("VRFCoordinatorV2_5Mock", {
            from: deployer,
            log: true,
            args: args,
            gasLimit: 6000000
        })
        log("Mocks Deployed!")
        log("---------------------------------")
    }
}

module.exports.tags = ["all", "mocks"]
