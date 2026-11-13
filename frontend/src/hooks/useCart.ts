import { useState, useMemo, useCallback, useEffect } from 'react'
import { CartItem, Product } from '../types'
import toast from 'react-hot-toast'

const CART_STORAGE_KEY = 'medamarket_pos_cart_v1'
const DISCOUNT_STORAGE_KEY = 'medamarket_pos_discount_v1'

export function getItemEffectivePrice(product: Product, discountPercent?: number): number {
  const base = Number(product.sellingPrice) || 0
  const pct = Number(discountPercent) || 0
  if (pct <= 0) return base
  const discounted = base * (1 - pct / 100)
  return Math.max(0, Math.round(discounted * 100) / 100)
}

function loadInitialCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Sanitize and validate loaded cart items
    return parsed.filter((item): item is CartItem => {
      return (
        item &&
        item.product &&
        typeof item.product.id === 'string' &&
        typeof item.product.name === 'string' &&
        typeof item.quantity === 'number' &&
        item.quantity > 0
      )
    })
  } catch (err) {
    console.error('Failed to parse saved cart from localStorage:', err)
    return []
  }
}

function loadInitialDiscount(): number {
  try {
    const raw = localStorage.getItem(DISCOUNT_STORAGE_KEY)
    if (!raw) return 0
    const num = parseFloat(raw)
    return isNaN(num) || num < 0 ? 0 : num
  } catch {
    return 0
  }
}

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>(loadInitialCart)
  const [discount, setDiscountState] = useState<number>(loadInitialDiscount)

  // Synchronize cart changes to localStorage
  useEffect(() => {
    try {
      if (cart.length === 0) {
        localStorage.removeItem(CART_STORAGE_KEY)
      } else {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
      }
    } catch (err) {
      console.warn('Failed to persist cart to localStorage:', err)
    }
  }, [cart])

  // Synchronize discount changes to localStorage
  const setDiscount = useCallback((amount: number) => {
    setDiscountState(amount)
    try {
      if (amount <= 0) {
        localStorage.removeItem(DISCOUNT_STORAGE_KEY)
      } else {
        localStorage.setItem(DISCOUNT_STORAGE_KEY, String(amount))
      }
    } catch (err) {
      console.warn('Failed to persist discount to localStorage:', err)
    }
  }, [])

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

  // Explicitly clear cart (only upon confirmed server sale success)
  const clearCart = useCallback(() => {
    setCart([])
    setDiscountState(0)
    try {
      localStorage.removeItem(CART_STORAGE_KEY)
      localStorage.removeItem(DISCOUNT_STORAGE_KEY)
    } catch {
      // Ignored
    }
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
