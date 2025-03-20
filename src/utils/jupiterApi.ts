import axios from 'axios';
import { ENV } from '../config/env';
import { Connection, PublicKey } from '@solana/web3.js';

// Jupiter API v4 base URL
const JUPITER_API_BASE = 'https://api.jup.ag/swap/v1';

const connection = new Connection(ENV.SOLANA_RPC_URL, 'confirmed');

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

    const tokenDecimals = await getTokenDecimals(outputMint);
    const amountInLamports = convertToLamports(amount,tokenDecimals);
    
    // Validate mint addresses
    try {
      new PublicKey(inputMint);
      new PublicKey(outputMint);
    } catch (error) {
      throw new Error('Invalid token mint address');
    }

    console.log("Get quote: input mint:", inputMint);
    console.log("Get quote: output mint:", outputMint);
    
    const response = await axios.get(`${JUPITER_API_BASE}/quote`, {
      params: {
        inputMint: inputMint,
        outputMint: outputMint,
        amount: amountInLamports,
        slippageBps: slippageBps,
        onlyDirectRoutes: false,
        asLegacyTransaction: false
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
  userPublicKey: string,
  destinationTokenAccount:string
): Promise<Response> {
  try {
    console.log("Executing swap with Jupiter.");
    
    const swapResponse = await fetch(`${JUPITER_API_BASE}/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        destinationTokenAccount,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            maxLamports: 1_000_000,
            priorityLevel: "veryHigh",
          },
        },
      }),
    });

    return swapResponse;
  } catch (error) {
    console.error("Jupiter swap execution error:", error);
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

export async function getTokenDecimals(mintAddress: string): Promise<number> {
  try {
    const mintPubkey = new PublicKey(mintAddress);
    const tokenSupply = await connection.getTokenSupply(mintPubkey);
    return tokenSupply.value.decimals;
  } catch (error) {
    console.error("Error fetching token decimals:", error);
    throw error;
  }
}

export function convertToLamports(amount: number, decimals: number): string {
  const factor = 10 ** decimals;
  const amountInLamports = Math.floor(amount * factor);
  return amountInLamports.toString();
}
