import React, { useState } from 'react';
import { PublicKey } from '@solana/web3.js';

export function PaymentForm({ onNext }: { onNext: (address: string, amount: number) => void }) {
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [addressError, setAddressError] = useState('');
  const [amountError, setAmountError] = useState('');

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

  const handleSubmit = () => {
    const isAddressValid = validateAddress(address);
    const isAmountValid = validateAmount(amount);

    if (isAddressValid && isAmountValid) {
      onNext(address, parseFloat(amount));
    }
  };

  return (
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
        onClick={handleSubmit}
        disabled={!!addressError || !!amountError || !address || !amount}
      >
        Next
      </button>
    </div>
  );
}