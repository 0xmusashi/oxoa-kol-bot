const fs = require('fs/promises');
const ethers = require("ethers");
const abi = require("./abi.json");
const kolMap = require("./kol.json");
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const {
    formatAddress,
    logGeneral,
    getTierFromNodePrice,
    loadDataFromJsonFile,
    logTier,
} = require('./utils');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

const {
    CONTRACT_ADDRESS,
    RPC,
    TIERS,
    ADMIN_IDS,
    FILE_PATH
} = require('./constants');

const provider = new ethers.providers.JsonRpcProvider(RPC);

class Node {
    constructor(address) {
        this.address = address;
        this.children = [];
    }
}

class Tree {
    constructor(root) {
        this.root = root;
        this.levelMap = new Map();
        this.refCountMap = new Map();
        this.txNodesBuyMap = new Map();
        this.saleMap = new Map();
    }

    async preorderTraversal(node = this.root, level = 1, maxLevel = 10) {
        if (node) {
            await this.getNewNodeEvents(node.address, level);
            level++;
            if (level <= maxLevel) {
                let searchNode = this.search(node.address);
                for (const child of searchNode.children) {
                    await this.preorderTraversal(child, level);
                }
            }
        }
    }

    preOrderInsert(parent, child) {
        if (!parent) {
            throw new Error("Parent node cannot be null");
        }
        if (parent.address != child.address) {
            parent.children.unshift(child); // Insert child at the beginning for pre-order
            child.children.forEach(grandchild => this.preOrderInsert(child, grandchild));
        }
    }

    search(address) {
        const queue = [this.root];
        while (queue.length) {
            const node = queue.shift();
            if (node.address == address) {
                return node;
            }
            queue.push(...node.children);
        }
        return null;
    }

    async getNewNodeEvents(inputAddress, level) {
        let parent = this.search(inputAddress);
        try {
            // Create a contract instance
            const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);

            // get current tier
            const state = await contract._state();
            const nodePrice = state['_nodePrice'];
            const price = parseFloat(ethers.utils.formatUnits(nodePrice).toString());
            this.currentTier = getTierFromNodePrice(price);

            const filter = {
                address: CONTRACT_ADDRESS,
                topics: [
                    "0x448511bdc0685b88ba7db67a898512cd63b1a760d8beef3e3d10974907845333",
                    null, // _owner
                    null, // _nodePrice
                    ethers.utils.hexZeroPad(inputAddress, 32), // _refAddress
                ]
            }

            const events = await contract.queryFilter(filter);

            const ownersSet = new Set();
            const txHashes = [];
            let numberNodeSold = 0;
            // let totalETH = ethers.BigNumber.from('0');
            for (const event of events) {
                const args = event.args;
                const txHash = event.transactionHash;
                txHashes.push(txHash);
                const owner = args['_owner'];
                const numberOfNodes = args['_numberOfNodes'].toNumber();

                let tx = await provider.getTransaction(txHash);
                let txValue = parseFloat(ethers.utils.formatUnits(tx.value).toString());

                const _nodePrice = parseFloat(ethers.utils.formatUnits(args['_nodePrice']).toString());
                let tier = getTierFromNodePrice(_nodePrice).toString();
                this.txNodesBuyMap.set(txHash, [numberOfNodes, txValue, tx.from, tier]);

                let child = new Node(owner);
                if (!ownersSet.has(owner)) {
                    ownersSet.add(owner);
                    this.preOrderInsert(parent, child);
                }

                // totalETH = totalETH.add(args['_nodePrice'].mul(args['_numberOfNodes']));
                numberNodeSold += numberOfNodes;
            }

            if (!this.levelMap.has(level.toString())) {
                this.levelMap.set(level.toString(), new Map());
            }
            let map = this.levelMap.get(level.toString());
            if (!map.has(parent.address)) {
                map.set(parent.address, txHashes);
            }
            this.levelMap.set(level.toString(), map);

            // console.log(`Total ETH sold: ${ethers.utils.formatUnits(totalETH.toString())} $ETH`);
            if (level == 0) {
                // console.log(`Number nodes sold by ${parent.address} (root): ${numberNodeSold}\n`);
                let map = this.levelMap.get(level.toString());
                if (!map.has(parent.address)) {
                    map.set(parent.address, txHashes);
                }
                this.levelMap.set(level.toString(), map);
            }

            if (!this.refCountMap.has(parent.address)) {
                this.refCountMap.set(parent.address, ownersSet.size);
            }
            this.saleMap.set(parent.address, numberNodeSold);

        } catch (error) {
            console.error(error);
        }
    }

}

async function main(inputAddress, maxLevel = 10) {
    console.log(`Referrals of ${inputAddress}`);
    const root = new Node(inputAddress);
    const tree = new Tree(root);
    try {
        await tree.preorderTraversal(root, 1, maxLevel);
    } catch (error) {
        await bot.sendMessage(msg.chat.id, 'Error. Please try again later.');
        console.log(`err: ${error}`);
    }

    return tree;
}

