const ethers = require("ethers");
const abi = require("./abi.json");
const kolMap = require("./kol.json");
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { formatAddress, logLevelMap, logGeneral, logPage, logPageCodeType } = require('./utils');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

const CONTRACT_ADDRESS = '0x2a88444D7A5626e52928D9799ae15F0Bb273bFbd';
const RPC = 'https://mainnet.era.zksync.io';

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

    async preorderTraversal(node = this.root, level = 0, maxLevel = 10) {
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

                this.txNodesBuyMap.set(txHash, [numberOfNodes, txValue, tx.from]);

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
        await tree.preorderTraversal(root, 0, maxLevel);
    } catch (error) {
        await bot.sendMessage(msg.chat.id, 'Error. Please try again later.');
        console.log(`err: ${error}`);
    }

    return tree;
}

bot.onText(/\/check (.+)/, async (msg, match) => {
    const username = match[1].toLowerCase();
    const address = kolMap[username];
    const LEVEL = '0';
    try {
        const tree = await main(address, 0);
        const levelMap = tree.levelMap;
        const refCountMap = tree.refCountMap;
        const txNodesBuyMap = tree.txNodesBuyMap;
        const saleMap = tree.saleMap;

        const userUrl = `https://explorer.zksync.io/address/${address}`;
        let message = `👨 <a href='${userUrl}'>${formatAddress(address)}</a> Ref Info\n\n`;
        if (!levelMap.has(LEVEL)) {
            message += `You have 0️⃣ Ref. Try again later!`;
        } else {
            const levelContent = levelMap.get(LEVEL);
            message += logGeneral(levelContent, LEVEL, refCountMap, txNodesBuyMap, saleMap);
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