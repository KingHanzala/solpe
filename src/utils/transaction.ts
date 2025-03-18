import { getJupiterQuote, executeJupiterSwap } from './jupiterApi';
import { PublicKey } from '@solana/web3.js';
import toast from 'react-hot-toast';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export async function fetchSwapRate(token: string, amount: number): Promise<number> {
  try {
    // If token is USDC, return the same amount (1:1)
    if (token === USDC_MINT) {
      return amount;
    }

    const quote = await getJupiterQuote(
      token,
      USDC_MINT,
      amount,
      50 // 0.5% slippage
    );
    
    // Convert from lamports back to token units (assuming 6 decimals for now)
    const inputAmount = parseFloat(quote.inAmount) / 1_000_000;

    // Convert from lamports back to token units (assuming 6 decimals for now)
    const outputAmount = parseFloat(quote.outAmount) / 1_000_000;
    
    console.log('Jupiter quote received:', {
      inputToken: token,
      outputToken: USDC_MINT,
      inputAmount,
      outputAmount: parseFloat(quote.outAmount) / 1_000_000,
      priceImpact: quote.priceImpactPct + '%'
    });
    
    return 1.0/outputAmount;
  } catch (error: any) {
    console.error('Error fetching swap rate:', error);
    toast.error(`Failed to get swap rate: ${error.message}`);
    
    // If we can't get a real quote, return a mock rate for demo purposes
    if (token === USDC_MINT) {
      return amount; // 1:1 for USDC to USDC
    }
    
    // Generate a mock rate based on token address to simulate different tokens having different rates
    const tokenSeed = token.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const mockRate = amount * (0.9 + (tokenSeed % 100) / 500); // Rate between 0.9 and 1.1 times amount
    
    console.log('Using mock swap rate:', mockRate);
    return mockRate;
  }
}

// filepath: src/utils/transaction.ts
export async function sendTransaction(
  receiverAddress: string, 
  tokenMint: string, 
  tokenAmount: number, 
  usdcAmount: number
): Promise<string> {
  try {
    console.log(`Preparing to send ${tokenAmount} of token ${tokenMint} to ${receiverAddress}`);
    
    // Validate addresses
    try {
      new PublicKey(receiverAddress);
      new PublicKey(tokenMint);
    } catch (error) {
      throw new Error('Invalid address format');
    }
    
    // In a real implementation:
    // 1. Create a transaction to transfer tokens
    // 2. If tokenMint isn't USDC, perform a Jupiter swap first
    // 3. Send the transaction to the wallet for signing
    // 4. Submit the signed transaction
    
    // For the demo, simulate network delay and return a mock signature
    toast.success('Transaction initiated');
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Generate a fake transaction signature
    const fakeSignature = Array.from({ length: 64 }, () => 
      '0123456789abcdef'[Math.floor(Math.random() * 16)]
    ).join('');
    
    console.log(`Transaction completed with signature: ${fakeSignature}`);
    
    return fakeSignature;
  } catch (error: any) {
    console.error('Transaction error:', error);
    toast.error(`Transaction failed: ${error.message}`);
    throw error;
  }
}

// Helper function to handle token decimals correctly
export function getTokenDecimals(tokenMint: string): number {
  // In a real app, you would fetch this from the blockchain
  // For now, use common known values
  const knownDecimals: Record<string, number> = {
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6, // USDC
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6, // USDT
    'So11111111111111111111111111111111111111112': 9,  // Wrapped SOL
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 9, // mSOL
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 5, // BONK
  };
  
  return knownDecimals[tokenMint] || 6; // Default to 6 if unknown
}