'use client'

import { AppHero } from '../ui/ui-layout'
import { UnifiedPaymentComponent } from '../UnifiedPaymentComponent';

const links: { label: string; href: string }[] = [
  { label: 'Solana Docs', href: 'https://docs.solana.com/' },
  { label: 'Solana Faucet', href: 'https://faucet.solana.com/' },
  { label: 'Solana Cookbook', href: 'https://solanacookbook.com/' },
  { label: 'Solana Stack Overflow', href: 'https://solana.stackexchange.com/' },
  { label: 'Solana Developers GitHub', href: 'https://github.com/solana-developers/' },
]

export default function DashboardFeature() {
  return (
    <div className="flex flex-col h-full">
      <AppHero 
        title="Solpe" 
        subtitle={
          <p className="max-w-2xl mx-auto mb-2 py-2">
            Send USDC using any SPL token - quick, secure, and simple.
          </p>
        } 
      />
      <div className="max-w-3xl w-full mx-auto px-4 py-2 flex-grow flex items-start">
        <UnifiedPaymentComponent />
      </div>
    </div>
  )
}
