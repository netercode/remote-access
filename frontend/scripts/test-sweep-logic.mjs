// End-to-end test of the REAL sweep.ts logic against a local chain.
// This deploys two ERC-20 tokens, funds a test wallet with them plus native
// ETH, then calls the exact same buildSweepCalls/sweepAll functions the
// React app uses, and verifies the safety wallet ends up with everything.

import Ganache from 'ganache';
import solc from 'solc';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  formatUnits,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sweepAll, buildSweepCalls } from '../src/lib/sweep.ts';
import { erc20Abi } from '../src/lib/tokens.ts';

const SOURCE_PK = generatePrivateKey();
const SAFETY_PK = generatePrivateKey();

const sourceAccount = privateKeyToAccount(SOURCE_PK);
const safetyAccount = privateKeyToAccount(SAFETY_PK);

console.log('Source wallet: ', sourceAccount.address);
console.log('Safety wallet: ', safetyAccount.address);
console.log('');

// --- compile a minimal ERC20 ---
const SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract TestToken {
    string public symbol;
    uint8 public decimals = 18;
    mapping(address => uint256) public balanceOf;
    constructor(string memory _symbol, uint256 initialSupply, address holder) {
        symbol = _symbol;
        balanceOf[holder] = initialSupply;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}`;

function compile() {
  const input = {
    language: 'Solidity',
    sources: { 'TestToken.sol': { content: SOURCE } },
    settings: { evmVersion: 'london', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const contract = output.contracts['TestToken.sol']['TestToken'];
  return { abi: contract.abi, bytecode: '0x' + contract.evm.bytecode.object };
}

async function main() {
  const { abi, bytecode } = compile();
  console.log('✓ Compiled TestToken contract\n');

  const server = Ganache.server({
    chain: { chainId: 56 }, // simulate BNB Smart Chain's real chain ID, not Ethereum's
    wallet: {
      accounts: [
        { secretKey: SOURCE_PK, balance: '0x56BC75E2D63100000' }, // 100 ETH
        { secretKey: SAFETY_PK, balance: '0x0' },
      ],
    },
    logging: { quiet: true },
  });
  await new Promise((resolve, reject) => server.listen(8545, (err) => (err ? reject(err) : resolve())));
  console.log('✓ Local chain running on http://127.0.0.1:8545\n');

  const transport = http('http://127.0.0.1:8545');
  const publicClient = createPublicClient({ transport });
  const sourceWalletClient = createWalletClient({ account: sourceAccount, transport });

  // Deploy two test tokens, minting supply directly to the source wallet
  const tokenAddrs = [];
  for (const symbol of ['ALPHA', 'BETA']) {
    const hash = await sourceWalletClient.deployContract({
      abi,
      bytecode,
      args: [symbol, parseEther('1000'), sourceAccount.address],
      chain: null,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    tokenAddrs.push(receipt.contractAddress);
    console.log(`✓ Deployed ${symbol} at ${receipt.contractAddress}`);
  }
  console.log('');

  // --- confirm starting balances ---
  const startNative = await publicClient.getBalance({ address: sourceAccount.address });
  console.log(`Starting native balance: ${formatEther(startNative)} ETH`);
  const startTokenBalances = [];
  for (let i = 0; i < tokenAddrs.length; i++) {
    const bal = await publicClient.readContract({
      address: tokenAddrs[i],
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [sourceAccount.address],
    });
    startTokenBalances.push(bal);
    console.log(`Starting balance token[${i}]: ${formatUnits(bal, 18)}`);
  }
  console.log('');

  // --- build the "scanned tokens" the real app would have produced ---
  const tokens = [
    { address: tokenAddrs[0], symbol: 'ALPHA', decimals: 18, balance: startTokenBalances[0] },
    { address: tokenAddrs[1], symbol: 'BETA', decimals: 18, balance: startTokenBalances[1] },
  ];
  const reserveForGasWei = parseEther('0.01');

  // sanity check the pure call-builder too
  const calls = buildSweepCalls({
    safetyAddress: safetyAccount.address,
    tokens,
    nativeBalance: startNative,
    reserveForGasWei,
  });
  console.log(`buildSweepCalls produced ${calls.length} calls (expect 3: 2 tokens + native)\n`);
  if (calls.length !== 3) throw new Error('FAIL: unexpected call count from buildSweepCalls');
  if (calls.some((c) => c.to.toLowerCase() !== tokenAddrs[0].toLowerCase() && c.to.toLowerCase() !== tokenAddrs[1].toLowerCase() && c.to.toLowerCase() !== safetyAccount.address.toLowerCase())) {
    throw new Error('FAIL: a call is targeting an address other than a token or the safety wallet');
  }

  // --- run the REAL sweepAll function (this is the exact code the UI calls) ---
  console.log('--- Running sweepAll() (this is the real function used by the app) ---\n');
  const events = [];
  await sweepAll(
    sourceWalletClient,
    publicClient,
    {
      account: sourceAccount.address,
      chainId: await publicClient.getChainId(),
      safetyAddress: safetyAccount.address,
      tokens,
      nativeBalance: startNative,
      reserveForGasWei,
    },
    (event) => {
      events.push(event);
      console.log('  event:', JSON.stringify(event));
    }
  );
  console.log('');

  const errorEvents = events.filter((e) => e.type === 'error');
  if (errorEvents.length > 0) {
    throw new Error(`FAIL: sweepAll reported errors: ${JSON.stringify(errorEvents)}`);
  }
  if (!events.some((e) => e.type === 'done')) {
    throw new Error('FAIL: sweepAll never reported done');
  }
  // Since ganache doesn't support wallet_getCapabilities, this MUST have used sequential mode.
  const modeEvent = events.find((e) => e.type === 'mode-selected');
  console.log(`Mode used: ${modeEvent?.mode} (expected "sequential", since a plain node has no EIP-5792 support)\n`);
  if (modeEvent?.mode !== 'sequential') {
    throw new Error('FAIL: expected sequential fallback mode');
  }

  // --- verify final balances ---
  console.log('--- Verifying final balances ---\n');
  let allOk = true;

  for (let i = 0; i < tokenAddrs.length; i++) {
    const sourceBal = await publicClient.readContract({
      address: tokenAddrs[i], abi: erc20Abi, functionName: 'balanceOf', args: [sourceAccount.address],
    });
    const safetyBal = await publicClient.readContract({
      address: tokenAddrs[i], abi: erc20Abi, functionName: 'balanceOf', args: [safetyAccount.address],
    });
    console.log(`Token[${i}] — source: ${formatUnits(sourceBal, 18)}, safety: ${formatUnits(safetyBal, 18)}`);
    if (sourceBal !== 0n) { console.log(`  ✗ FAIL: source should be 0`); allOk = false; }
    if (safetyBal !== startTokenBalances[i]) { console.log(`  ✗ FAIL: safety wallet should have full original balance`); allOk = false; }
  }

  const finalSourceNative = await publicClient.getBalance({ address: sourceAccount.address });
  const finalSafetyNative = await publicClient.getBalance({ address: safetyAccount.address });
  console.log(`Native — source left: ${formatEther(finalSourceNative)} ETH, safety received: ${formatEther(finalSafetyNative)} ETH`);

  // Source should have roughly the gas reserve left, minus actual gas spent on 3 txs.
  if (finalSourceNative > reserveForGasWei) {
    console.log(`  ✗ FAIL: source wallet retained more than the gas reserve`);
    allOk = false;
  }
  if (finalSafetyNative === 0n) {
    console.log(`  ✗ FAIL: safety wallet received no native token`);
    allOk = false;
  }

  console.log('');
  if (allOk) {
    console.log('✅ ALL CHECKS PASSED — sweepAll correctly moved all tokens and native balance to the safety wallet only.');
  } else {
    console.log('❌ SOME CHECKS FAILED — see above.');
    process.exitCode = 1;
  }

  await new Promise((resolve) => server.close(resolve));
}

main().catch((err) => {
  console.error('TEST SCRIPT ERROR:', err);
  process.exitCode = 1;
});
