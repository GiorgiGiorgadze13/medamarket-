import { useState, useMemo, useCallback } from 'react'
import { CartItem, Product } from '../types'
import toast from 'react-hot-toast'

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
        const newQty = currentQty + quantity

        if (newQty > product.stock) {
          toast.error(`მარაგში დარჩენილია მხოლოდ ${product.stock} ცალი!`)
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
          toast.error(`მარაგში დარჩენილია მხოლოდ ${product.stock} ცალი!`)
          success = false
          return prevCart
        }

        return [...prevCart, { product, quantity }]
      }
    })

    return success
  }, [])

  const updateQuantity = useCallback((productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId)
      return
    }

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          if (newQuantity > item.product.stock) {
            toast.error(`მაქსიმალური ხელმისაწვდომი მარაგი: ${item.product.stock}`)
            return { ...item, quantity: item.product.stock }
          }
          return { ...item, quantity: newQuantity }
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

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = Number(item.product.sellingPrice) || 0
      return sum + price * item.quantity
    }, 0)
  }, [cart])

  const total = useMemo(() => {
    const rawTotal = subtotal - (Number(discount) || 0)
    return Math.max(0, Math.round(rawTotal * 100) / 100)
  }, [subtotal, discount])

  const totalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0)
  }, [cart])

  return {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    discount,
    setDiscount,
    subtotal: Math.round(subtotal * 100) / 100,
    total,
    totalItems,
  }
}

