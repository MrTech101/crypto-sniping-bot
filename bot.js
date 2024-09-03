import 'dotenv/config';
import { WebSocketProvider, JsonRpcProvider, Contract, Wallet, parseEther } from 'ethers';
import fs from 'fs';
import { parse } from 'path';

// Read and parse JSON file
const blockchain = JSON.parse(fs.readFileSync(new URL('./blockchain.json', import.meta.url), 'utf8'));
const provider = process.env.LOCAL_RPC_URL_WS ? new WebSocketProvider(process.env.LOCAL_RPC_URL_WS) : new JsonRpcProvider(process.env.LOCAL_RPC_URL_HTTP);
const wallet = Wallet.fromPhrase(process.env.MNEMONIC, provider);
const factory = new Contract(blockchain.factoryAddress, blockchain.factoryAbi, provider);
const router = new Contract(blockchain.routerAddress, blockchain.routerAbi, wallet);

const SNIPE_LIST_FILE = "snipelist.csv";
const TOKEN_LIST_FILE = "tokenbuylist.csv";

const init = () => {
    try {
        // Setup an event listener for new liquidity pools
        factory.on("PairCreated", (token0, token1, pairAddress) => {
            console.log(`
                    New Pair Detected
                    ===================
                    pairAddress: ${pairAddress}
                    token0: ${token0}
                    token1: ${token1}
            `);

        //save this info in a file
        if(token0 !== blockchain.WETHAddress && token1 !== blockchain.WETHAddress)return;
        const t0 = token0 === blockchain.WETHAddress ? token0 : token1;
        const t1 = token0 === blockchain.WETHAddress ? token1 : token0; 
        fs.appendFileSync(SNIPE_LIST_FILE, `${pairAddress},${t0},${t1}\n`);

        });
    } catch (error) {
        console.error("Error setting up event listener:", error);
    }
}

const snipe = async()=>{
    // this is going to do the sniping for us.
    console.log("snipe loop");
    let snipeList = fs.readFileSync(SNIPE_LIST_FILE);
    snipeList = snipeList.toString()
    .split("\n")
    .filter(snipe => snipe !== "");
    if(snipeList.length === 0) return;
    for(const snipe of snipeList){
        const [pairAddress,wethAddress , tokenAddress] = snipe.split(",");
        console.log(`Trying to snipe ${tokenAddress} on ${pairAddress}`);

        const pair = new Contract(
            pairAddress,
            blockchain.pairAbi,
            wallet
        );

        const totalSupply = await pair.totalSupply(); //checking for Liqudity for the new token pair
        if(totalSupply === 0n){
            console.log("pool is empty snipe cancelled");
            continue;
        }

        const tokenIn = wethAddress;
        const tokenOut = tokenAddress;

        const amountIn = parseEther("0.1");
        const amounts = await router.getAmountsOut(amountIn, [tokenIn , tokenOut]);
        // Defining price tolerance 
        const amountOutMin = amounts[1] * 5n / 100n;
        console.log(`
            Buying new token
            =================
            tokenIn : ${amountIn.toString()} ${tokenIn} (WETH)
            tokenOut : ${amountOutMin.toString()} ${tokenOut}
        `);

        const tx = await router.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            [tokenIn, tokenOut],
            blockchain.receipient,
            Date.now() + 1000 * 60 * 10 //10 minutes from now
        );

        const receipt = await tx.wait();
        console.log(`Transaction receipt :${receipt}`);
        if(receipt.status === "1"){
            //adding the token to the token bought list.
            fs.appendFileSync(TOKEN_LIST_FILE, `${receipt.blockNumber}, ${wethAddress}, ${tokenAddress}, ${amountOutMin / amountIn}\n`);
            //removing it from the sniping list  
        }
    }
}

const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));

const main = async () => {
    console.log("Trading Bot Starting ...");
    init();
    while (true) {
        console.log('Heartbeat');
        await snipe();
        await timeout(3000); // Time in milliseconds
    }
}

main().catch(console.error);
