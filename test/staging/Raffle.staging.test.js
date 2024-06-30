const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const {
    developmentChains,
    networkConfig,
} = require("../../helper-hardhat-config")
const { expect, assert } = require("chai")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
          let raffle, raffleEntranceFee, deployer

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              raffle = await ethers.getContractAt(
                  "Raffle",
                  (
                      await deployments.get("Raffle")
                  ).address
              )
              raffleEntranceFee = await raffle.getEntranceFee()
          })

          describe("fulfillRandomWords", function () {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
                  // enter the raffle
                  const startingTimeStamp = await raffle.getLatestTimeStamp()
                  const accounts = await ethers.getSigners()

                  // setup listener before we enter the raffle
                  // Just in case the blockchain moves REALLY fast
                  await new Promise(async (resolve, reject) => {
                        // setTimeout(resolve, 5000)
                      raffle.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!")
                          try {
                              const recentWinner =
                                  await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerEndingBalance =
                                  await ethers.provider.getBalance(accounts[0])
                              const endingTimeStamp =
                                  await raffle.getLatestTImeStamp()

                              await expect(raffle.getPlayer(0)).to.be.reverted
                              assert.equal(
                                  recentWinner.toString(),
                                  accounts[0].address
                              )
                              assert.equal(raffleState, 0)
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  (
                                      winnerStartingBalance + raffleEntranceFee
                                  ).toString()
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve()
                          } catch (error) {
                              reject(error)
                          }
                      })
                      //   try {
                      // Then entering the raffle
                      console.log("Entering Raffle...")
                      const tx = await raffle.enterRaffle({
                          value: raffleEntranceFee,
                      })
                    //   await expect(tx).to.be(raffle, "RaffleEnter")
                      await tx.wait(1)
                      console.log("Ok, time to wait...")
                      const winnerStartingBalance = await ethers.provider.getBalance(accounts[0])
                          
                      console.log(winnerStartingBalance)
                      const {upkeepNeeded} = await raffle.checkUpkeep("0x")
                      console.log(upkeepNeeded)
                      try {
                          const trx = await raffle.performUpkeep("0x")
                          console.log(trx)
                        
                      } catch (error) {
                        console.log(error)
                      }
                      //   } catch (error) {
                      //       reject(error)
                      //   }

                      // and this code won't complete until our listener has finished listening!
                  })
              })
          })
      })
