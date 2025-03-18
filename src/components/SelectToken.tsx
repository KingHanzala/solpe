import React, { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { fetchSwapRate } from '../utils/transaction';
import { fetchTokens, getMockTokens } from '../utils/fetchTokens';
import toast from 'react-hot-toast';

export function SelectToken({ 
  address, 
  amount, 
  onTokenSelect,
  walletAddress
}: { 
  address: string, 
  amount: number, 
  onTokenSelect: (token: string, amount: number) => void,
  walletAddress: string | null
}) {
  const [tokens, setTokens] = useState<string[]>([]);
  const [selectedToken, setSelectedToken] = useState('');
  const [tokenAmount, setTokenAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [loadingRate, setLoadingRate] = useState(false);
  const [error, setError] = useState('');
  const [useTestnet, setUseTestnet] = useState(false);

  useEffect(() => {
    const loadTokens = async () => {
      if (!walletAddress) return;
      
      setLoadingTokens(true);
      setError('');
      
      try {
        let fetchedTokens: string[];
        
        if (useTestnet) {
          // Use mock data if in testnet mode
          fetchedTokens = getMockTokens();
          toast.success('Using demo tokens for testing');
        } else {
          // Try to fetch real tokens
          fetchedTokens = await fetchTokens(walletAddress);
        }
        
        if (fetchedTokens.length === 0) {
          toast.success('No tokens found in wallet. Showing demo tokens instead.');
          fetchedTokens = getMockTokens();
          setUseTestnet(true);
        }
        
        setTokens(fetchedTokens);
      } catch (err: any) {
        console.error('Error loading tokens:', err);
        setError(`Failed to load tokens: ${err.message}`);
        
        // Automatically switch to testnet mode if we encounter an RPC error
        toast.error(`Error loading tokens: ${err.message}`);
        toast.success('Switched to demo mode with test tokens');
        setTokens(getMockTokens());
        setUseTestnet(true);
      } finally {
        setLoadingTokens(false);
      }
    };
    
    loadTokens();
  }, [walletAddress, useTestnet]);

  useEffect(() => {
    const getSwapRate = async () => {
      if (!selectedToken) return;
      
      setLoadingRate(true);
      setError('');
      
      try {
        const rate = await fetchSwapRate(selectedToken, amount);
        setTokenAmount(rate);
      } catch (err: any) {
        console.error('Error fetching swap rate:', err);
        setError(`Failed to fetch swap rate: ${err.message}`);
        toast.error(`Swap rate error: ${err.message}`);
        // Use a mock rate as fallback
        setTokenAmount(amount * 0.95); // Mock exchange rate
      } finally {
        setLoadingRate(false);
      }
    };
    
    getSwapRate();
  }, [selectedToken, amount]);

  const toggleMode = () => {
    setUseTestnet(!useTestnet);
  };

  if (loadingTokens) {
    return (
      <div className="flex flex-col items-center p-6 bg-base-200 rounded-lg">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="mt-4">Loading tokens from wallet...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-base-200 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Select Token to Send</h2>
        <button 
          className="btn btn-xs btn-outline" 
          onClick={toggleMode}
        >
          {useTestnet ? 'Using Demo Tokens' : 'Using Real Tokens'}
        </button>
      </div>
      
      {error && (
        <div className="alert alert-error mb-4">
          <p>{error}</p>
          <button className="btn btn-sm" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}
      
      {tokens.length === 0 ? (
        <div className="alert alert-warning">
          <p>No tokens found. Please add some SPL tokens to your wallet or switch to demo mode.</p>
        </div>
      ) : (
        <>
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
                    Exchange rate: 1 USDC ≈ {(tokenAmount / amount).toFixed(6)} {getTokenName(selectedToken)}
                  </p>
                  <button 
                    className="btn btn-primary w-full" 
                    onClick={() => onTokenSelect(selectedToken, tokenAmount)}
                    disabled={tokenAmount <= 0}
                  >
                    Continue with {getTokenName(selectedToken)}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
      
      {useTestnet && (
        <div className="mt-4 text-sm opacity-70">
          <p>Demo mode is active. Using sample tokens for testing purposes.</p>
        </div>
      )}
    </div>
  );
}

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