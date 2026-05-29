async function fetchData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error("Failed to fetch data");
        const data = await response.json();
        renderData(data);
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

function renderData(data) {
    // Top-level stats
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    document.getElementById('totalRaised').innerText = formatter.format(data.totalRaisedUSD);
    document.getElementById('goal').innerText = formatter.format(data.goalUSD);

    if (data.lastUpdated) {
        document.getElementById('lastUpdated').innerText = "Last Auto-Update: " + new Date(data.lastUpdated).toLocaleString();
    }

    // Progress Bar
    const percentage = (data.totalRaisedUSD / data.goalUSD) * 100;
    // ensure even empty progress shows a slight sliver if 0, or just keep 0
    let displayPercent = percentage.toFixed(8); 
    document.getElementById('progressBar').style.width = Math.min(percentage, 100) + '%';
    document.getElementById('progressPercentage').innerText = displayPercent + '%';

    // Update Balances Summary
    document.getElementById('total-usdc').innerText = (data.balances.USDC_ETH.amount + data.balances.USDC_ARB.amount + data.balances.USDC_BASE.amount + data.balances.USDC_BSC.amount + data.balances.USDC_POLYGON.amount + data.balances.USDC_SOL.amount).toFixed(2);
    document.getElementById('total-usdt').innerText = (data.balances.USDT_ETH.amount + data.balances.USDT_ARB.amount + data.balances.USDT_BSC.amount + data.balances.USDT_POLYGON.amount + data.balances.USDT_TRX.amount + data.balances.USDT_SOL.amount).toFixed(2);
    document.getElementById('total-btc').innerText = data.balances.BTC.amount.toFixed(4);
    document.getElementById('total-eth').innerText = data.balances.ETH.amount.toFixed(4);
    document.getElementById('total-bnb').innerText = data.balances.BNB.amount.toFixed(4);
    document.getElementById('total-sol').innerText = data.balances.SOL.amount.toFixed(2);
    document.getElementById('total-trx').innerText = data.balances.TRX.amount.toFixed(2);
    document.getElementById('total-matic').innerText = data.balances.MATIC.amount.toFixed(2);
    document.getElementById('total-doge').innerText = data.balances.DOGE.amount.toFixed(2);

    globalData = data;
    // Initial coin selection
    selectCoin('USDC');
}

let globalData = null;
let currentCoin = null;
let currentNetwork = null;
let qrInstance = null;

const coinNetworks = {
    'USDC': [
        { id: 'ETH', name: 'Ethereum (ERC-20)' },
        { id: 'ARB', name: 'Arbitrum One' },
        { id: 'BASE', name: 'Base' },
        { id: 'BSC', name: 'BNB Smart Chain (BEP-20)' },
        { id: 'POLYGON', name: 'Polygon (ERC-20)' },
        { id: 'SOL', name: 'Solana (SPL)' }
    ],
    'USDT': [
        { id: 'ETH', name: 'Ethereum (ERC-20)' },
        { id: 'ARB', name: 'Arbitrum One' },
        { id: 'BSC', name: 'BNB Smart Chain (BEP-20)' },
        { id: 'POLYGON', name: 'Polygon (ERC-20)' },
        { id: 'TRX', name: 'Tron (TRC-20)' },
        { id: 'SOL', name: 'Solana (SPL)' }
    ],
    'BTC': [
        { id: 'BTC', name: 'Bitcoin Network' }
    ],
    'ETH': [
        { id: 'ETH', name: 'Ethereum Mainnet' },
        { id: 'ARB', name: 'Arbitrum One' },
        { id: 'BASE', name: 'Base' }
    ],
    'BNB': [
        { id: 'BSC', name: 'BNB Smart Chain (BEP-20)' }
    ],
    'SOL': [
        { id: 'SOL', name: 'Solana (SPL)' }
    ],
    'TRX': [
        { id: 'TRX', name: 'Tron (TRC-20)' }
    ],
    'MATIC': [
        { id: 'POLYGON', name: 'Polygon Network' }
    ],
    'DOGE': [
        { id: 'DOGE', name: 'Dogecoin Network' }
    ]
};

function selectCoin(coin) {
    currentCoin = coin;
    
    // UI update for coins
    document.querySelectorAll('.coin-btn').forEach(btn => {
        if(btn.innerText === coin) {
            btn.classList.add('border-indigo-600', 'text-indigo-600', 'bg-indigo-50');
            btn.classList.remove('text-gray-600');
        } else {
            btn.classList.remove('border-indigo-600', 'text-indigo-600', 'bg-indigo-50');
            btn.classList.add('text-gray-600');
        }
    });

    const networks = coinNetworks[coin];
    const netTabs = document.getElementById('network-tabs');
    netTabs.innerHTML = '';
    
    networks.forEach(net => {
        const btn = document.createElement('button');
        btn.className = 'net-btn px-4 py-2 rounded-lg border bg-white font-semibold text-gray-600 hover:border-indigo-500 hover:text-indigo-600 transition';
        btn.innerText = net.name;
        btn.onclick = () => selectNetwork(net.id, btn);
        netTabs.appendChild(btn);
    });

    document.getElementById('network-section').classList.remove('hidden');
    document.getElementById('address-section').classList.add('hidden');
    
    // Auto click the first network option
    if (networks.length > 0) {
        selectNetwork(networks[0].id, netTabs.firstChild);
    }
}

function selectNetwork(netId, btnElement) {
    currentNetwork = netId;

    document.querySelectorAll('.net-btn').forEach(btn => {
        btn.classList.remove('border-indigo-600', 'text-indigo-600', 'bg-indigo-50');
        btn.classList.add('text-gray-600');
    });
    btnElement.classList.add('border-indigo-600', 'text-indigo-600', 'bg-indigo-50');
    btnElement.classList.remove('text-gray-600');

    if (!globalData) return;
    
    const address = globalData.addresses[netId];
    document.getElementById('display-address').innerText = address;
    // Update warning dynamically
    updateWarningText();

    const qrContainer = document.getElementById('qr-code');
    qrContainer.innerHTML = '';
    if (qrInstance) qrInstance.clear();
    qrInstance = new QRCode(qrContainer, { text: address, width: 176, height: 176 });

    document.getElementById('address-section').classList.remove('hidden');
    document.getElementById('address-section').classList.add('flex');
}

function copyDepositAddress() {
    const text = document.getElementById('display-address').innerText;
    navigator.clipboard.writeText(text).then(() => {
        const msg = (typeof window.translations !== 'undefined') ? window.translations[window.currentLang].copied : "Address Copied!"; alert(msg);
    }).catch(console.error);
}

// Init
window.onload = fetchData;

function updateWarningText() {
    if(!currentCoin || !currentNetwork) return;
    
    // Attempt to get the latest network name from UI
    let netName = "this network";
    document.querySelectorAll('.net-btn').forEach(btn => {
        if(btn.classList.contains('border-indigo-600')) {
             netName = btn.innerText;
        }
    });

    const warnEl = document.getElementById('warn-text');
    if(warnEl && typeof window.translations !== 'undefined') {
        const t = window.translations[window.currentLang];
        warnEl.innerHTML = t.warnPrefix + ' <span class="uppercase font-bold">' + currentCoin + '</span> ' + t.warnMiddle + ' <span class="uppercase font-bold">' + netName + '</span> ' + t.warnSuffix;
    }
}
