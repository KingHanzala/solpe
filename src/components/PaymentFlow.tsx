'use client'

import React, { useState, useEffect } from 'react';
import { PaymentForm } from './PaymentForm';
import { SelectToken } from './SelectToken';
import { ConfirmSend } from './ConfirmSend';
import { sendTransaction } from '../utils/transaction';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { useWallet } from "@solana/wallet-adapter-react";

// Use dynamic import for wallet components to avoid SSR issues
const WalletComponents = dynamic(
  async () => {
    const { useWallet } = await import('@solana/wallet-adapter-react');
    const { WalletButton, WalletConnectionStatus } = await import('./solana/solana-provider');
    
    return function WalletWrapper(props: { 
      children: (publicKey: string | null) => React.ReactNode 
    }) {
      const { publicKey, connected, connecting } = useWallet();
      
      return (
        <>
          {/* First show connection status if connected */}
          {connected && publicKey && <WalletConnectionStatus />}
          
          {/* If not connected, show connect button */}
          {!connected && (
            <div className="flex flex-col items-center gap-4 p-6 bg-base-200 rounded-lg shadow-lg">
              <h2 className="text-2xl font-bold">Connect Your Wallet</h2>
              <p className="text-center text-base-content/70 mb-4">
                To use Solpe, you need to connect your Solana wallet first.
              </p>
              {connecting ? (
                <div className="flex items-center">
                  <span className="loading loading-spinner loading-md mr-2"></span>
                  <span>Connecting...</span>
                </div>
              ) : (
                <WalletButton />
              )}
            </div>
          )}
          
          {/* Children will only render if connected */}
          {connected && publicKey && props.children(publicKey.toString())}
        </>
      );
    };
  },
  { ssr: false }
);

export function PaymentFlow() {
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState('');
  const [usdcAmount, setUsdcAmount] = useState(0);
  const [token, setToken] = useState('');
  const [tokenAmount, setTokenAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { publicKey, signTransaction} = useWallet();

  const handleNext = (address: string, amount: number) => {
    setAddress(address);
    setUsdcAmount(amount);
    setStep(2);
  };

  const handleTokenSelect = (token: string, amount: number) => {
    setToken(token);
    setTokenAmount(amount);
    setStep(3);
  };

  const handleSend = async () => {
    setLoading(true);
    setError(null);
    try {
      if(!publicKey || !window.solana){
        toast.error('Wallet not connected')
      }
      else{
        if(signTransaction){
          await sendTransaction(publicKey, signTransaction, address, token, tokenAmount);
          toast.success('Transaction successful!');
          setStep(1);
        } else {
          toast.error('Transaction signing function is not available');
        }
      }
    } catch (error: any) {
      console.error('Transaction error:', error);
      setError(error.message || 'Transaction failed');
      toast.error(`Transaction failed: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleError = () => {
    if (error) {
      setError(null);
    }
  };

  return (
    <WalletComponents>
      {(walletAddress) => (
        <div>
          {error && (
            <div className="alert alert-error mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{error}</span>
              <button className="btn btn-sm" onClick={handleError}>Dismiss</button>
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
          
          {step === 1 && <PaymentForm onNext={handleNext} />}
          {step === 2 && <SelectToken address={address} amount={usdcAmount} onTokenSelect={handleTokenSelect} walletAddress={walletAddress} />}
          {step === 3 && <ConfirmSend address={address} token={token} tokenAmount={tokenAmount} usdcAmount={usdcAmount} onSend={handleSend} />}
        </div>
      )}
    </WalletComponents>
  );
}