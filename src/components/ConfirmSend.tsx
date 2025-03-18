import React from 'react';
import { PublicKey } from '@solana/web3.js';

export function ConfirmSend({ address, token, tokenAmount, usdcAmount, onSend }: { address: string, token: string, tokenAmount: number, usdcAmount: number, onSend: () => void }) {
  return (
    <div>
      <h2>Confirm & Send</h2>
      <p>Receiver Address: {address}</p>
      <p>SPL Token Selected: {token}</p>
      <p>Amount of {token} Needed: {tokenAmount}</p>
      <p>Expected USDC at Receiver’s End: {usdcAmount}</p>
      <button className="btn btn-primary" onClick={onSend}>
        Send
      </button>
    </div>
  );
}