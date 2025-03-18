import axios from 'axios';
import { PublicKey } from '@solana/web3.js';

// Jupiter API v4 base URL
const JUPITER_API_BASE = 'https://api.jup.ag/swap/v1';

// Interface for Jupiter Quote
export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: null | {
    feeBps: number;
    feeAccount: string;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
  swapUsdValue?: string;
  simplerRouteUsed?: boolean;
  scoreReport?: null | any;
}

/**
 * Get a quote from Jupiter for swapping tokens
 * @param inputMint - The mint address of the input token
 * @param outputMint - The mint address of the output token
 * @param amount - The amount of input tokens to swap
 * @param slippageBps - The allowed slippage in basis points (1% = 100)
 * @returns A Jupiter quote object
 */
export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50 // Default 0.5% slippage
): Promise<JupiterQuote> {
  try {
    // Convert amount to atomic units (lamports)
    // Note: In a production app, you should fetch token decimals from on-chain
    // For now, we'll assume USDC (6 decimals) for simplicity
    const amountInLamports = Math.floor(amount * 1_000_000).toString();
    
    // Validate mint addresses
    try {
      new PublicKey(inputMint);
      new PublicKey(outputMint);
    } catch (error) {
      throw new Error('Invalid token mint address');
    }
    
    const response = await axios.get(`${JUPITER_API_BASE}/quote`, {
      params: {
        inputMint,
        outputMint,
        amount: amountInLamports,
        slippageBps,
        onlyDirectRoutes: false,
        asLegacyTransaction: false,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.status !== 200) {
      throw new Error(`Jupiter API error: ${response.statusText}`);
    }
    
    return response.data;
  } catch (error: any) {
    console.error('Jupiter quote error:', error);
    
    if (error.response) {
      // Handle API response errors
      const statusCode = error.response.status;
      const errorMessage = error.response.data?.error || 'Unknown Jupiter API error';
      throw new Error(`Jupiter API error (${statusCode}): ${errorMessage}`);
    }
    
    throw error;
  }
}

/**
 * Execute a swap using Jupiter
 * @param quoteResponse - The quote response from getJupiterQuote
 * @param userPublicKey - The user's wallet public key
 * @returns The transaction signature
 */
export async function executeJupiterSwap(
  quoteResponse: JupiterQuote,
  userPublicKey: string
): Promise<{ txid: string }> {
  try {
    // In a real implementation, you would:
    // 1. Get the serialized transaction from Jupiter's /swap endpoint
    // 2. Deserialize the transaction
    // 3. Send it to the wallet for signing
    // 4. Submit the signed transaction
    
    // For the demo, we'll just return a mock transaction ID
    console.log('Executing swap with quote:', quoteResponse);
    console.log('User public key:', userPublicKey);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Return a fake transaction ID
    return {
      txid: Array.from({ length: 64 }, () => 
        '0123456789abcdef'[Math.floor(Math.random() * 16)]
      ).join('')
    };
  } catch (error) {
    console.error('Jupiter swap execution error:', error);
    throw error;
  }
}

/**
 * Get the price of a token in terms of another token
 * @param inputMint - The mint address of the input token
 * @param outputMint - The mint address of the output token
 * @returns The price (outputToken per inputToken)
 */
export async function getJupiterPrice(
  inputMint: string,
  outputMint: string
): Promise<number> {
  try {
    const response = await axios.get(`${JUPITER_API_BASE}/price`, {
      params: {
        ids: inputMint,
        vsToken: outputMint,
      },
    });
    
    if (response.status !== 200) {
      throw new Error(`Jupiter API error: ${response.statusText}`);
    }
    
    // The API returns a map of token ID to price
    const price = response.data.data[inputMint]?.price;
    if (price === undefined) {
      throw new Error('Price not available for the specified tokens');
    }
    
    return price;
  } catch (error) {
    console.error('Jupiter price error:', error);
    throw error;
  }
}
