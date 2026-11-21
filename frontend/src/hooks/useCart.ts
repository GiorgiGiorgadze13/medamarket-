import { useState, useMemo, useCallback, useEffect } from 'react'
import { CartItem, Product } from '../types'
import toast from 'react-hot-toast'

const CART_STORAGE_KEY = 'medamarket_pos_cart_v1'
const DISCOUNT_STORAGE_KEY = 'medamarket_pos_discount_v1'

export function getItemEffectivePrice(product: Product, discountPercent?: number): number {
  if (!product) return 0
  const rawPrice =
    product.sellingPrice !== undefined && product.sellingPrice !== null
      ? product.sellingPrice
      : (product as any)?.price
  const base = Number(rawPrice) || 0
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
    return parsed
      .filter((item): item is CartItem => {
        return (
          item &&
          item.product &&
          typeof item.product.id === 'string' &&
          typeof item.product.name === 'string' &&
          typeof item.quantity === 'number' &&
          item.quantity > 0
        )
      })
      .map((item) => ({
        ...item,
        product: {
          ...item.product,
          sellingPrice: Number(item.product.sellingPrice ?? (item.product as any).price ?? 0),
          stock: Number(item.product.stock ?? 0),
          isWeighted: Boolean(item.product.isWeighted),
        },
      }))
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

  // Synchronize cart with real-time product updates (stock, price, name, etc.)
  const syncCartWithProducts = useCallback((latestProducts: Product[]) => {
    if (!Array.isArray(latestProducts) || latestProducts.length === 0) return

    setCart((prevCart) => {
      if (prevCart.length === 0) return prevCart

      let changed = false
      const updated = prevCart.map((item) => {
        const fresh = latestProducts.find((p) => p.id === item.product.id)
        if (!fresh) return item

        const freshPrice = Number(fresh.sellingPrice ?? (fresh as any).price ?? 0)
        const freshStock = Number(fresh.stock ?? 0)
        const itemPrice = Number(item.product.sellingPrice ?? (item.product as any).price ?? 0)
        const itemStock = Number(item.product.stock ?? 0)

        if (
          itemStock !== freshStock ||
          itemPrice !== freshPrice ||
          item.product.name !== fresh.name ||
          item.product.isActive !== fresh.isActive ||
          item.product.barcode !== fresh.barcode ||
          Boolean(item.product.isWeighted) !== Boolean(fresh.isWeighted)
        ) {
          changed = true
          return {
            ...item,
            product: {
              ...fresh,
              sellingPrice: freshPrice,
              stock: freshStock,
              isWeighted: Boolean(fresh.isWeighted),
            },
          }
        }
        return item
      })

      return changed ? updated : prevCart
    })
  }, [])

  // Listen to product update events across windows/pages
  useEffect(() => {
    const handleProductUpdate = (e: Event) => {
      const customEvt = e as CustomEvent<Product>
      if (customEvt.detail && customEvt.detail.id) {
        const fresh = customEvt.detail
        setCart((prevCart) =>
          prevCart.map((item) =>
            item.product.id === fresh.id
              ? { ...item, product: { ...fresh } }
              : item
          )
        )
      }
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          if (Array.isArray(parsed)) {
            setCart(parsed)
          }
        } catch {
          // ignore
        }
      }
    }

    window.addEventListener('medamarket:product-updated', handleProductUpdate)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('medamarket:product-updated', handleProductUpdate)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

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
    const stock = Number(product.stock) || 0
    if (stock <= 0) {
      toast.error(`"${product.name}" მარაგში აღარ არის!`)
      return false
    }

    const isWeighted = Boolean(product.isWeighted)
    const normalizedQty = isWeighted ? quantity : Math.max(1, Math.round(quantity))

    const safeProduct: Product = {
      ...product,
      sellingPrice: Number(product.sellingPrice ?? (product as any).price ?? 0),
      stock,
      isWeighted,
    }

    let canAdd = true

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === safeProduct.id)

      if (existingIndex > -1) {
        const currentQty = prevCart[existingIndex].quantity
        const newQty = isWeighted
          ? Math.round((currentQty + normalizedQty) * 1000) / 1000
          : Math.round(currentQty + normalizedQty)

        if (newQty > stock) {
          toast.error(`მარაგში დარჩენილია მხოლოდ ${stock}!`)
          canAdd = false
          return prevCart
        }

        const updated = [...prevCart]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          product: safeProduct, // Keep latest product snapshot with fresh stock and price
        }
        return updated
      } else {
        if (normalizedQty > stock) {
          toast.error(`მარაგში დარჩენილია მხოლოდ ${stock}!`)
          canAdd = false
          return prevCart
        }

        return [
          ...prevCart,
          {
            product: safeProduct,
            quantity: isWeighted ? Math.round(normalizedQty * 1000) / 1000 : Math.round(normalizedQty),
          },
        ]
      }
    })

    return canAdd
  }, [])

  const updateQuantity = useCallback(
    (productId: string, newQuantity: number, maxStockOverride?: number) => {
      if (newQuantity <= 0) {
        setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId))
        return
      }

      setCart((prevCart) =>
        prevCart.map((item) => {
          if (item.product.id === productId) {
            const isWeighted = Boolean(item.product.isWeighted)
            const targetQty = isWeighted
              ? Math.round(newQuantity * 1000) / 1000
              : Math.max(1, Math.round(newQuantity))

            const effectiveMax =
              typeof maxStockOverride === 'number' && maxStockOverride >= 0
                ? maxStockOverride
                : item.product.stock

            if (targetQty > effectiveMax) {
              toast.error(`მაქსიმალური ხელმისაწვდომი მარაგი: ${effectiveMax}`)
              return {
                ...item,
                quantity: effectiveMax,
                product: {
                  ...item.product,
                  stock: effectiveMax,
                },
              }
            }
            return {
              ...item,
              quantity: targetQty,
              product:
                typeof maxStockOverride === 'number' && maxStockOverride >= 0
                  ? { ...item.product, stock: maxStockOverride }
                  : item.product,
            }
          }
          return item
        })
      )
    },
    []
  )

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
      const rawPrice =
        item.product?.sellingPrice !== undefined && item.product?.sellingPrice !== null
          ? item.product.sellingPrice
          : (item.product as any)?.price
      const price = Number(rawPrice) || 0
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
    syncCartWithProducts,
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