async function loadTreeFromJsonFile(inputAddress) {
    console.log(`Referrals of ${inputAddress}`);
    try {
        const filePath = `../ref-bot/data/${inputAddress}.json`;
        const data = await fs.readFile(filePath, 'utf8');
        const tree = JSON.parse(data);
        return tree;
    } catch (error) {
        console.log('error: ', error);
        throw new Error("RPC call failed. Please try again");
    }
}

// bot.onText(/\/check (.+) (.+)/, async (msg, match) => {
//     const username = match[1].toLowerCase();
//     let address = kolMap[username];
//     let isAddressFound = true;
//     if (!address) {
//         address = username;
//         isAddressFound = false;
//     }
//     address = address.toLowerCase();

//     const tierParam = match[2].toLowerCase();
//     if (!TIERS.includes(tierParam)) {
//         console.log(`invalid tier ${tierParam}`);
//         await bot.sendMessage(msg.chat.id, `Invalid tier ${tierParam}`);
//         return;
//     }
//     const tier = tierParam.split('t')[1];

//     const LEVEL = '1';
//     try {
//         // const tree = await main(address, 1);
//         let tree;
//         if (isAddressFound) {
//             tree = await loadTreeFromJsonFile(address.toLowerCase());
//             const levelMap = new Map(Object.entries(tree.levelMap));
//             levelMap.forEach((levelContent, level) => {
//                 levelMap.set(level, new Map(Object.entries(levelContent)));
//             });
//             const refCountMap = new Map(Object.entries(tree.refCountMap));
//             const txNodesBuyMap = new Map(Object.entries(tree.txNodesBuyMap));
//             const saleMap = new Map(Object.entries(tree.saleMap));

//             tree.levelMap = levelMap;
//             tree.refCountMap = refCountMap;
//             tree.txNodesBuyMap = txNodesBuyMap;
//             tree.saleMap = saleMap;

//         } else {
//             tree = await main(address, 1);
//         }
//         const levelMap = tree.levelMap;
//         const refCountMap = tree.refCountMap;
//         const txNodesBuyMap = tree.txNodesBuyMap;
//         const saleMap = tree.saleMap;

//         const userUrl = `https://explorer.zksync.io/address/${address}`;
//         let message = `👨 <a href='${userUrl}'>${formatAddress(address)}</a> Ref Info - Tier ${tier}\n\n`;
//         if (!levelMap.has(LEVEL)) {
//             message += `You have 0️⃣ Ref. Try again later!`;
//         } else {
//             const levelContent = levelMap.get(LEVEL);
//             const [s1, numKeys, saleETH] = logGeneral(levelContent, LEVEL, refCountMap, txNodesBuyMap, saleMap, tier);
//             message += s1;
//         }

//         // bonus reward txs
//         const bonusData = await loadDataFromJsonFile();
//         const txs = bonusData[address];
//         let bonusReward = 0.0;
//         let bonusRewardMsg = ``;
//         if (txs && txs.length) {
//             for (let i = 0; i < txs.length; i++) {
//                 let tx = await provider.getTransaction(txs[i]);
//                 const txValue = parseFloat(ethers.utils.formatUnits(tx.value));
//                 bonusReward += txValue;
//                 const logValue = parseFloat(txValue.toFixed(6));
//                 bonusRewardMsg += `\t\t\t\t<b>Tx: <a href="https://explorer.zksync.io/tx/${txs[i]}">${formatAddress(txs[i])}</a> (${logValue} $ETH)</b>\n\n`
//             }
//         }

//         message += `Bonus 5%: ${parseFloat(bonusReward)} $ETH\n\n`;
//         message += bonusRewardMsg;

//         const opts = {
//             parse_mode: 'HTML',
//         }

//         await bot.sendMessage(msg.chat.id, message, opts);
//     } catch (error) {
//         await bot.sendMessage(msg.chat.id, 'Error. Please try again later.');
//         console.log(`err: ${error}`)
//     }
// });

bot.onText(/\/pay (.+)/, async (msg, match) => {
    if (!ADMIN_IDS.includes(msg.from.id)) {
        console.log(`unauthorized user ${msg.from.id}`);
        return; // Ignore messages from unauthorized users
    }

    const txHash = match[1];

    const data = await loadDataFromJsonFile();

    try {
        let tx = await provider.getTransaction(txHash);
        const address = tx.to.toLowerCase();
        const value = tx.value;
        if (!data.hasOwnProperty(address)) {
            data[address] = [txHash];
        } else {
            let txSet = new Set(data[address]);
            txSet.add(txHash);
            data[address] = Array.from(txSet);
        }

        const jsonData = JSON.stringify(data);
        await fs.writeFile(FILE_PATH, jsonData);
        await bot.sendMessage(msg.chat.id, 'Saved');

    } catch (err) {
        await bot.sendMessage(msg.chat.id, 'Error. Please try again later.');
        console.log(`err: ${err}`)
    }
});

