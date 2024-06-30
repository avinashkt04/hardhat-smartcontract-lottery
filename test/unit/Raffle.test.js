const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const {
    developmentChains,
    networkConfig,
} = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
          let raffle,
              vrfCoordinatorV2_5Mock,
              raffleEntranceFee,
              deployer,
              interval
          const chainId = network.config.chainId

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              raffle = await ethers.getContractAt(
                  "Raffle",
                  (
                      await deployments.get("Raffle")
                  ).address
              )
              vrfCoordinatorV2_5Mock = await ethers.getContractAt(
                  "VRFCoordinatorV2_5Mock",
                  (
                      await deployments.get("VRFCoordinatorV2_5Mock")
                  ).address
              )
              raffleEntranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })

          describe("constructor", function () {
              it("initializes the raffle correctly", async function () {
                  // Ideally we make our tests have just 1 assert per "it"
                  const raffleState = await raffle.getRaffleState()
                  assert.equal(raffleState.toString(), "0")
                  assert.equal(
                      interval.toString(),
                      networkConfig[chainId]["interval"]
                  )
              })
          })

          describe("enterRaffle", function () {
              it("revert when you don't pay enough", async function () {
                  await expect(
                      raffle.enterRaffle()
                  ).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__NotEnoughETHEntered"
                  )
              })
              it("records players when they enter", async function () {
                console.log()
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  const playerFromContract = await raffle.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })
              it("emit  events on enter", async function () {
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee })
                  ).to.emit(raffle, "RaffleEnter")
              })
              it("doesn't allow entrance when raffle is calculating", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep("0x")
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee })
                  ).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen")
              })
          })

          describe("checkUpkeep", function () {
              it("returns false if people haven't sent any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  // const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(
                  //     new Uint8Array(),
                  //   );
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(
                      "0x"
                  )
                  console.log(`UpkeepNeeded in test: ${upkeepNeeded}`)
                  assert(!upkeepNeeded)
              })
              it("returns false if raffle isn't open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep("0x")
                  const raffleState = await raffle.getRaffleState()
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(
                      "0x"
                  )
                  assert.equal(raffleState.toString(), "1")
                  assert.equal(upkeepNeeded, false)
              })
              it("returns false if enough time hasn't passed", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) - 5,
                  ])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(
                      "0x"
                  )
                  assert(!upkeepNeeded)
              })
              it("returns true if enough time has passed, has players, eth and is open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(
                      "0x"
                  )
                  assert(upkeepNeeded)
              })
          })

          describe("performUpkeep", function () {
              it("can only run if checkupkeep is true", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  const tx = await raffle.performUpkeep("0x")
                  assert(tx)
              })
              it("reverts when checkupkeep is false", async function () {
                  await expect(
                      raffle.performUpkeep("0x")
                  ).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__UpkeepNotNeeded"
                  )
              })
              it("update the raffle state, emits and event, and calls the vrf coordinator", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  const txResponse = await raffle.performUpkeep("0x")
                  const txReceipt = await txResponse.wait(1)
                  const requestId = txReceipt.logs[1].args.requestId
                  const raffleState = await raffle.getRaffleState()
                  assert(Number(requestId) > 0)
                  assert(Number(raffleState) == "1")
              })
          })

          describe("fulfillRandomWords", function () {
              beforeEach(async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
              })
              it("can only be called after performUpkeep", async function () {
                  await expect(
                      vrfCoordinatorV2_5Mock.fulfillRandomWords(0, raffle.target) // reverts if not fulfilled
                  ).to.be.revertedWith
                  await expect(
                      vrfCoordinatorV2_5Mock.fulfillRandomWords(1, raffle.target) // reverts if not fulfilled
                  ).to.be.revertedWith
              })
              // This test is too big...
              // This test simulates users entering the raffle and wraps the entire functionality of the raffle
              // inside a promise that will resolve if everything is successful.
              // An event listener for the WinnerPicked is set up
              // Mocks of chainlink keepers and vrf coordinator are used to kickoff this winnerPicked event
              // All the assertions are done once the WinnerPicked event is fired
              it("picks a winner, resets, and sends money", async () => {
                  const additionalEntrances = 3 // to test
                  const accounts = await ethers.getSigners()
                  const startingAccountIndex = 2
                  let startingBalance
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrances;
                      i++
                  ) {
                      accountConnectedRaffle = raffle.connect(accounts[i]) // Returns a new instance of the Raffle contract connected to player
                      await accountConnectedRaffle.enterRaffle({
                          value: raffleEntranceFee,
                      })
                  }
                  const startingTimeStamp = await raffle.getLatestTimeStamp() // stores starting timestamp (before we fire our event)

                  // This will be more important for our staging tests...
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          // event listener for WinnerPicked
                          console.log("WinnerPicked event fired!")
                          // assert throws an error if it fails, so we need to wrap
                          // it in a try/catch so that the promise returns event
                          // if it fails.
                        //   try {
                              // Now lets get the ending values...
                              const recentWinner =
                                  await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerEndingBalance =
                                  await ethers.provider.getBalance(accounts[2])
                              const endingTimeStamp =
                                  await raffle.getLatestTimeStamp()
                              const numPlayers =
                                  await raffle.getNumberOfPlayers()
                              await expect(raffle.getPlayer(0)).to.be.revertedWith
                              // Comparisons to check if our ending values are correct:
                              //   assert.equal(
                              //       recentWinner.toString(),
                              //       accounts[2].address
                              //   )
                              assert.equal(numPlayers, 0)
                              assert.equal(raffleState, 0)
                              const startingBalanceBigInt =
                                  BigInt(startingBalance)
                              const raffleEntranceFeeBigInt =
                                  BigInt(raffleEntranceFee)
                              const additionalEntrancesBigInt =
                                  BigInt(additionalEntrances)

                              // Perform arithmetic operations using BigInt
                              const expectedBalance =
                                  startingBalanceBigInt +
                                  raffleEntranceFeeBigInt *
                                      additionalEntrancesBigInt +
                                  raffleEntranceFeeBigInt

                              // Convert expectedBalance to string for comparison
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  expectedBalance.toString()
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve() // if try passes, resolves the promise
                        //   } catch (e) {
                        //       reject(e) // if try fails, rejects the promise
                        //   }
                      })

                      // kicking off the event by mocking the chainlink keepers and vrf coordinator
                      try {
                          const tx = await raffle.performUpkeep("0x")
                          const txReceipt = await tx.wait(1)
                          startingBalance = await ethers.provider.getBalance(
                              accounts[2]
                          )
                        //   await expect(vrfCoordinatorV2_5Mock.fulfillRandomWords()).to.be.revertedWith
                          await vrfCoordinatorV2_5Mock.fulfillRandomWords(
                              txReceipt.logs[1].args.requestId,
                              raffle.target
                          )
                      } catch (e) {
                          reject(e)
                      }
                  })
              })
          })
      })
