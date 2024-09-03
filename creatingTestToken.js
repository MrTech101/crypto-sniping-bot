import 'dotenv/config';
import { JsonRpcProvider,ContractFactory, Contract, Wallet, parseEther } from 'ethers';
import fs from 'fs';

// Read and parse JSON file
const blockchain = JSON.parse(fs.readFileSync(new URL('./blockchain.json', import.meta.url), 'utf8'));
const provider = new JsonRpcProvider(process.env.LOCAL_RPC_URL_HTTP);
console.log(process.env.LOCAL_RPC_URL_HTTP);
const wallet = Wallet.fromPhrase(process.env.MNEMONIC, provider);

const erc20Deployer = new ContractFactory(
    blockchain.erc20Abi,
    blockchain.erc20Bytecode,
    wallet
);

const uniswapFactory = new Contract(
    blockchain.factoryAddress, 
    blockchain.factoryAbi, 
    wallet
);

const main = async()=>{
    console.log("Main");
    const token = await erc20Deployer.deploy("test token" , "TST" , parseEther("1000000000"));
    await token.waitForDeployment();
    console.log(`Test token deployed : ${token.target}`);

    const tx = await uniswapFactory.createPair(blockchain.WETHAddress, token.target);
    const receipt = await tx.wait();
    console.log('Test liquidity pool deployed');
};  
main();