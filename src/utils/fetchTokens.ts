import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ENV } from '../config/env';

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

/**
 * Checks if a wallet has sufficient balance of a specific token
 * 
 * @param walletAddress The Solana wallet address as string
 * @param tokenMint The token mint address
 * @param requiredAmount The amount required for the transaction
 * @returns An object with balance info and whether it's sufficient
 */
export async function checkTokenBalance(
  walletAddress: string, 
  tokenMint: string, 
  requiredAmount: number
): Promise<{ 
  hasEnough: boolean; 
  balance: number; 
  shortfall: number;
}> {
  const connection = new Connection(ENV.SOLANA_RPC_URL, 'confirmed');
  const walletPublicKey = new PublicKey(walletAddress);
  const mintPublicKey = new PublicKey(tokenMint);
  
  try {
    // Find all token accounts owned by the wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { programId: TOKEN_PROGRAM_ID }
    );
    
    // Find the specific token account for this mint
    const tokenAccount = tokenAccounts.value.find(account => 
      account.account.data.parsed.info.mint === tokenMint
    );
    
    if (!tokenAccount) {
      return { 
        hasEnough: false, 
        balance: 0, 
        shortfall: requiredAmount 
      };
    }
    
    // Get the balance as a number
    const balance = Number(tokenAccount.account.data.parsed.info.tokenAmount.amount) / 
                    Math.pow(10, tokenAccount.account.data.parsed.info.tokenAmount.decimals);
    
    const hasEnough = balance >= requiredAmount;
    const shortfall = hasEnough ? 0 : requiredAmount - balance;
    
    return { hasEnough, balance, shortfall };
  } catch (error) {
    console.error('Error checking token balance:', error);
    // Return false in case of error, to be safe
    return { 
      hasEnough: false, 
      balance: 0, 
      shortfall: requiredAmount 
    };
  }
}