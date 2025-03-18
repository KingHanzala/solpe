'use client'

import { WalletError } from '@solana/wallet-adapter-base'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { 
  PhantomWalletAdapter, 
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  TorusWalletAdapter
} from '@solana/wallet-adapter-wallets'
import dynamic from 'next/dynamic'
import { ReactNode, useCallback, useMemo, useState, useEffect } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import toast from 'react-hot-toast'

require('@solana/wallet-adapter-react-ui/styles.css')

export const WalletButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
)

export const WalletConnectionStatus = dynamic(
  async () => {
    const { useWallet } = await import('@solana/wallet-adapter-react')
    
    return function WalletStatus() {
      const { publicKey, wallet, connecting, connected, disconnecting } = useWallet()
      const [copied, setCopied] = useState(false)
      
      useEffect(() => {
        if (copied) {
          const timer = setTimeout(() => setCopied(false), 2000)
          return () => clearTimeout(timer)
        }
      }, [copied])
      
      if (!wallet) {
        return null
      }
      
      const copyAddress = () => {
        if (publicKey) {
          navigator.clipboard.writeText(publicKey.toString())
          setCopied(true)
          toast.success('Address copied to clipboard')
        }
      }
      
      if (connecting) {
        return <div className="alert alert-info">Connecting to {wallet.adapter.name}...</div>
      }
      
      if (disconnecting) {
        return <div className="alert alert-warning">Disconnecting...</div>
      }
      
      if (connected && publicKey) {
        return (
          <div className="alert alert-success shadow-lg">
            <div>
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div>
                <span>Connected to {wallet.adapter.name}</span>
                <div className="text-xs mt-1 flex items-center">
                  <span className="truncate max-w-[150px]">{publicKey.toString()}</span>
                  <button 
                    onClick={copyAddress} 
                    className="ml-2 p-1 rounded hover:bg-base-300"
                    title="Copy address"
                  >
                    {copied ? '✓' : '📋'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
      
      return null
    }
  },
  { ssr: false }
)

export function SolanaProvider({ children }: { children: ReactNode }) {
  const { cluster } = useCluster()
  const endpoint = useMemo(() => cluster.endpoint, [cluster])
  
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
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} onError={onError} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

export default SolanaProvider;