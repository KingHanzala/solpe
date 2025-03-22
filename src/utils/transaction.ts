import { getJupiterQuote, executeJupiterSwap, getTokenDecimals } from './jupiterApi';
import { ENV } from '../config/env';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createTransferInstruction } from "@solana/spl-token";
import { PublicKey, sendAndConfirmTransaction, Transaction, SystemProgram, Connection, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import toast from 'react-hot-toast';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export async function fetchSwapRate(token: string, amount: number): Promise<number> {
  try {
    // If token is USDC, return the same amount (1:1)
    if (token === USDC_MINT) {
      return amount;
    }

    const quote = await getJupiterQuote(
      USDC_MINT,
      token,
      amount,
      50 // 0.5% slippage
    );

    const decimals = await getTokenDecimals(token);
    
    // Convert from lamports back to token units (assuming 6 decimals for now)
    const inputAmount = parseFloat(quote.inAmount) / 1_000_000;

    // Convert from lamports back to token units (assuming 6 decimals for now)
    const outputAmount = parseFloat(quote.outAmount) / 10**decimals;
    
    console.log('Jupiter quote received:', {
      inputToken: token,
      outputToken: USDC_MINT,
      inputAmount,
      outputAmount: parseFloat(quote.outAmount) / 10**decimals,
      priceImpact: quote.priceImpactPct + '%'
    });
    
    return outputAmount;
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

export async function swapTransaction(
  publicKey: PublicKey,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  receiverAddress: string,
  tokenMint: string,
  tokenAmount: number
) {
  try {
    console.log(`Preparing transaction for ${tokenAmount} of token ${tokenMint} to ${receiverAddress}`);
    const connection = new Connection(ENV.SOLANA_RPC_URL, 'confirmed');
    const signer = await window.solana.connect();
    const userPublicKey = publicKey;
    const receiverPublicKey = new PublicKey(receiverAddress);
    const mintPublicKey = new PublicKey(tokenMint);
    const usdc = new PublicKey(USDC_MINT);
    let transaction = null;
    const merchantUSDCTokenAccount = await getAssociatedTokenAddress(
      usdc,
      receiverPublicKey,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    if(tokenMint == USDC_MINT) {
      throw new Error("Transaction not feasible");
    }
    console.log("Token is not USDC, performing swap before sending.");

    const quoteResponse = await getJupiterQuote(tokenMint, usdc.toBase58(), tokenAmount);
    if (!quoteResponse || !quoteResponse.inAmount) {
      throw new Error("Failed to fetch Jupiter quote");
    }

    const swapResponse = await (await executeJupiterSwap(quoteResponse, userPublicKey.toBase58(), merchantUSDCTokenAccount.toBase58())).json();
    if (!swapResponse || !swapResponse.swapTransaction) {
      throw new Error("Failed to execute Jupiter swap");
    }

    console.log("Swap completed, proceeding with transfer.");
    console.log(swapResponse);

    const transactionBase64 = swapResponse.swapTransaction
    try {
      transaction = VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));
    } catch (error) {
      console.error("Failed to deserialize transaction:", error);
      throw new Error("Invalid swap transaction");
    }
    console.log(transaction);
  let signature = '';
  if(transaction!=null){
    const signedTransaction = await signTransaction(transaction);

    const transactionBinary = signedTransaction.serialize();
    console.log(transactionBinary);

    signature = await connection.sendRawTransaction(transactionBinary, {
      maxRetries: 5,
      preflightCommitment: "finalized"
    });
    await waitForConfirmation(connection, signature);
    }
    return signature;
  } catch (error: any) {
    console.error("Transaction error:", error);
    throw error;
  }
}

export async function waitForConfirmation(connection: Connection, signature: string) {
  let retries = 10; // Adjust based on your needs

  while (retries > 0) {
    const { value } = await connection.getSignatureStatus(signature);
    console.log("Checking status...", value);
    
    if (value?.confirmationStatus === "confirmed" || value?.confirmationStatus === "finalized") {
      console.log("Transaction confirmed ✅");
      return;
    }

    retries--;
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 sec before retrying
  }

  throw new Error("Transaction confirmation timeout ❌");
}