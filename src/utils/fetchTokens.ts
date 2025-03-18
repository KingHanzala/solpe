import { Connection, PublicKey } from '@solana/web3.js';
import { ENV } from '../config/env';
import toast from 'react-hot-toast';

// RPC endpoints to try in order
const RPC_ENDPOINTS = [
  ENV.SOLANA_RPC_URL,
  'https://api.mainnet-beta.solana.com',
  'https://solana-mainnet.rpc.extrnode.com',
  'https://rpc.ankr.com/solana'
];

export async function fetchTokens(walletAddress: string): Promise<string[]> {
  let lastError: Error | null = null;
  
  // Try each endpoint until successful
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      console.log(`Attempting to fetch tokens using endpoint: ${endpoint}`);
      const connection = new Connection(endpoint, 'confirmed');
      const publicKey = new PublicKey(walletAddress);
      
      // First try getParsedTokenAccountsByOwner (more efficient but might be restricted)
      try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
        });
        
        // Extract token mint addresses
        const tokens = tokenAccounts.value
          .filter(accountInfo => {
            const parsedInfo = accountInfo.account.data.parsed.info;
            // Filter out accounts with zero balance
            return parsedInfo.tokenAmount?.uiAmount > 0;
          })
          .map(accountInfo => {
            const parsedInfo = accountInfo.account.data.parsed.info;
            return parsedInfo.mint;
          });
        
        console.log(`Successfully fetched ${tokens.length} tokens using endpoint: ${endpoint}`);
        return tokens;
      } catch (parseError) {
        console.warn(`Error with getParsedTokenAccountsByOwner, falling back to getTokenAccountsByOwner`, parseError);
        
        // Fallback to getTokenAccountsByOwner if parsing fails
        const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
        });
        
        // Extract mint addresses from token accounts
        const tokens = [];
        for (const { account } of tokenAccounts.value) {
          // Extract mint address from token account data
          // The mint address is located at bytes 0-32
          const data = account.data;
          const mintAddress = new PublicKey(data.slice(0, 32));
          tokens.push(mintAddress.toString());
        }
        
        console.log(`Successfully fetched ${tokens.length} tokens using fallback method on endpoint: ${endpoint}`);
        return tokens;
      }
    } catch (error: any) {
      console.error(`Failed to fetch tokens from endpoint ${endpoint}:`, error);
      lastError = error;
      
      // Continue to the next endpoint
      console.log(`Trying next RPC endpoint...`);
    }
  }
  
  // If we've tried all endpoints and all failed, throw the last error
  if (lastError) {
    throw new Error(lastError.message || 'Failed to fetch tokens from all available RPC endpoints');
  }
  
  return []; // Fallback empty array if all methods fail
}

// Helper function to get a mock list of tokens for testing
export function getMockTokens(): string[] {
  return [
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    'So11111111111111111111111111111111111111112',  // Wrapped SOL
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  ];
}