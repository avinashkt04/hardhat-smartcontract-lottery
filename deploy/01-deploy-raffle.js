const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("2")

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2_5Address, subscriptionId

    if (developmentChains.includes(network.name)) {
        const contractAddress = (await deployments.get("VRFCoordinatorV2_5Mock"))
            .address
        const vrfCoordinatorV2_5Mock = await ethers.getContractAt(
            "VRFCoordinatorV2_5Mock",
            contractAddress
        )
        vrfCoordinatorV2_5Address = vrfCoordinatorV2_5Mock.target
        const transactionResponse =
            await vrfCoordinatorV2_5Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        subscriptionId = transactionReceipt.logs[0].args.subId
        // Fund the subscription
        // Usually, you'd need the link token on a real network
        await vrfCoordinatorV2_5Mock.fundSubscription(
            subscriptionId,
            VRF_SUB_FUND_AMOUNT
            )
    } else {
        vrfCoordinatorV2_5Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]
    const args = [
        vrfCoordinatorV2_5Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ]
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmation: network.config.blockConfirmations || 1,
    })

    // Ensure the raffle contract is a valid consumer of the VRFCoordinatorV2Mock contract
    if(developmentChains.includes(network.name)){
        const contractAddress = (await deployments.get("VRFCoordinatorV2_5Mock"))
            .address
        const vrfCoordinatorV2_5Mock = await ethers.getContractAt(
            "VRFCoordinatorV2_5Mock",
            contractAddress
        )
        await vrfCoordinatorV2_5Mock.addConsumer(subscriptionId, raffle.address)
        console.log('Consumer is added')
    }

    if (
        !developmentChains.includes(network.name) &&
        process.env.ETHERSCAN_API_KEY
    ) {
        log("Verifying...")
        await verify(raffle.address, args)
    }
    log("---------------------------------")
}

module.exports.tags = ["all", "raffle"]
