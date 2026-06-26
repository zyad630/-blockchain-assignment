const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const Token = await hre.ethers.getContractFactory('WorkloProjectToken');
  const token = await Token.deploy(deployer.address);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log('WorkloProjectToken deployed to:', address);

  const outputPath = path.join(__dirname, '..', 'contract-deployment.json');
  fs.writeFileSync(outputPath, JSON.stringify({ contractAddress: address, network: 'localhost' }, null, 2));

  console.log('\nAdd to .env.local:');
  console.log(`WPT_CONTRACT_ADDRESS=${address}`);
  console.log(`WPT_OWNER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`);
  console.log(`HARDHAT_RPC_URL=http://127.0.0.1:8545`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

