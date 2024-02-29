const {
    TIER_PRICE_MAP,
} = require('./constants');

function formatAddress(address) {
    return address.slice(0, 4) + '...' + address.slice(-3);
}

function getLevelFromCommand(match) {
    const s = match[0];
    const level = s.split(' ')[0].split('lv')[1];
    return level;
}

function getTierFromTxValueAndNumKeys(value, numKeys) {
    let price = value / numKeys;
    let prices = [-1.0];
    for (const [_, value] of Object.entries(TIER_PRICE_MAP)) {
        prices.push(value[0]);
    }
    let result = prices.indexOf(parseFloat(price.toFixed(4)));
    return result;
}

function splitArrayWithOffset(arr, size, offset = 0) {
    if (!Array.isArray(arr) || size <= 0 || offset < 0) {
        throw new Error('Invalid arguments: array, size, and offset must be valid.');
    }

    const subarrays = [];
    let startIndex = 0;

    while (startIndex < arr.length) {
        const endIndex = Math.min(startIndex + size - offset, arr.length);
        const subarray = arr.slice(startIndex, endIndex);
        if (subarray.length > 0) {
            subarrays.push(subarray);
        }
        startIndex = endIndex;
    }

    return subarrays;
}

function logGeneral(levelContent, level, refCountMap, txNodesBuyMap, saleMap, tier) {

    let numberKeySold = 0;
    let totalSale = 0.0;
    let refSet = new Set();

    let numNoCodeKeySold = 0;
    let numCode20KeySold = 0;
    let numCode100KeySold = 0;

    const [NO_CODE_PRICE, CODE_20_PRICE, CODE_100_PRICE] = TIER_PRICE_MAP[tier];

    levelContent.forEach((txs, user) => {
        if (txs.length > 0) {
            for (let i = 0; i < txs.length; i++) {
                const [numNodes, txValue, from, txTier] = txNodesBuyMap.get(txs[i]);

                if (txValue == parseFloat((NO_CODE_PRICE * numNodes).toFixed(4))) {
                    numNoCodeKeySold += numNodes;
                    refSet.add(from);
                } else if (txValue == parseFloat((CODE_20_PRICE * numNodes).toFixed(4))) {
                    numCode20KeySold += numNodes;
                    refSet.add(from);
                } else if (txValue == parseFloat((CODE_100_PRICE * numNodes).toFixed(4))) {
                    numCode100KeySold += numNodes;
                    refSet.add(from);
                } else {
                    if (txTier == tier) {
                        console.log(`tx: ${txs[i]}`);
                    }
                }
            }
        }
    });
    let numberRef = refSet.size;
    let s = ``;
    if (numberRef > 0) {
        let nocodeSale = numNoCodeKeySold * NO_CODE_PRICE;
        let code20Sale = numCode20KeySold * CODE_20_PRICE;
        let code100Sale = numCode100KeySold * CODE_100_PRICE;
        totalSale = nocodeSale + code20Sale + code100Sale;
        numberKeySold += numNoCodeKeySold + numCode20KeySold + numCode100KeySold;

        s += `🔗 L${parseInt(level)}: ${refSet.size} ref - ${numberKeySold} keys - Level sale: ${parseFloat(totalSale.toFixed(4))} $ETH\n\n`;
        s += `      0 %     :   ${numNoCodeKeySold} 🔑 (${parseFloat(nocodeSale.toFixed(4))} $ETH) \n`;
        s += `      20 %   :   ${numCode20KeySold} 🗝 (${parseFloat(code20Sale.toFixed(4))} $ETH) \n`;
        s += `      100 % :   ${numCode100KeySold} 🎁 (${parseFloat(code100Sale.toFixed(4))} $ETH)`;
    }
    return [s, numberKeySold, totalSale];
}

/*
levelMap = { 
    '0': {
        '0x4890240240...': [txs],
        '0x3213234242...': [txs],
        ...
    },
    '1': {
        '0x4890240240...': [txs],
        '0x3213234242...': [txs],
        ...
    }
}

refCountMap = {
    '0x4890240240...': 32,
    '0x3213234242...': 10,
    ...
}

txNodesBuyMap = {
    'txHash': [numberNodeSold, ETH pay, msg.sender]
}

saleMapNoCode = {
    '0x4890240240...': 10,
    '0x3213234242...': 10,
    ...
}
*/

module.exports = {
    getLevelFromCommand,
    formatAddress,
    logGeneral,
    getTierFromTxValueAndNumKeys
};