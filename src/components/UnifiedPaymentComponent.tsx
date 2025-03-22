'use client'
import React, { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { fetchSwapRate } from '../utils/transaction';
import { fetchTokens, checkTokenBalance } from '../utils/fetchTokens';
import { swapTransaction, waitForConfirmation } from '../utils/transaction';
import { Connection, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createTransferInstruction } from '@solana/spl-token';
import { USDC_MINT } from '@/config/tokens';
import { useWallet } from "@solana/wallet-adapter-react";
import toast from 'react-hot-toast';
import { ENV } from '../config/env';
import dynamic from 'next/dynamic';

// Simplify the WalletComponents to just render children when connected
const WalletComponents = dynamic(
  async () => {
    const { useWallet } = await import('@solana/wallet-adapter-react');
    
    return function WalletWrapper(props: { 
      children: (publicKey: string | null) => React.ReactNode 
    }) {
      const { publicKey, connected } = useWallet();
      
      if (!connected || !publicKey) {
        return (
          <div className="flex flex-col items-center gap-4 p-6 bg-base-200 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold">Wallet Required</h2>
            <p className="text-center text-base-content/70 mb-4">
              Please connect your wallet using the button in the header to continue.
            </p>
          </div>
        );
      }
      
      // Only render children if connected
      return <>{props.children(publicKey.toString())}</>;
    };
  },
  { ssr: false }
);

const sendUSDC = async (publicKey: PublicKey, sendTransaction: any, receiver: string, amount: number) => {
  const connection = new Connection(ENV.SOLANA_RPC_URL, 'confirmed');
  if (!publicKey) throw new Error('Wallet not connected');
  try {
    const senderPublicKey = publicKey;
    const receiverPublicKey = new PublicKey(receiver);
    const mintPublicKey = new PublicKey(USDC_MINT);

    // Get the sender's associated token account
    const senderTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      senderPublicKey,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Get the receiver's associated token account
    const receiverTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      receiverPublicKey,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Check if the receiver's token account exists, if not, create it
    const receiverAccountInfo = await connection.getAccountInfo(receiverTokenAccount);
    const transaction = new Transaction();
    if (!receiverAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          senderPublicKey, // Payer
          receiverTokenAccount, // Associated Token Account
          receiverPublicKey, // Owner
          mintPublicKey // Mint
        )
      );
    }

    // Transfer tokens
    transaction.add(
      createTransferInstruction(
        senderTokenAccount,
        receiverTokenAccount,
        senderPublicKey,
        amount * Math.pow(10, 6),
        [],
        TOKEN_PROGRAM_ID // Adjust for token decimals
      )
    );

    // Send transaction
    const signature = await sendTransaction(transaction, connection);
    await waitForConfirmation(connection, signature);
    return signature;
  } catch (error) {
    console.error('Error sending SPL token:', error);
    throw error;
  }
};

// Helper function to get token names for common tokens
function getTokenName(tokenAddress: string): string {
  const tokenMap: Record<string, string> = {
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
    'So11111111111111111111111111111111111111112': 'SOL',
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
    // Add more token mappings as needed
  };
  
  return tokenMap[tokenAddress] || tokenAddress.substring(0, 6) + '...';
}

