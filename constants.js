const CONTRACT_ADDRESS = '0x2a88444D7A5626e52928D9799ae15F0Bb273bFbd';
const SPECIAL_ADDRESS = '0x3e657d3cf4cb2104e6a5a6ed6f19ae23d8869999';
const RPC = 'https://mainnet.era.zksync.io';

const ADMIN_IDS = [2127544523, 1559803968, 5728990868, 5413592753, 278657276];
const REF_CODES = ['0', '20', '100'];
const TIERS = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11', 't12', 't13', 't14', 't15',
    't16', 't17', 't18', 't19', 't20', 't21', 't22', 't23', 't24', 't25'
];

const TIER_PRICE_MAP = {
    '1': [0.04, 0.032, 0.0004],
    '2': [0.047, 0.0376, 0.00047],
    '3': [0.054, 0.0432, 0.00054],
    '4': [0.062, 0.0496, 0.00062],
    '5': [0.073, 0.0584, 0.00073],
    '6': [0.085, 0.068, 0.00085],
    '7': [0.099, 0.0792, 0.00099],
    '8': [0.115, 0.092, 0.00115],
    '9': [0.134, 0.1072, 0.00134],
    '10': [0.155, 0.124, 0.00155],
    '11': [0.18, 0.1, 0.1],
    '12': [0.2, 0.1, 0.1],
    '13': [0.24, 0.1, 0.1],
    '14': [0.277, 0.1, 0.1],
    '15': [0.318, 0.1, 0.1],
    '16': [0.365, 0.1, 0.1],
    '17': [0.418, 0.1, 0.1],
    '18': [0.478, 0.1, 0.1],
    '19': [0.546, 0.1, 0.1],
    '20': [0.623, 0.1, 0.1],
    '21': [0.712, 0.1, 0.1],
    '22': [0.814, 0.1, 0.1],
    '23': [0.929, 0.1, 0.1],
    '24': [1.06, 0.1, 0.1],
    '25': [1.21, 0.1, 0.1],
}

const TXS_PER_PAGE = 20;
const REFERRERS_PER_PAGE = 50;
const REFERRERS_PER_PAGE_SHOWREF = 100;
const LAST_5_TX = '0xa5733dba3e26e9c8cfb8c2f0c0af9fec0ffe6e7828ccece53fff76c7ccc2d54a';

const FILE_PATH = `./data/bonus.json`;

module.exports = {
    CONTRACT_ADDRESS,
    ADMIN_IDS,
    REF_CODES,
    TIERS,
    SPECIAL_ADDRESS,
    RPC,
    TIER_PRICE_MAP,
    TXS_PER_PAGE,
    REFERRERS_PER_PAGE,
    REFERRERS_PER_PAGE_SHOWREF,
    LAST_5_TX,
    FILE_PATH
}