bot.onText(/\/check (.+)/, async (msg, match) => {
    const username = match[1].toLowerCase();
    let address = kolMap[username];
    let isAddressFound = true;
    if (!address) {
        address = username;
        isAddressFound = false;
    }
    if (!ADMIN_IDS.includes(msg.from.id)) {
        console.log(`unauthorized user ${msg.from.id}`);
        return; // Ignore messages from unauthorized users
    }

    try {
        // const tree = await main(address);
        let tree;
        if (isAddressFound) {
            tree = await loadTreeFromJsonFile(address.toLowerCase());
            const levelMap = new Map(Object.entries(tree.levelMap));
            levelMap.forEach((levelContent, level) => {
                levelMap.set(level, new Map(Object.entries(levelContent)));
            });
            const refCountMap = new Map(Object.entries(tree.refCountMap));
            const txNodesBuyMap = new Map(Object.entries(tree.txNodesBuyMap));
            const saleMap = new Map(Object.entries(tree.saleMap));

            tree.levelMap = levelMap;
            tree.refCountMap = refCountMap;
            tree.txNodesBuyMap = txNodesBuyMap;
            tree.saleMap = saleMap;

        } else {
            tree = await main(address);
        }
        const levelMap = tree.levelMap;
        const refCountMap = tree.refCountMap;
        const txNodesBuyMap = tree.txNodesBuyMap;
        const saleMap = tree.saleMap;
        const currentTier = tree.currentTier;

        const userUrl = `https://explorer.zksync.io/address/${address}`;
        let message = `👨 <b><a href='${userUrl}'>${formatAddress(address)}</a> Check Full Tier</b>\n\n`;

        let s = ``;
        let totalKeys = 0;
        let totalSaleETH = 0.0;

        // levelMap.forEach((levelContent, level) => {
        //     const [s1, numKeys, saleETH] = logTier(levelContent, level, refCountMap, txNodesBuyMap, saleMap, currentTier);
        //     if (numKeys > 0) {
        //         s += s1;
        //         totalKeys += numKeys;
        //         totalSaleETH += saleETH;
        //     }
        // });
        levelContent = levelMap.get('1');
        const [s1, numKeys, saleETH] = logTier(levelContent, '1', refCountMap, txNodesBuyMap, saleMap, currentTier);
        if (numKeys > 0) {
            s += s1;
            totalKeys += numKeys;
            totalSaleETH += saleETH;
        }

        message += `💲<b>Total sale: ${totalKeys} keys (${parseFloat(totalSaleETH.toFixed(6))} $ETH)</b>\n\n`;
        message += s;

        // bonus reward txs
        const bonusData = await loadDataFromJsonFile();
        const txs = bonusData[address];
        let bonusReward = 0.0;
        let bonusRewardMsg = ``;
        if (txs && txs.length) {
            for (let i = 0; i < txs.length; i++) {
                let tx = await provider.getTransaction(txs[i]);
                const txValue = parseFloat(ethers.utils.formatUnits(tx.value));
                bonusReward += txValue;
                const logValue = parseFloat(txValue.toFixed(6));
                bonusRewardMsg += `\t\t\t\t\t\t<b>🔗 Tx: <a href="https://explorer.zksync.io/tx/${txs[i]}">${formatAddress(txs[i])}</a> (${logValue} $ETH)</b>\n\n`
            }
        }

        message += `\t\t\t🏆 Reward 5%: ${parseFloat((totalSaleETH * 5 / 100).toFixed(6))} $ETH\n\n`;
        message += `\t\t\t🎁️️ Bonus 5%: ${parseFloat(bonusReward)} $ETH\n\n`;
        message += bonusRewardMsg;

        const opts = {
            parse_mode: 'HTML',
        }

        await bot.sendMessage(msg.chat.id, message, opts);
    } catch (error) {
        await bot.sendMessage(msg.chat.id, 'Error. Please try again later.');
        console.log(`err: ${error}`)
    }
});

/*
bot.onText(/\/lv0 (.+) (.+)/, async (msg, match) => {
    const username = match[1].toLowerCase();
    const page = match[2];
    const refCode = '0';
    const level = '0';

    const address = kolMap[username];
    try {
        const tree = await main(address);
        const levelMap = tree.levelMap;
        const refCountMap = tree.refCountMap;
        const txNodesBuyMap = tree.txNodesBuyMap;
        const saleMap = tree.saleMap;

        let message = '';
        if (!levelMap.has(level)) {
            message += `User has 0️⃣ direct ref. Try again later!`;
        } else {
            let levelContent = levelMap.get(level);

            const [s, numPages] = logPageCodeType(levelContent, refCode, refCountMap, txNodesBuyMap, saleMap, page);

            let numberRef = refCountMap.get(address);
            let userUrl = `https://explorer.zksync.io/address/${address}`;
            message += `👨 <a href='${userUrl}'>${formatAddress(address)}</a> sold ${saleMap.get(address)} 🔑 & ${numberRef} direct ref\n\n`;
            message += `🔗 Direct ref - ${refCode}% discount sale - (page ${page}/${numPages}):\n\n`;

            message += `\t\t\t\t🏷Sale transactions:\n\n`;

            message += s;
        }

        const opts = {
            parse_mode: 'HTML',
        }

        await bot.sendMessage(msg.chat.id, message, opts);
    } catch (error) {
        await bot.sendMessage(msg.chat.id, 'Error. Please try again later.');
        console.log(`err: ${error}`)
    }
});
*/