export function UnifiedPaymentComponent() {
  // Address and amount states
  const [address, setAddress] = useState('');
  const [addressError, setAddressError] = useState('');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  
  // Token selection states
  const [tokens, setTokens] = useState<string[]>([]);
  const [selectedToken, setSelectedToken] = useState('');
  const [tokenAmount, setTokenAmount] = useState(0);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [loadingRate, setLoadingRate] = useState(false);
  
  // Transaction states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState('');
  
  // Current active step (1 = address/amount, 2 = token selection, 3 = confirmation)
  const [activeStep, setActiveStep] = useState(1);
  
  const { publicKey, sendTransaction, signTransaction } = useWallet();

  // Add new state for balance checking
  const [balanceData, setBalanceData] = useState<{
    hasEnough: boolean;
    balance: number;
    shortfall: number;
  } | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);

  // Validate address input
  const validateAddress = (value: string) => {
    try {
      if (!value) {
        setAddressError('Address is required');
        return false;
      }
      new PublicKey(value);
      setAddressError('');
      return true;
    } catch (error) {
      setAddressError('Invalid Solana address');
      return false;
    }
  };

  // Validate amount input
  const validateAmount = (value: string) => {
    const numValue = parseFloat(value);
    if (!value) {
      setAmountError('Amount is required');
      return false;
    }
    if (isNaN(numValue) || numValue <= 0) {
      setAmountError('Amount must be greater than 0');
      return false;
    }
    setAmountError('');
    return true;
  };

  // Load tokens when wallet is connected
  useEffect(() => {
    if (activeStep >= 2 && publicKey) {
      const loadTokens = async () => {
        const walletAddress = publicKey.toString();
        setLoadingTokens(true);
        setError(null);
        
        try {
          let fetchedTokens = await fetchTokens(walletAddress);
          
          if (fetchedTokens.length === 0) {
            toast.success('No tokens found in wallet.');
          }
          
          setTokens(fetchedTokens);
        } catch (err: any) {
          console.error('Error loading tokens:', err);
          setError(`Failed to load tokens: ${err.message}`);
          toast.error(`Error loading tokens: ${err.message}`);
        } finally {
          setLoadingTokens(false);
        }
      };
      
      loadTokens();
    }
  }, [activeStep, publicKey]);

  // Get swap rate when token is selected
  useEffect(() => {
    if (selectedToken && amount) {
      const getSwapRate = async () => {
        setLoadingRate(true);
        setError(null);
        
        try {
          const numAmount = parseFloat(amount);
          const rate = await fetchSwapRate(selectedToken, numAmount);
          setTokenAmount(rate);
        } catch (err: any) {
          console.error('Error fetching swap rate:', err);
          setError(`Failed to fetch swap rate: ${err.message}`);
          toast.error(`Swap rate error: ${err.message}`);
          // Use a mock rate as fallback
          setTokenAmount(parseFloat(amount) * 0.95); // Mock exchange rate
        } finally {
          setLoadingRate(false);
        }
      };
      
      getSwapRate();
    }
  }, [selectedToken, amount]);

  // Handle form submission for first step
  const handleFirstStepSubmit = () => {
    const isAddressValid = validateAddress(address);
    const isAmountValid = validateAmount(amount);

    if (isAddressValid && isAmountValid) {
      setActiveStep(2);
    }
  };

  // Handle token selection
  const handleTokenSelect = (token: string) => {
    setSelectedToken(token);
    // After selecting token, show confirmation step
    setActiveStep(3);
  };

  // Handle transaction sending
  const handleSend = async () => {
    setLoading(true);
    setError(null);
    let transactionSignature = '';
    
    try {
      if(!publicKey || !window.solana){
        toast.error('Wallet not connected');
        return;
      }
      
      if(selectedToken === USDC_MINT){
        transactionSignature = await sendUSDC(
          publicKey, 
          sendTransaction, 
          address, 
          parseFloat(amount)
        );
      } else {
        if(signTransaction){
          transactionSignature = await swapTransaction(
            publicKey, 
            signTransaction, 
            address, 
            selectedToken, 
            tokenAmount
          );
        } else {
          toast.error('Transaction signing function is not available');
          return;
        }
      }
      
      if(transactionSignature){
        setSignature(transactionSignature);
        toast.success('Transaction successful!');
        // Reset form after successful transaction
        setActiveStep(1);
        setAddress('');
        setAmount('');
        setSelectedToken('');
      } else {
        toast.error('Transaction failed!');
      }
    } catch (error: any) {
      console.error('Transaction error:', error);
      setError(error.message || 'Transaction failed');
      toast.error(`Transaction failed: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle dismissing error
  const handleDismissError = () => {
    setError(null);
  };

  // Go back to previous step
  const goBack = () => {
    setActiveStep(prev => Math.max(prev - 1, 1));
  };

  // Add function to check token balance
  const checkWalletBalance = async () => {
    if (!publicKey || !selectedToken || tokenAmount <= 0) return;
    
    setCheckingBalance(true);
    try {
      const result = await checkTokenBalance(
        publicKey.toString(),
        selectedToken,
        tokenAmount
      );
      setBalanceData(result);
    } catch (error) {
      console.error('Error checking balance:', error);
      setError('Failed to check your token balance');
    } finally {
      setCheckingBalance(false);
    }
  };
  
  // Check balance when entering confirmation step
  useEffect(() => {
    if (activeStep === 3) {
      checkWalletBalance();
    }
  }, [activeStep, selectedToken, tokenAmount]);
  
  // Reset balance data when changing tokens
  useEffect(() => {
    setBalanceData(null);
  }, [selectedToken]);

  return (
    <WalletComponents>
      {(walletAddress) => (
        <div className="bg-base-200 rounded-lg shadow-lg p-8 w-full">
          {error && (
            <div className="alert alert-error mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{error}</span>
              <button className="btn btn-sm" onClick={handleDismissError}>Dismiss</button>
            </div>
          )}
          
          {loading && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-base-100 p-4 rounded-lg flex flex-col items-center">
                <span className="loading loading-spinner loading-lg mb-2"></span>
                <p>Processing transaction...</p>
              </div>
            </div>
          )}
          
          {/* Progress Indicator */}
          <div className="mb-6">
            <ul className="steps steps-horizontal w-full">
              <li className={`step ${activeStep >= 1 ? 'step-primary' : ''}`}>Payment Details</li>
              <li className={`step ${activeStep >= 2 ? 'step-primary' : ''}`}>Token Selection</li>
              <li className={`step ${activeStep >= 3 ? 'step-primary' : ''}`}>Confirmation</li>
            </ul>
          </div>
          
          {/* Step 1: Payment Details */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Enter Payment Details</h2>
              <div className="form-control">
                <input
                  type="text"
                  placeholder="Receiver Address"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    validateAddress(e.target.value);
                  }}
                  className={`input input-bordered w-full ${addressError ? 'input-error' : ''}`}
                />
                {addressError && <label className="label text-error">{addressError}</label>}
              </div>
              <div className="form-control">
                <input
                  type="number"
                  placeholder="Amount in USDC"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    validateAmount(e.target.value);
                  }}
                  className={`input input-bordered w-full ${amountError ? 'input-error' : ''}`}
                />
                {amountError && <label className="label text-error">{amountError}</label>}
              </div>
              <button 
                className="btn btn-primary w-full" 
                onClick={handleFirstStepSubmit}
                disabled={!!addressError || !!amountError || !address || !amount}
              >
                Next
              </button>
            </div>
          )}
          
          {/* Step 2: Token Selection */}
          {activeStep === 2 && (
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-bold">Select Token to Send</h2>
              </div>
              
              {loadingTokens ? (
                <div className="flex flex-col items-center p-6">
                  <span className="loading loading-spinner loading-lg"></span>
                  <p className="mt-4">Loading tokens from wallet...</p>
                </div>
              ) : tokens.length === 0 ? (
                <div className="alert alert-warning">
                  <p>No tokens found. Please add some SPL tokens to your wallet.</p>
                </div>
              ) : (
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">Choose token from your wallet</span>
                  </label>
                  <select 
                    className="select select-bordered w-full" 
                    value={selectedToken}
                    onChange={(e) => setSelectedToken(e.target.value)}
                    disabled={loadingRate}
                  >
                    <option value="" disabled>Select a token</option>
                    {tokens.map((token) => {
                      // Format token address for display
                      const shortToken = token.substring(0, 6) + '...' + token.substring(token.length - 4);
                      return (
                        <option key={token} value={token}>
                          {getTokenName(token)} ({shortToken})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
              
              {selectedToken && (
                <div className="mt-6 p-4 bg-base-300 rounded-lg">
                  <h3 className="font-semibold mb-2">Swap Details</h3>
                  
                  {loadingRate ? (
                    <div className="flex items-center">
                      <span className="loading loading-spinner loading-sm mr-2"></span>
                      <span>Calculating rate...</span>
                    </div>
                  ) : (
                    <>
                      <p className="mb-2">
                        You'll need <span className="font-bold">{tokenAmount.toFixed(6)}</span> of {getTokenName(selectedToken)}
                      </p>
                      <p className="text-sm opacity-70 mb-4">
                        Exchange rate: 1 USDC ≈ {(tokenAmount / parseFloat(amount)).toFixed(6)} {getTokenName(selectedToken)}
                      </p>
                    </>
                  )}
                </div>
              )}
              
              <div className="flex justify-between mt-6">
                <button className="btn btn-outline" onClick={goBack}>
                  Back
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleTokenSelect(selectedToken)}
                  disabled={!selectedToken || tokenAmount <= 0 || loadingRate}
                >
                  Continue
                </button>
              </div>
            </div>
          )}
          
          {/* Step 3: Confirmation - modified to include balance check */}
          {activeStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Confirm & Send</h2>
              
              <div className="bg-base-300 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-base-content/70">Receiver Address:</span>
                  <span className="font-medium">{address.substring(0, 8)}...{address.substring(address.length - 8)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-base-content/70">Token:</span>
                  <span className="font-medium">{getTokenName(selectedToken)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-base-content/70">Amount to Send:</span>
                  <span className="font-medium">{tokenAmount.toFixed(6)} {getTokenName(selectedToken)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-base-content/70">USDC Equivalent:</span>
                  <span className="font-medium">{amount} USDC</span>
                </div>
                
                {checkingBalance && (
                  <div className="flex items-center justify-center py-2">
                    <span className="loading loading-spinner loading-sm mr-2"></span>
                    <span>Checking your balance...</span>
                  </div>
                )}
                
                {balanceData && !balanceData.hasEnough && (
                  <div className="alert alert-warning mt-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <div>
                      <p className="font-semibold">Low balance</p>
                      <p className="text-sm">
                        You need at least {balanceData.shortfall.toFixed(6)} more {getTokenName(selectedToken)} to complete this transaction.
                      </p>
                      <p className="text-sm mt-1">
                        Current balance: {balanceData.balance.toFixed(6)} {getTokenName(selectedToken)}
                      </p>
                    </div>
                  </div>
                )}
                
                {balanceData && balanceData.hasEnough && (
                  <div className="alert alert-success mt-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div>
                      <p>You have sufficient balance!</p>
                      <p className="text-sm">
                        Balance: {balanceData.balance.toFixed(6)} {getTokenName(selectedToken)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {balanceData && !balanceData.hasEnough && (
                <button 
                  className="btn btn-outline w-full" 
                  onClick={checkWalletBalance}
                >
                  Refresh Balance
                </button>
              )}
              
              <div className="flex justify-between mt-6">
                <button className="btn btn-outline" onClick={goBack}>
                  Back
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSend}
                  disabled={
                    checkingBalance || 
                    (balanceData !== null && !balanceData.hasEnough)
                  }
                >
                  {checkingBalance 
                    ? <span className="loading loading-spinner loading-sm"></span> 
                    : (balanceData && !balanceData.hasEnough)
                      ? "Insufficient Balance" 
                      : "Send Transaction"
                  }
                </button>
              </div>
            </div>
          )}
          
          {signature && (
            <div className="mt-4 alert alert-success">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div>
                <p className="font-semibold">Transaction successful!</p>
                <p>
                  View it on <a
                    href={`https://solscan.io/tx/${signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                  >
                    Solscan
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </WalletComponents>
  );
}