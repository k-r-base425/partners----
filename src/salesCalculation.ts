export const salesChannels = [
  { id: 'mercari', label: 'メルカリ', feeRate: 0.1 },
  { id: 'yahoo-fleamarket', label: 'ヤフーフリマ', feeRate: 0.1 },
] as const

export const productTypes = [
  { id: 'short-sleeve-band-t', label: '半袖バンドT', minimumCharge: 3000 },
  { id: 'long-sleeve-band-t', label: '長袖バンドT', minimumCharge: 3800 },
] as const

export type SalesChannelId = (typeof salesChannels)[number]['id']
export type ProductTypeId = (typeof productTypes)[number]['id']

export type SalesCalculationInput = {
  salesChannel: SalesChannelId
  productType: ProductTypeId
  salePrice: number
  shippingFee: number
}

export type SalesCalculationResult = {
  salePrice: number
  feeRate: number
  salesFee: number
  priceAfterFee: number
  baseCharge: number
  minimumCharge: number
  chargeBase: number
  preliminaryProfit: number
  additionalCharge: number
  finalCharge: number
  sellerProfit: number
  profitRate: number
  isMinimumChargeApplied: boolean
}

const findSalesChannel = (id: SalesChannelId) =>
  salesChannels.find((channel) => channel.id === id) ?? salesChannels[0]

const findProductType = (id: ProductTypeId) =>
  productTypes.find((productType) => productType.id === id) ?? productTypes[0]

const toYen = (value: number) => Math.round(value)

export function calculateSalesResult({
  salesChannel,
  productType,
  salePrice,
  shippingFee,
}: SalesCalculationInput): SalesCalculationResult {
  const normalizedSalePrice = Math.max(0, toYen(salePrice))
  const normalizedShippingFee = Math.max(0, toYen(shippingFee))
  const channel = findSalesChannel(salesChannel)
  const selectedProductType = findProductType(productType)

  if (normalizedSalePrice <= 0) {
    return {
      salePrice: 0,
      feeRate: channel.feeRate,
      salesFee: 0,
      priceAfterFee: 0,
      baseCharge: 0,
      minimumCharge: 0,
      chargeBase: 0,
      preliminaryProfit: 0,
      additionalCharge: 0,
      finalCharge: 0,
      sellerProfit: 0,
      profitRate: 0,
      isMinimumChargeApplied: false,
    }
  }

  const salesFee = toYen(normalizedSalePrice * channel.feeRate)
  const priceAfterFee = normalizedSalePrice - salesFee
  const baseCharge = priceAfterFee * 0.5
  const minimumCharge = selectedProductType.minimumCharge
  const isMinimumChargeApplied = minimumCharge > baseCharge
  const chargeBase = Math.max(baseCharge, minimumCharge)
  const preliminaryProfit = priceAfterFee - chargeBase - normalizedShippingFee
  const additionalCharge = Math.ceil(preliminaryProfit * 0.1)
  const finalCharge = chargeBase + additionalCharge
  const sellerProfit = priceAfterFee - finalCharge - normalizedShippingFee
  const profitRate = priceAfterFee > 0 ? (sellerProfit / priceAfterFee) * 100 : 0

  return {
    salePrice: normalizedSalePrice,
    feeRate: channel.feeRate,
    salesFee,
    priceAfterFee,
    baseCharge,
    minimumCharge,
    chargeBase,
    preliminaryProfit,
    additionalCharge,
    finalCharge,
    sellerProfit,
    profitRate,
    isMinimumChargeApplied,
  }
}
