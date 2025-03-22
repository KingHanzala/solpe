'use client'

import { WalletError } from '@solana/wallet-adapter-base'
import { WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { 
  PhantomWalletAdapter, 
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  TorusWalletAdapter
} from '@solana/wallet-adapter-wallets'
import { ReactNode, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ellipsify } from "../ui/ui-layout";

require('@solana/wallet-adapter-react-ui/styles.css')

export function WalletButton() {
  const { connected, publicKey, disconnect } = useWallet();

  const handleDisconnect = () => {
    console.log("Disconnect clicked"); // Debugging log
    try {
      disconnect();
      console.log("Disconnect function called");
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    }
  };
  
  if (connected && publicKey) {
    return (
      <div className="flex items-center space-x-2">
        <div className="px-3 py-1 bg-base-300 rounded text-sm">
          {ellipsify(publicKey.toString())}
        </div>
        <button 
          onClick={handleDisconnect}
          className="btn btn-sm btn-error"
        >
          Disconnect
        </button>
      </div>
    );
  }
  
  return <WalletMultiButton className="btn btn-outline" />;
}

export function WalletConnectionStatus() {
  const { publicKey } = useWallet();
  
  if (!publicKey) return null;
  
  return (
    <div className="text-xs opacity-50 mb-2">
      Connected: {ellipsify(publicKey.toString())}
    </div>
  );
}

export function SolanaProvider({ children }: { children: ReactNode }) {
  
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new TorusWalletAdapter(),
    ],
    []
  )

  const onError = useCallback((error: WalletError) => {
    console.error('Wallet error:', error)
    
    if (error.name === 'WalletNotFoundError') {
      toast.error(`Wallet not installed. Please install ${error.wallet?.adapter.name} extension and try again.`)
    } else if (error.name === 'WalletConnectionError') {
      toast.error(`Failed to connect to ${error.wallet?.adapter.name}. Please try again or use a different wallet.`)
    } else if (error.name === 'WalletDisconnectedError') {
      toast.error(`Wallet disconnected. Please reconnect to continue.`)
    } else if (error.name === 'WalletAccountError') {
      toast.error(`Wallet account error. Please check your wallet and try again.`)
    } else if (error.name === 'WalletPublicKeyError') {
      toast.error(`Failed to get public key from wallet. Please check your wallet and try again.`)
    } else if (error.name === 'WalletSignTransactionError') {
      toast.error(`Failed to sign transaction. Please try again.`)
    } else if (error.name === 'WalletSendTransactionError') {
      toast.error(`Failed to send transaction. Please try again.`)
    } else if (error.name === 'WalletTimeoutError') {
      toast.error(`Wallet connection timed out. Please try again.`)
    } else {
      toast.error(`Wallet error: ${error.message}`)
    }
  }, [])

  return (
      <WalletProvider wallets={wallets} onError={onError} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
  )
}

export default SolanaProvider;