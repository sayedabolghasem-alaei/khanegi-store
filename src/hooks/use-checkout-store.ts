"use client";
// Checkout flow state shared between the cart page and checkout wizard.

import { create } from "zustand";

interface CheckoutState {
  couponCode: string | null;
  setCouponCode: (code: string | null) => void;
}

export const useCheckoutStore = create<CheckoutState>((set) => ({
  couponCode: null,
  setCouponCode: (code) => set({ couponCode: code }),
}));
