import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data.json');

// RPC helper to get native base coin balance (ETH, BNB)
async function fetchEvmBalance(rpc, address) {
  if (!address || address.startsWith('0x00000')) return 0;
  try {
    const res = await fetch(rpc, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest']}) });
    const data = await res.json();
    return parseInt(data.result || '0', 16) / 1e18;
  } catch (e) {
    console.error(`EVM balance error for ${rpc}`, e.message);
    return 0;
  }
}

// RPC helper to get ERC-20 token balances using 'eth_call'
async function fetchEvmTokenBalance(rpc, contract, address, decimals) {
  if (!address || address.startsWith('0x00000')) return 0;
  try {
    const dataParam = '0x70a08231' + address.toLowerCase().replace('0x', '').padStart(64, '0');
    const res = await fetch(rpc, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{to: contract, data: dataParam}, 'latest']}) });
    const data = await res.json();
    return parseInt(data.result || '0', 16) / (10 ** decimals);
  } catch (e) {
    console.error(`EVM token error for ${rpc}`, e.message);
    return 0;
  }
}

async function main() {
  try {
    const rawData = await fs.readFile(DATA_FILE, 'utf-8');
    const data = JSON.parse(rawData);
    const { addresses } = data;

    // 1. Fetch prices from CoinGecko
    console.log("Fetching prices from CoinGecko...");
    const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,tron&vs_currencies=usd');
    const prices = (await cgRes.json()) || {};
    const btcPrice = prices.bitcoin?.usd || 0;
    const ethPrice = prices.ethereum?.usd || 0;
    const solPrice = prices.solana?.usd || 0;
    const bnbPrice = prices.binancecoin?.usd || 0;
    const trxPrice = prices.tron?.usd || 0;

    // 2. Fetch BTC Balance
    console.log("Fetching BTC balance...");
    if(addresses.BTC && !addresses.BTC.includes("your") && addresses.BTC !== "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh") {
      const btcRes = await fetch(`https://mempool.space/api/address/${addresses.BTC}`);
      if (btcRes.ok) {
        const btcData = await btcRes.json();
        const btcCount = (btcData.chain_stats.funded_txo_sum - btcData.chain_stats.spent_txo_sum) / 1e8;
        data.balances.BTC.amount = btcCount;
        data.balances.BTC.valueUSD = btcCount * btcPrice;
      }
    }

    // 3. Setup EVM RPC Nodes
    const evmNodes = {
      ETH: { rpc: 'https://cloudflare-eth.com' },
      ARB: { rpc: 'https://arb1.arbitrum.io/rpc' },
      BASE: { rpc: 'https://mainnet.base.org' },
      BSC: { rpc: 'https://bsc-dataseed.binance.org' }
    };

    console.log("Fetching EVM Balances...");
    
    // Native Tokens
    data.balances.ETH.amount = await fetchEvmBalance(evmNodes.ETH.rpc, addresses.ETH);
    data.balances.ETH.valueUSD = data.balances.ETH.amount * ethPrice;
    
    data.balances.BNB.amount = await fetchEvmBalance(evmNodes.BSC.rpc, addresses.BSC);
    data.balances.BNB.valueUSD = data.balances.BNB.amount * bnbPrice;

    // Stablecoins
    data.balances.USDC_ETH.amount = await fetchEvmTokenBalance(evmNodes.ETH.rpc, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', addresses.ETH, 6);
    data.balances.USDT_ETH.amount = await fetchEvmTokenBalance(evmNodes.ETH.rpc, '0xdAC17F958D2ee523a2206206994597C13D831ec7', addresses.ETH, 6);

    data.balances.USDC_ARB.amount = await fetchEvmTokenBalance(evmNodes.ARB.rpc, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', addresses.ARB, 6);
    data.balances.USDT_ARB.amount = await fetchEvmTokenBalance(evmNodes.ARB.rpc, '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', addresses.ARB, 6);

    data.balances.USDC_BASE.amount = await fetchEvmTokenBalance(evmNodes.BASE.rpc, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', addresses.BASE, 6);
    
    // BSC Stablecoins use 18 decimals
    data.balances.USDC_BSC.amount = await fetchEvmTokenBalance(evmNodes.BSC.rpc, '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', addresses.BSC, 18);
    data.balances.USDT_BSC.amount = await fetchEvmTokenBalance(evmNodes.BSC.rpc, '0x55d398326f99059fF775485246999027B3197955', addresses.BSC, 18);

    // Map stablecoin values 1:1
    ['USDC_ETH', 'USDT_ETH', 'USDC_ARB', 'USDT_ARB', 'USDC_BASE', 'USDC_BSC', 'USDT_BSC'].forEach(key => {
        if (data.balances[key]) data.balances[key].valueUSD = data.balances[key].amount;
    });

    // 4. Fetch TRON
    console.log("Fetching TRON & TRC-20...");
    if (addresses.TRX && addresses.TRX.startsWith("T") && addresses.TRX !== "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb") {
       const trxRes = await fetch(`https://api.trongrid.io/v1/accounts/${addresses.TRX}`);
       if (trxRes.ok) {
         const trxData = await trxRes.json();
         if (trxData.data && trxData.data.length > 0) {
             const account = trxData.data[0];
             const trxCount = (account.balance || 0) / 1e6;
             data.balances.TRX.amount = trxCount;
             data.balances.TRX.valueUSD = trxCount * trxPrice;
             
             let usdtAmount = 0;
             if (account.trc20) {
                 const usdtToken = account.trc20.find(t => Object.keys(t)[0] === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
                 if (usdtToken) usdtAmount = parseInt(usdtToken['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t']) / 1e6;
             }
             data.balances.USDT_TRX.amount = usdtAmount;
             data.balances.USDT_TRX.valueUSD = usdtAmount;
         }
       }
    }

    // 5. Fetch SOL & SPL
    console.log("Fetching SOL & SPL...");
    if (addresses.SOL && addresses.SOL.length > 20 && addresses.SOL !== "11111111111111111111111111111111") {
        const solRpc = 'https://api.mainnet-beta.solana.com';
        const rpcReq = (method, params) => fetch(solRpc, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params }) }).then(r => r.json()).catch(() => ({}));

        const solData = await rpcReq("getBalance", [addresses.SOL]);
        if (solData && solData.result) {
            const solCount = (solData.result?.value || 0) / 1e9;
            data.balances.SOL.amount = solCount;
            data.balances.SOL.valueUSD = solCount * solPrice;
        }

        const usdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
        const usdcData = await rpcReq("getTokenAccountsByOwner", [addresses.SOL, { mint: usdcMint }, { encoding: "jsonParsed" }]);
        if (usdcData?.result?.value) {
            data.balances.USDC_SOL.amount = usdcData.result.value.reduce((acc, token) => acc + (token.account.data.parsed.info.tokenAmount.uiAmount || 0), 0);
            data.balances.USDC_SOL.valueUSD = data.balances.USDC_SOL.amount;
        }

        const usdtMint = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
        const usdtData = await rpcReq("getTokenAccountsByOwner", [addresses.SOL, { mint: usdtMint }, { encoding: "jsonParsed" }]);
        if (usdtData?.result?.value) {
            data.balances.USDT_SOL.amount = usdtData.result.value.reduce((acc, token) => acc + (token.account.data.parsed.info.tokenAmount.uiAmount || 0), 0);
            data.balances.USDT_SOL.valueUSD = data.balances.USDT_SOL.amount;
        }
    }

    // 6. Sum everything up
    console.log("Calculating totals...");
    let totalRaised = 0;
    for (const key of Object.keys(data.balances)) {
        totalRaised += (data.balances[key].valueUSD || 0);
    }
    
    data.totalRaisedUSD = totalRaised;
    data.lastUpdated = new Date().toISOString();

    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    console.log("Balances updated successfully! Total Raised: $" + totalRaised.toFixed(2));
  } catch (error) {
    console.error("Error updating balances:", error);
    process.exit(1);
  }
}

main();