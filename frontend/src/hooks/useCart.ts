import { useState, useMemo, useCallback } from 'react'
import { CartItem, Product } from '../types'
import toast from 'react-hot-toast'

export function getItemEffectivePrice(product: Product, discountPercent?: number): number {
  const base = Number(product.sellingPrice) || 0
  const pct = Number(discountPercent) || 0
  if (pct <= 0) return base
  const discounted = base * (1 - pct / 100)
  return Math.max(0, Math.round(discounted * 100) / 100)
}

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [discount, setDiscount] = useState<number>(0)

  const addToCart = useCallback((product: Product, quantity: number = 1): boolean => {
    if (product.stock <= 0) {
      toast.error(`"${product.name}" მარაგში აღარ არის!`)
      return false
    }

    let success = true

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id)

      if (existingIndex > -1) {
        const currentQty = prevCart[existingIndex].quantity
        const newQty = Math.round((currentQty + quantity) * 1000) / 1000

        if (newQty > product.stock) {
          toast.error(`მარაგში დარჩენილია მხოლოდ ${product.stock}!`)
          success = false
          return prevCart
        }

        const updated = [...prevCart]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
        }
        return updated
      } else {
        if (quantity > product.stock) {
          toast.error(`მარაგში დარჩენილია მხოლოდ ${product.stock}!`)
          success = false
          return prevCart
        }

        return [...prevCart, { product, quantity: Math.round(quantity * 1000) / 1000 }]
      }
    })

    return success
  }, [])

  const updateQuantity = useCallback((productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId))
      return
    }

    const rounded = Math.round(newQuantity * 1000) / 1000

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          if (rounded > item.product.stock) {
            toast.error(`მაქსიმალური ხელმისაწვდომი მარაგი: ${item.product.stock}`)
            return { ...item, quantity: item.product.stock }
          }
          return { ...item, quantity: rounded }
        }
        return item
      })
    )
  }, [])

  const setItemDiscount = useCallback((productId: string, discountPercent: number) => {
    const validPct = Math.min(100, Math.max(0, Math.round(discountPercent)))
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          return { ...item, discountPercent: validPct > 0 ? validPct : undefined }
        }
        return item
      })
    )
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    setDiscount(0)
  }, [])

  // Original subtotal before any discounts
  const originalSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = Number(item.product.sellingPrice) || 0
      return sum + Math.round(price * item.quantity * 100) / 100
    }, 0)
  }, [cart])

  // Subtotal after per-item discounts
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const effectivePrice = getItemEffectivePrice(item.product, item.discountPercent)
      return sum + Math.round(effectivePrice * item.quantity * 100) / 100
    }, 0)
  }, [cart])

  // Total saved from per-item discounts
  const itemDiscountsTotal = useMemo(() => {
    return Math.max(0, Math.round((originalSubtotal - subtotal) * 100) / 100)
  }, [originalSubtotal, subtotal])

  // Total discount combined (item discounts + cart general discount)
  const totalDiscount = useMemo(() => {
    return Math.round((itemDiscountsTotal + (Number(discount) || 0)) * 100) / 100
  }, [itemDiscountsTotal, discount])

  // Grand total payable
  const total = useMemo(() => {
    const rawTotal = subtotal - (Number(discount) || 0)
    return Math.max(0, Math.round(rawTotal * 100) / 100)
  }, [subtotal, discount])

  const totalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + (Number.isInteger(item.quantity) ? item.quantity : 1), 0)
  }, [cart])

  return {
    cart,
    addToCart,
    updateQuantity,
    setItemDiscount,
    removeFromCart,
    clearCart,
    discount,
    setDiscount,
    originalSubtotal: Math.round(originalSubtotal * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    itemDiscountsTotal,
    totalDiscount,
    total,
    totalItems,
  }
}
