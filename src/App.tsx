import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  calculateSalesResult,
  productTypes,
  salesChannels,
  type ProductTypeId,
  type SalesChannelId,
} from './salesCalculation'
import './App.css'

type ScreenId =
  | 'dashboard'
  | 'simulation'
  | 'products'
  | 'billing'
  | 'sales'
  | 'resources'

type BottomNavItem = {
  id: Exclude<ScreenId, 'resources'>
  label: string
  icon: string
}

type ActionCard = {
  label: string
  description: string
  target: ScreenId
}

type ProductCategory = 'shortSleeve' | 'longSleeve'
type ProductStatus = '販売中' | '売却済み' | '請求待ち' | '請求済み' | '返却済み' | '保留'

type Product = {
  id: string
  code: string
  name: string
  category: ProductCategory
  startPrice: number
  targetPrice: number
  internalLowestPrice: number
  listingDate: string
  status: ProductStatus
  memo: string
  createdAt: string
  soldDate?: string
  marketplace?: SalesChannelId
  soldPrice?: number
  shippingFee?: number
  feeRate?: number
  platformFee?: number
  netSales?: number
  billingAmount?: number
  sellerProfit?: number
  profitRate?: number
  billedDate?: string
}

type PriceDropInfo =
  | {
      hasInternalLowestPrice: false
      guidance: string
    }
  | {
      hasInternalLowestPrice: true
      nextDiscountAmount: number
      nextDiscountPrice: number
      isRelistRecommended: boolean
      operationStatus: '再出品推奨' | '継続運用'
      returnPriceMessage: string
    }

type ProductFormState = Omit<
  Product,
  | 'id'
  | 'code'
  | 'createdAt'
  | 'startPrice'
  | 'targetPrice'
  | 'internalLowestPrice'
> & {
  startPrice: string
  targetPrice: string
  internalLowestPrice: string
}

type SaleFormState = {
  soldDate: string
  marketplace: SalesChannelId
  soldPrice: string
  shippingFee: string
  feeRate: string
}

type ExpandedSections = Record<
  string,
  {
    discount?: boolean
    sales?: boolean
    detail?: boolean
    actions?: boolean
  }
>

type StatusFilter = ProductStatus | 'すべて'
type CategoryFilter = ProductCategory | 'すべて'
type MarketplaceFilter = SalesChannelId | 'unsold' | 'すべて'
type ProductSortOption =
  | 'createdDesc'
  | 'createdAsc'
  | 'listingDateDesc'
  | 'listingDateAsc'
  | 'internalLowestPriceDesc'
  | 'internalLowestPriceAsc'
  | 'targetPriceDesc'
  | 'targetPriceAsc'
  | 'soldDateDesc'
  | 'soldDateAsc'
type BillingStatusFilter = 'すべて' | '請求待ち' | '請求済み'
type MonthFilter = string | 'すべて'
type RuleSectionId =
  | 'basic'
  | 'priceDrop'
  | 'billing'
  | 'shipping'
  | 'comments'
  | 'cautions'
type MaterialCategory = 'manual' | 'salesData' | 'shipping' | 'template' | 'other'
type MaterialType = 'link' | 'file'
type Material = {
  id: string
  title: string
  category: MaterialCategory
  type: MaterialType
  url: string
  fileName?: string
  fileData?: string
  description: string
  createdAt: string
}
type MaterialFormState = {
  title: string
  category: MaterialCategory
  type: MaterialType
  url: string
  fileName: string
  fileData: string
  description: string
}
type MaterialCategoryFilter = MaterialCategory | 'すべて'
type LegacyProductFields = {
  suggestedPrice?: unknown
}

const bottomNavItems: BottomNavItem[] = [
  { id: 'dashboard', label: 'ホーム', icon: '🏠' },
  { id: 'simulation', label: '計算', icon: '🧮' },
  { id: 'products', label: '商品', icon: '👕' },
  { id: 'billing', label: '精算', icon: '💰' },
  { id: 'sales', label: '実績', icon: '📊' },
]

const screenLabels: Record<ScreenId, string> = {
  dashboard: 'ホーム',
  simulation: '利益シミュレーション',
  products: '商品',
  billing: '請求・精算管理',
  sales: '販売実績',
  resources: '販売ルール・資料',
}

const quickActions: ActionCard[] = [
  {
    label: '商品を登録する',
    description: '商品登録・商品一覧へ',
    target: 'products',
  },
  {
    label: '利益を計算する',
    description: '販売利益シミュレーションへ',
    target: 'simulation',
  },
  {
    label: '請求・精算管理を開く',
    description: '請求・精算管理へ',
    target: 'billing',
  },
  {
    label: '実績を見る',
    description: '販売実績へ',
    target: 'sales',
  },
  {
    label: 'ルール・資料を見る',
    description: '販売ルールとPDF資料の案内へ',
    target: 'resources',
  },
  {
    label: 'データ管理を開く',
    description: 'CSV・JSONバックアップへ',
    target: 'products',
  },
]

const productCategories: { value: ProductCategory; label: string }[] = [
  { value: 'shortSleeve', label: '半袖バンドT' },
  { value: 'longSleeve', label: '長袖バンドT' },
]

const ruleSections: {
  id: RuleSectionId
  title: string
  lead?: string
  items?: string[]
  note?: string
  example?: string[]
}[] = [
  {
    id: 'basic',
    title: '基本ルール',
    items: [
      '商品は販売委託形式で運用します',
      '販売パートナーは、貸し出された商品をメルカリ・ヤフーフリマ等で販売します',
      '商品が売れたら、販売価格・販売先・送料をアプリに登録します',
      '売却登録後、請求額と販売者利益が自動計算されます',
      '精算が完了した商品は、精算済みに変更します',
      '価格変更や値下げは、内部最低価格を確認しながら行ってください',
    ],
  },
  {
    id: 'priceDrop',
    title: 'メルカリ値下げ運用',
    lead:
      'メルカリの値下げ運用では、現在の表示価格ではなく、内部最低価格を基準に値下げを行います。内部最低価格とは、その商品が過去に一度でも到達した最も安い価格です。価格を元に戻しても、この最安値が次回の値下げ基準になります。',
    items: [
      '内部最低価格を基準に5％値下げします',
      'ただし、最低値下げ額は100円です',
      'アプリでは実運用しやすいように、次回減額を50円単位で切り上げて表示します',
      '値下げ後は、すぐに売りたい価格へ戻してください',
      '戻し忘れると、安い価格のまま売れてしまう可能性があります',
      '値下げ頻度は2日に1回を目安にしてください',
      '内部最低価格が300円付近まで下がった場合は、再出品を検討してください',
    ],
    example: [
      '内部最低価格が9,500円の場合',
      '5％は475円',
      '50円単位に切り上げて、次回減額は500円',
      '次回値下げ後価格は9,000円',
    ],
    note: '値下げ後は、必ず売りたい価格へ戻してください',
  },
  {
    id: 'billing',
    title: '請求ルール',
    lead: '売却登録を行うと、アプリが自動で請求額を計算します。',
    items: [
      '手数料後売価 = 販売価格 × 1 - 販売手数料率',
      '基準請求額 = 手数料後売価 × 50％',
      '半袖バンドTの最低請求額は3,000円',
      '長袖バンドTの最低請求額は3,800円',
      '請求ベースは、基準請求額と最低請求額の高い方を使用します',
      '追加請求額 = 仮利益 × 10％',
      '追加請求額は小数点以下を切り上げます',
      '最終請求額 = 請求ベース + 追加請求額',
      '販売者利益 = 手数料後売価 - 最終請求額 - 送料',
    ],
    note:
      '精算は月締めではなく、精算待ち金額が一定額に達したタイミングを目安に行います。請求・精算管理画面では、精算待ち商品と精算済み商品を分けて管理できます。',
  },
  {
    id: 'shipping',
    title: '発送・送料ルール',
    items: [
      '送料は売却登録時に入力してください',
      '初期値は215円です',
      '実際にかかった送料が違う場合は、手入力で修正してください',
      '送料が変わると、販売者利益も変わります',
      '発送方法や送料は、販売先・商品内容に応じて適宜確認してください',
    ],
  },
  {
    id: 'comments',
    title: 'コメント・値下げ対応',
    items: [
      '値下げ交渉が来た場合は、売りたい価格と内部最低価格を確認してください',
      '大幅な値下げは、利益や請求額に影響するため注意してください',
      '値下げ依頼機能がある場合は、希望額を確認してから対応してください',
      '判断に迷う場合は、勝手に大幅値下げせず確認してください',
      'トラブルになりそうなコメントには無理に対応しなくてもOKです',
    ],
  },
  {
    id: 'cautions',
    title: '注意事項',
    items: [
      'アプリの計算結果は、入力内容に基づく目安です',
      '販売価格・送料・手数料率の入力ミスに注意してください',
      '値下げ後に価格を戻し忘れると、想定より安く売れる可能性があります',
      '商品情報や売却情報は、登録後も必要に応じて編集してください',
      '試験運用中のため、ルールや仕様は今後変更される場合があります',
    ],
  },
]

const productStatuses: ProductStatus[] = ['販売中', '売却済み', '請求待ち', '請求済み', '返却済み', '保留']
const productStatusFilterOptions: ProductStatus[] = ['販売中', '保留', '請求待ち', '請求済み', '返却済み']
const productMarketplaceFilterOptions: { value: MarketplaceFilter; label: string }[] = [
  { value: 'すべて', label: 'すべて' },
  { value: 'mercari', label: 'メルカリ' },
  { value: 'yahoo-fleamarket', label: 'ヤフーフリマ' },
  { value: 'unsold', label: '未売却' },
]
const productSortOptions: { value: ProductSortOption; label: string }[] = [
  { value: 'createdDesc', label: '登録順：新しい順' },
  { value: 'createdAsc', label: '登録順：古い順' },
  { value: 'listingDateDesc', label: '出品日：新しい順' },
  { value: 'listingDateAsc', label: '出品日：古い順' },
  { value: 'internalLowestPriceDesc', label: '内部最低価格：高い順' },
  { value: 'internalLowestPriceAsc', label: '内部最低価格：安い順' },
  { value: 'targetPriceDesc', label: '売りたい価格：高い順' },
  { value: 'targetPriceAsc', label: '売りたい価格：安い順' },
  { value: 'soldDateDesc', label: '販売日：新しい順' },
  { value: 'soldDateAsc', label: '販売日：古い順' },
]
const productStorageKey = 'partners-sales-products'
const legacyProductStorageKey = 'offroad_partner_products'
const legacyProductSequenceStorageKey = 'offroad_partner_product_next_number'
const materialStorageKey = 'partners-sales-materials'
const settlementThresholdStorageKey = 'partners-sales-settlement-threshold'
const materialCategories: { value: MaterialCategory; label: string }[] = [
  { value: 'manual', label: '運用マニュアル' },
  { value: 'salesData', label: '販売データ' },
  { value: 'shipping', label: '発送・送料' },
  { value: 'template', label: 'テンプレート' },
  { value: 'other', label: 'その他' },
]
const initialMaterials: Material[] = [
  {
    id: 'initial-mercari-price-drop-manual',
    title: 'メルカリ値下げ運用マニュアル',
    category: 'manual',
    type: 'link',
    url: '',
    description: '内部最低価格を基準にした値下げ運用ルール',
    createdAt: '2026-04-01',
  },
]

const yenFormatter = new Intl.NumberFormat('ja-JP', {
  maximumFractionDigits: 0,
})

const formatYen = (value: number) => `${yenFormatter.format(Math.round(value))}円`
const formatPercent = (value: number) => `${value.toFixed(1)}%`
const formatFeeRate = (value: number) => `${(value * 100).toFixed(0)}%`
const toNumber = (value: string) => Number(value) || 0
const toNonNegativeNumber = (value: string) => Math.max(0, toNumber(value))
const toStoredNonNegativeNumber = (value: unknown, fallback = 0) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : fallback
}
const toStoredNumber = (value: unknown, fallback = 0) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}
const clampFeeRatePercent = (value: number) => Math.min(100, Math.max(0, value))
const getCategoryLabel = (category: ProductCategory) =>
  productCategories.find((item) => item.value === category)?.label ?? category
const getMaterialCategoryLabel = (category: MaterialCategory) =>
  materialCategories.find((item) => item.value === category)?.label ?? category
const getMaterialTypeLabel = (type: MaterialType) =>
  type === 'file' ? 'PDFファイル' : 'URL'
const getProductStatusLabel = (status: ProductStatus) =>
  status === '請求待ち' ? '精算待ち' : status === '請求済み' ? '精算済み' : status
const formatProductCode = (sequence: number) => `BT-${String(sequence).padStart(4, '0')}`
const getProductCodeNumber = (code: string) => {
  const match = code.match(/^BT-(\d+)$/)
  return match ? Number(match[1]) : 0
}
const getTodayString = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const getChannelLabel = (channelId: SalesChannelId) =>
  salesChannels.find((channel) => channel.id === channelId)?.label ?? channelId
const getDefaultFeeRatePercent = (channelId: SalesChannelId) => {
  const channel = salesChannels.find((item) => item.id === channelId) ?? salesChannels[0]
  return String(channel.feeRate * 100)
}
const getCalculationProductType = (category: ProductCategory): ProductTypeId =>
  category === 'longSleeve' ? 'long-sleeve-band-t' : 'short-sleeve-band-t'
const hasBillingData = (product: Product) =>
  product.soldPrice !== undefined &&
  product.billingAmount !== undefined &&
  product.sellerProfit !== undefined
const getSoldMonthKey = (soldDate?: string) => {
  const match = soldDate?.match(/^(\d{4})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}` : ''
}
const getDateTime = (dateValue?: string) => {
  if (!dateValue) {
    return 0
  }

  const time = new Date(dateValue).getTime()
  return Number.isFinite(time) ? time : 0
}
const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-')
  return year && month ? `${year}年${Number(month)}月` : monthKey
}
const compareProductsBySortOption = (
  first: Product,
  second: Product,
  sortOption: ProductSortOption,
) => {
  switch (sortOption) {
    case 'createdAsc':
      return getDateTime(first.createdAt) - getDateTime(second.createdAt)
    case 'listingDateDesc':
      return getDateTime(second.listingDate) - getDateTime(first.listingDate)
    case 'listingDateAsc':
      return getDateTime(first.listingDate) - getDateTime(second.listingDate)
    case 'internalLowestPriceDesc':
      return second.internalLowestPrice - first.internalLowestPrice
    case 'internalLowestPriceAsc':
      return first.internalLowestPrice - second.internalLowestPrice
    case 'targetPriceDesc':
      return second.targetPrice - first.targetPrice
    case 'targetPriceAsc':
      return first.targetPrice - second.targetPrice
    case 'soldDateDesc':
      return getDateTime(second.soldDate) - getDateTime(first.soldDate)
    case 'soldDateAsc':
      return getDateTime(first.soldDate) - getDateTime(second.soldDate)
    case 'createdDesc':
    default:
      return getDateTime(second.createdAt) - getDateTime(first.createdAt)
  }
}
const createSalesStats = (items: Product[]) => {
  const count = items.length
  const totalSales = items.reduce((total, product) => total + (product.soldPrice ?? 0), 0)
  const totalBilling = items.reduce((total, product) => total + (product.billingAmount ?? 0), 0)
  const totalSellerProfit = items.reduce(
    (total, product) => total + (product.sellerProfit ?? 0),
    0,
  )
  const averageProfitRate =
    count > 0
      ? items.reduce((total, product) => total + (product.profitRate ?? 0), 0) / count
      : 0

  return {
    count,
    totalSales,
    totalBilling,
    totalSellerProfit,
    averageSales: count > 0 ? totalSales / count : 0,
    averageBilling: count > 0 ? totalBilling / count : 0,
    averageSellerProfit: count > 0 ? totalSellerProfit / count : 0,
    averageProfitRate,
  }
}

const escapeCsvValue = (value: unknown) => {
  const text = value === undefined || value === null ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const createProductsCsv = (items: Product[]) => {
  const headers = [
    '商品番号',
    '商品名',
    '商品種別',
    'ステータス',
    '出品開始価格',
    '売りたい価格',
    '内部最低価格',
    '出品日',
    '販売日',
    '販売先',
    '販売価格',
    '送料',
    '販売手数料率',
    '販売手数料',
    '手数料後売価',
    '請求額',
    '販売者利益',
    '利益率',
    '精算済み日',
    'メモ',
  ]
  const rows = items.map((product) => [
    product.code,
    product.name,
    getCategoryLabel(product.category),
    getProductStatusLabel(product.status),
    product.startPrice,
    product.targetPrice,
    product.internalLowestPrice,
    product.listingDate,
    product.soldDate ?? '',
    product.marketplace ? getChannelLabel(product.marketplace) : '',
    product.soldPrice ?? '',
    product.shippingFee ?? '',
    product.feeRate !== undefined ? formatFeeRate(product.feeRate) : '',
    product.platformFee ?? '',
    product.netSales ?? '',
    product.billingAmount ?? '',
    product.sellerProfit ?? '',
    product.profitRate !== undefined ? formatPercent(product.profitRate) : '',
    product.billedDate ?? '',
    product.memo,
  ])

    return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n')
}

const stripIgnoredProductFields = (product: Product) => {
  const {
    id,
    code,
    name,
    category,
    startPrice,
    targetPrice,
    internalLowestPrice,
    listingDate,
    status,
    memo,
    createdAt,
    soldDate,
    marketplace,
    soldPrice,
    shippingFee,
    feeRate,
    platformFee,
    netSales,
    billingAmount,
    sellerProfit,
    profitRate,
    billedDate,
  } = product

  return {
    id,
    code,
    name,
    category,
    startPrice,
    targetPrice,
    internalLowestPrice,
    listingDate,
    status,
    memo,
    createdAt,
    soldDate,
    marketplace,
    soldPrice,
    shippingFee,
    feeRate,
    platformFee,
    netSales,
    billingAmount,
    sellerProfit,
    profitRate,
    billedDate,
  }
}

const downloadTextFile = (content: string, fileName: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

const createInitialProductForm = (): ProductFormState => ({
  name: '',
  category: 'shortSleeve',
  startPrice: '',
  targetPrice: '',
  internalLowestPrice: '',
  listingDate: '',
  status: '販売中',
  memo: '',
})

const createInitialMaterialForm = (): MaterialFormState => ({
  title: '',
  category: 'manual',
  type: 'link',
  url: '',
  fileName: '',
  fileData: '',
  description: '',
})

const createSaleForm = (product?: Product): SaleFormState => ({
  soldDate: product?.soldDate || getTodayString(),
  marketplace: product?.marketplace || 'mercari',
  soldPrice: product?.soldPrice ? String(product.soldPrice) : '',
  shippingFee: product?.shippingFee ? String(product.shippingFee) : '215',
  feeRate:
    product?.feeRate !== undefined
      ? String(product.feeRate * 100)
      : getDefaultFeeRatePercent(product?.marketplace || 'mercari'),
})

const getProductPriceValues = (form: ProductFormState) => {
  const startPrice = toNonNegativeNumber(form.startPrice)
  const shouldUseStartPrice = form.startPrice.trim() !== ''

  return {
    startPrice,
    targetPrice:
      form.targetPrice.trim() === '' && shouldUseStartPrice
        ? startPrice
        : toNonNegativeNumber(form.targetPrice),
    internalLowestPrice:
      form.internalLowestPrice.trim() === '' && shouldUseStartPrice
        ? startPrice
        : toNonNegativeNumber(form.internalLowestPrice),
  }
}

const calculatePriceDropInfo = (
  product: Pick<Product, 'internalLowestPrice' | 'targetPrice'>,
): PriceDropInfo => {
  const internalLowestPrice = Math.max(0, Math.round(product.internalLowestPrice))
  const targetPrice = Math.max(0, Math.round(product.targetPrice))

  if (internalLowestPrice <= 0) {
    return {
      hasInternalLowestPrice: false,
      guidance: '内部最低価格を入力すると、次回値下げ目安が表示されます。',
    }
  }

  const baseDiscount = Math.max(internalLowestPrice * 0.05, 100)
  const nextDiscountAmount = Math.ceil(baseDiscount / 50) * 50
  const nextDiscountPrice = Math.max(internalLowestPrice - nextDiscountAmount, 0)
  const isRelistRecommended = internalLowestPrice <= 300

  return {
    hasInternalLowestPrice: true,
    nextDiscountAmount,
    nextDiscountPrice,
    isRelistRecommended,
    operationStatus: isRelistRecommended ? '再出品推奨' : '継続運用',
    returnPriceMessage: `割引後はすぐに${formatYen(targetPrice)}へ戻してください`,
  }
}

const normalizeProduct = (value: unknown, index: number): Product | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const source = value as Partial<Product> & LegacyProductFields
  if (!source.name || typeof source.name !== 'string') {
    return null
  }

  const category: ProductCategory =
    source.category === 'longSleeve' || source.category === 'shortSleeve'
      ? source.category
      : 'shortSleeve'
  const status: ProductStatus = productStatuses.includes(source.status as ProductStatus)
    ? (source.status as ProductStatus)
    : '販売中'
  const code =
    typeof source.code === 'string' && source.code ? source.code : formatProductCode(index + 1)
  const createdAt =
    typeof source.createdAt === 'string' && source.createdAt
      ? source.createdAt
      : typeof source.id === 'string' && !Number.isNaN(Number(source.id))
        ? new Date(Number(source.id)).toISOString()
        : new Date().toISOString()
  const legacySuggestedPrice = toStoredNonNegativeNumber(source.suggestedPrice)
  const startPrice = toStoredNonNegativeNumber(source.startPrice, legacySuggestedPrice)
  const targetPrice =
    source.targetPrice === undefined
      ? startPrice
      : toStoredNonNegativeNumber(source.targetPrice, startPrice)
  const internalLowestPrice =
    source.internalLowestPrice === undefined
      ? startPrice
      : toStoredNonNegativeNumber(source.internalLowestPrice, startPrice)
  const marketplace: SalesChannelId | undefined =
    source.marketplace === 'mercari' || source.marketplace === 'yahoo-fleamarket'
      ? source.marketplace
      : undefined

  return {
    id: typeof source.id === 'string' && source.id ? source.id : `${Date.now()}-${index}`,
    code,
    name: source.name,
    category,
    startPrice,
    targetPrice,
    internalLowestPrice,
    listingDate: typeof source.listingDate === 'string' ? source.listingDate : '',
    status,
    memo: typeof source.memo === 'string' ? source.memo : '',
    createdAt,
    soldDate: typeof source.soldDate === 'string' ? source.soldDate : undefined,
    marketplace,
    soldPrice:
      source.soldPrice === undefined ? undefined : toStoredNonNegativeNumber(source.soldPrice),
    shippingFee:
      source.shippingFee === undefined ? undefined : toStoredNonNegativeNumber(source.shippingFee),
    feeRate:
      source.feeRate === undefined ? undefined : toStoredNonNegativeNumber(source.feeRate),
    platformFee:
      source.platformFee === undefined ? undefined : toStoredNonNegativeNumber(source.platformFee),
    netSales:
      source.netSales === undefined ? undefined : toStoredNonNegativeNumber(source.netSales),
    billingAmount:
      source.billingAmount === undefined
        ? undefined
        : toStoredNonNegativeNumber(source.billingAmount),
    sellerProfit:
      source.sellerProfit === undefined
        ? undefined
        : toStoredNumber(source.sellerProfit),
    profitRate:
      source.profitRate === undefined ? undefined : toStoredNumber(source.profitRate),
    billedDate: typeof source.billedDate === 'string' ? source.billedDate : undefined,
  }
}

const normalizeMaterial = (value: unknown, index: number): Material | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const source = value as Partial<Material>
  if (!source.title || typeof source.title !== 'string') {
    return null
  }

  const category: MaterialCategory = materialCategories.some(
    (item) => item.value === source.category,
  )
    ? (source.category as MaterialCategory)
    : 'other'
  const type: MaterialType = source.type === 'file' ? 'file' : 'link'

  return {
    id: typeof source.id === 'string' && source.id ? source.id : `${Date.now()}-${index}`,
    title: source.title,
    category,
    type,
    url: typeof source.url === 'string' ? source.url : '',
    fileName: typeof source.fileName === 'string' ? source.fileName : undefined,
    fileData: typeof source.fileData === 'string' ? source.fileData : undefined,
    description: typeof source.description === 'string' ? source.description : '',
    createdAt:
      typeof source.createdAt === 'string' && source.createdAt
        ? source.createdAt
        : new Date().toISOString(),
  }
}

const loadProducts = () => {
  try {
    const storedProducts =
      localStorage.getItem(productStorageKey) ?? localStorage.getItem(legacyProductStorageKey)
    if (!storedProducts) {
      return []
    }

    const parsedProducts: unknown = JSON.parse(storedProducts)
    if (!Array.isArray(parsedProducts)) {
      return []
    }

    return parsedProducts
      .map((product, index) => normalizeProduct(product, index))
      .filter((product): product is Product => Boolean(product))
  } catch {
    return []
  }
}

const loadMaterials = () => {
  try {
    const storedMaterials = localStorage.getItem(materialStorageKey)
    if (!storedMaterials) {
      return initialMaterials
    }

    const parsedMaterials: unknown = JSON.parse(storedMaterials)
    if (!Array.isArray(parsedMaterials)) {
      return initialMaterials
    }

    return parsedMaterials
      .map((material, index) => normalizeMaterial(material, index))
      .filter((material): material is Material => Boolean(material))
  } catch {
    return initialMaterials
  }
}

const loadSettlementThreshold = () => {
  try {
    const storedThreshold = localStorage.getItem(settlementThresholdStorageKey)
    const numericThreshold = Number(storedThreshold)
    return Number.isFinite(numericThreshold) && numericThreshold > 0
      ? String(Math.round(numericThreshold))
      : '10000'
  } catch {
    return '10000'
  }
}

const getNextProductNumber = (products: Product[]) => {
  const maxCodeNumber = products.reduce(
    (maxNumber, product) => Math.max(maxNumber, getProductCodeNumber(product.code)),
    0,
  )

  return maxCodeNumber + 1
}

function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('dashboard')
  const [salesChannel, setSalesChannel] = useState<SalesChannelId>('mercari')
  const [productType, setProductType] = useState<ProductTypeId>('short-sleeve-band-t')
  const [salePriceInput, setSalePriceInput] = useState('')
  const [shippingFeeInput, setShippingFeeInput] = useState('215')
  const [feeRateInput, setFeeRateInput] = useState('10')
  const [products, setProducts] = useState<Product[]>(() => loadProducts())
  const [productForm, setProductForm] = useState<ProductFormState>(() => createInitialProductForm())
  const [productError, setProductError] = useState('')
  const [productMessage, setProductMessage] = useState('')
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('すべて')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('すべて')
  const [marketplaceFilter, setMarketplaceFilter] = useState<MarketplaceFilter>('すべて')
  const [productSortOption, setProductSortOption] = useState<ProductSortOption>('createdDesc')
  const [activeSaleProductId, setActiveSaleProductId] = useState<string | null>(null)
  const [saleForm, setSaleForm] = useState<SaleFormState>(() => createSaleForm())
  const [saleError, setSaleError] = useState('')
  const [saleMessage, setSaleMessage] = useState('')
  const [billingMessage, setBillingMessage] = useState('')
  const [isBilledListOpen, setIsBilledListOpen] = useState(false)
  const [settlementThresholdInput, setSettlementThresholdInput] = useState(() =>
    loadSettlementThreshold(),
  )
  const [salesMonthFilter, setSalesMonthFilter] = useState<MonthFilter>('すべて')
  const [salesChannelFilter, setSalesChannelFilter] = useState<SalesChannelId | 'すべて'>('すべて')
  const [salesCategoryFilter, setSalesCategoryFilter] = useState<CategoryFilter>('すべて')
  const [salesStatusFilter, setSalesStatusFilter] = useState<BillingStatusFilter>('すべて')
  const [openRuleSectionIds, setOpenRuleSectionIds] = useState<RuleSectionId[]>(['basic'])
  const [materials, setMaterials] = useState<Material[]>(() => loadMaterials())
  const [materialForm, setMaterialForm] = useState<MaterialFormState>(() =>
    createInitialMaterialForm(),
  )
  const [materialSearchQuery, setMaterialSearchQuery] = useState('')
  const [materialCategoryFilter, setMaterialCategoryFilter] =
    useState<MaterialCategoryFilter>('すべて')
  const [materialError, setMaterialError] = useState('')
  const [materialMessage, setMaterialMessage] = useState('')
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({})
  const productFormRef = useRef<HTMLFormElement | null>(null)
  const importFileInputRef = useRef<HTMLInputElement | null>(null)
  const materialFileInputRef = useRef<HTMLInputElement | null>(null)
  const shouldSkipNextProductSave = useRef(false)

  const feeRatePercent = clampFeeRatePercent(toNumber(feeRateInput))
  const salesResult = calculateSalesResult({
    salesChannel,
    productType,
    salePrice: toNumber(salePriceInput),
    shippingFee: toNumber(shippingFeeInput),
    feeRate: feeRatePercent / 100,
  })

  const detailRows = [
    { label: '販売価格', value: formatYen(salesResult.salePrice) },
    { label: '販売手数料', value: formatYen(salesResult.salesFee) },
    { label: '手数料後売価', value: formatYen(salesResult.priceAfterFee) },
    { label: '基準請求額', value: formatYen(salesResult.baseCharge) },
    { label: '最低請求額', value: formatYen(salesResult.minimumCharge) },
    { label: '請求ベース', value: formatYen(salesResult.chargeBase) },
    { label: '追加請求額', value: formatYen(salesResult.additionalCharge) },
    { label: '最終請求額', value: formatYen(salesResult.finalCharge) },
    { label: '販売者利益', value: formatYen(salesResult.sellerProfit) },
    { label: '利益率', value: formatPercent(salesResult.profitRate) },
  ]

  const sortedProducts = useMemo(
    () =>
      [...products].sort(
        (first, second) => compareProductsBySortOption(first, second, 'createdDesc'),
      ),
    [products],
  )

  const filteredProducts = useMemo(() => {
    const normalizedSearchQuery = productSearchQuery.trim().toLowerCase()

    return sortedProducts
      .filter((product) => {
        const matchesSearch =
          normalizedSearchQuery === '' ||
          [product.name, product.code, product.memo].some((value) =>
            value.toLowerCase().includes(normalizedSearchQuery),
          )
        const matchesStatus = statusFilter === 'すべて' || product.status === statusFilter
        const matchesCategory = categoryFilter === 'すべて' || product.category === categoryFilter
        const matchesMarketplace =
          marketplaceFilter === 'すべて' ||
          (marketplaceFilter === 'unsold'
            ? product.soldPrice === undefined
            : product.marketplace === marketplaceFilter)

        return (
          matchesSearch &&
          matchesStatus &&
          matchesCategory &&
          matchesMarketplace
        )
      })
      .sort((first, second) => compareProductsBySortOption(first, second, productSortOption))
  }, [
    categoryFilter,
    marketplaceFilter,
    productSearchQuery,
    productSortOption,
    sortedProducts,
    statusFilter,
  ])
  const editingProduct = products.find((product) => product.id === editingProductId)
  const activeSaleProduct = products.find((product) => product.id === activeSaleProductId)
  const activeSaleResult = activeSaleProduct
    ? calculateSalesResult({
        salesChannel: saleForm.marketplace,
        productType: getCalculationProductType(activeSaleProduct.category),
        salePrice: toNumber(saleForm.soldPrice),
        shippingFee: toNumber(saleForm.shippingFee),
        feeRate: clampFeeRatePercent(toNumber(saleForm.feeRate)) / 100,
      })
    : null
  const billableProducts = sortedProducts.filter(hasBillingData)
  const filteredBillableProducts = billableProducts
  const pendingBillingProducts = filteredBillableProducts.filter(
    (product) => product.status === '請求待ち',
  )
  const billedProducts = filteredBillableProducts.filter((product) => product.status === '請求済み')
  const billingSummary = {
    pendingCount: pendingBillingProducts.length,
    pendingTotal: pendingBillingProducts.reduce(
      (total, product) => total + (product.billingAmount ?? 0),
      0,
    ),
    billedCount: billedProducts.length,
    billedTotal: billedProducts.reduce(
      (total, product) => total + (product.billingAmount ?? 0),
      0,
    ),
    sellerProfitTotal: filteredBillableProducts.reduce(
      (total, product) => total + (product.sellerProfit ?? 0),
      0,
    ),
  }
  const settlementThreshold = (() => {
    const numericThreshold = Number(settlementThresholdInput)
    return Number.isFinite(numericThreshold) && numericThreshold > 0
      ? Math.round(numericThreshold)
      : 10000
  })()
  const remainingSettlementAmount = Math.max(settlementThreshold - billingSummary.pendingTotal, 0)
  const hasReachedSettlementThreshold =
    billingSummary.pendingTotal >= settlementThreshold && billingSummary.pendingTotal > 0
  const soldProducts = sortedProducts
    .filter(hasBillingData)
    .sort((first, second) => {
      const firstTime = first.soldDate ? new Date(first.soldDate).getTime() : 0
      const secondTime = second.soldDate ? new Date(second.soldDate).getTime() : 0
      return secondTime - firstTime
    })
  const todayString = getTodayString()
  const todaySalesStats = createSalesStats(
    soldProducts.filter((product) => product.soldDate === todayString),
  )
  const overallSalesStats = createSalesStats(soldProducts)
  const allPendingBillingProducts = sortedProducts.filter(
    (product) => hasBillingData(product) && product.status === '請求待ち',
  )
  const pendingBillingTotal = allPendingBillingProducts.reduce(
    (total, product) => total + (product.billingAmount ?? 0),
    0,
  )
  const relistAlertProducts = sortedProducts.filter(
    (product) =>
      product.status === '販売中' &&
      product.soldPrice === undefined &&
      product.internalLowestPrice > 0 &&
      product.internalLowestPrice <= 300,
  )
  const recentSalesProducts = soldProducts.slice(0, 5)
  const salesMonthOptions = Array.from(
    new Set(soldProducts.map((product) => getSoldMonthKey(product.soldDate)).filter(Boolean)),
  ).sort((first, second) => second.localeCompare(first))
  const filteredSalesProducts = soldProducts.filter((product) => {
    const matchesMonth =
      salesMonthFilter === 'すべて' || getSoldMonthKey(product.soldDate) === salesMonthFilter
    const matchesChannel =
      salesChannelFilter === 'すべて' || product.marketplace === salesChannelFilter
    const matchesCategory =
      salesCategoryFilter === 'すべて' || product.category === salesCategoryFilter
    const matchesStatus = salesStatusFilter === 'すべて' || product.status === salesStatusFilter
    return matchesMonth && matchesChannel && matchesCategory && matchesStatus
  })
  const salesSummary = createSalesStats(filteredSalesProducts)
  const shortSleeveSalesStats = createSalesStats(
    filteredSalesProducts.filter((product) => product.category === 'shortSleeve'),
  )
  const longSleeveSalesStats = createSalesStats(
    filteredSalesProducts.filter((product) => product.category === 'longSleeve'),
  )
  const mercariSalesStats = createSalesStats(
    filteredSalesProducts.filter((product) => product.marketplace === 'mercari'),
  )
  const yahooSalesStats = createSalesStats(
    filteredSalesProducts.filter((product) => product.marketplace === 'yahoo-fleamarket'),
  )
  const filteredMaterials = useMemo(() => {
    const normalizedSearchQuery = materialSearchQuery.trim().toLowerCase()

    return [...materials]
      .filter((material) => {
        const matchesSearch =
          normalizedSearchQuery === '' ||
          [material.title, material.description].some((value) =>
            value.toLowerCase().includes(normalizedSearchQuery),
          )
        const matchesCategory =
          materialCategoryFilter === 'すべて' || material.category === materialCategoryFilter

        return matchesSearch && matchesCategory
      })
      .sort((first, second) => getDateTime(second.createdAt) - getDateTime(first.createdAt))
  }, [materialCategoryFilter, materialSearchQuery, materials])

  useEffect(() => {
    if (shouldSkipNextProductSave.current) {
      localStorage.removeItem(productStorageKey)
      localStorage.removeItem(legacyProductStorageKey)
      localStorage.removeItem(legacyProductSequenceStorageKey)
      shouldSkipNextProductSave.current = false
      return
    }

    localStorage.setItem(productStorageKey, JSON.stringify(products))
  }, [products])

  useEffect(() => {
    const numericThreshold = Number(settlementThresholdInput)
    if (Number.isFinite(numericThreshold) && numericThreshold > 0) {
      localStorage.setItem(settlementThresholdStorageKey, String(Math.round(numericThreshold)))
    }
  }, [settlementThresholdInput])

  const updateProductForm = <Key extends keyof ProductFormState>(
    key: Key,
    value: ProductFormState[Key],
  ) => {
    setProductForm((current) => ({ ...current, [key]: value }))
    setProductError('')
    setProductMessage('')
  }

  const updateSaleForm = <Key extends keyof SaleFormState>(
    key: Key,
    value: SaleFormState[Key],
  ) => {
    setSaleForm((current) => ({ ...current, [key]: value }))
    setSaleError('')
    setSaleMessage('')
  }

  const handleSettlementThresholdBlur = () => {
    const numericThreshold = Number(settlementThresholdInput)
    if (!Number.isFinite(numericThreshold) || numericThreshold <= 0) {
      setSettlementThresholdInput('10000')
      localStorage.setItem(settlementThresholdStorageKey, '10000')
      return
    }

    setSettlementThresholdInput(String(Math.round(numericThreshold)))
  }

  const updateMaterialForm = <Key extends keyof MaterialFormState>(
    key: Key,
    value: MaterialFormState[Key],
  ) => {
    setMaterialForm((current) => ({ ...current, [key]: value }))
    setMaterialError('')
    setMaterialMessage('')
  }

  const saveMaterials = (nextMaterials: Material[], successMessage: string) => {
    try {
      localStorage.setItem(materialStorageKey, JSON.stringify(nextMaterials))
      setMaterials(nextMaterials)
      setMaterialError('')
      setMaterialMessage(successMessage)
      return true
    } catch {
      setMaterialError(
        '資料データを保存できませんでした。PDFが大きい場合はURL登録を使ってください。',
      )
      setMaterialMessage('')
      return false
    }
  }

  const isSectionExpanded = (
    productId: string,
    section: keyof ExpandedSections[string],
  ) => Boolean(expandedSections[productId]?.[section])

  const toggleProductSection = (
    productId: string,
    section: keyof ExpandedSections[string],
  ) => {
    setExpandedSections((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        [section]: !current[productId]?.[section],
      },
    }))
  }

  const toggleRuleSection = (sectionId: RuleSectionId) => {
    setOpenRuleSectionIds((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    )
  }

  const handleResetProductFilters = () => {
    setProductSearchQuery('')
    setStatusFilter('すべて')
    setCategoryFilter('すべて')
    setMarketplaceFilter('すべて')
    setProductSortOption('createdDesc')
  }

  const handleMaterialTypeChange = (type: MaterialType) => {
    setMaterialForm((current) => ({
      ...current,
      type,
      url: type === 'link' ? current.url : '',
      fileName: type === 'file' ? current.fileName : '',
      fileData: type === 'file' ? current.fileData : '',
    }))
    setMaterialError('')
    setMaterialMessage('')
  }

  const handleMaterialFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setMaterialError('PDFファイルを選択してください。')
      setMaterialMessage('')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      setMaterialForm((current) => ({
        ...current,
        fileName: file.name,
        fileData: result,
      }))
      setMaterialError('')
      setMaterialMessage(`${file.name} を選択しました。`)
    }
    reader.onerror = () => {
      setMaterialError('PDFファイルを読み込めませんでした。')
      setMaterialMessage('')
    }
    reader.readAsDataURL(file)
  }

  const handleMaterialSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const title = materialForm.title.trim()
    const url = materialForm.url.trim()
    const description = materialForm.description.trim()

    if (!title) {
      setMaterialError('資料名を入力してください。')
      setMaterialMessage('')
      return
    }

    if (materialForm.type === 'link') {
      if (!url) {
        setMaterialError('URLを入力してください。')
        setMaterialMessage('')
        return
      }

      if (!/^https?:\/\//i.test(url)) {
        setMaterialError('URLは http:// または https:// から始めてください。')
        setMaterialMessage('')
        return
      }
    }

    if (materialForm.type === 'file' && !materialForm.fileData) {
      setMaterialError('PDFファイルを選択してください。')
      setMaterialMessage('')
      return
    }

    const newMaterial: Material = {
      id: `${Date.now()}`,
      title,
      category: materialForm.category,
      type: materialForm.type,
      url: materialForm.type === 'link' ? url : '',
      fileName: materialForm.type === 'file' ? materialForm.fileName : undefined,
      fileData: materialForm.type === 'file' ? materialForm.fileData : undefined,
      description,
      createdAt: new Date().toISOString(),
    }

    const didSave = saveMaterials([newMaterial, ...materials], '資料を登録しました。')
    if (!didSave) {
      return
    }

    setMaterialForm(createInitialMaterialForm())
    if (materialFileInputRef.current) {
      materialFileInputRef.current.value = ''
    }
  }

  const handleDeleteMaterial = (materialId: string) => {
    if (!window.confirm('この資料を削除します。よろしいですか？')) {
      return
    }

    saveMaterials(
      materials.filter((material) => material.id !== materialId),
      '資料を削除しました。',
    )
  }

  const handleSalesChannelChange = (value: SalesChannelId) => {
    const nextChannel = salesChannels.find((channel) => channel.id === value) ?? salesChannels[0]
    setSalesChannel(value)
    setFeeRateInput(String(nextChannel.feeRate * 100))
  }

  const handleSaleMarketplaceChange = (value: SalesChannelId) => {
    setSaleForm((current) => ({
      ...current,
      marketplace: value,
      feeRate: getDefaultFeeRatePercent(value),
    }))
    setSaleError('')
    setSaleMessage('')
  }

  const resetProductForm = () => {
    setProductForm(createInitialProductForm())
    setEditingProductId(null)
    setProductError('')
  }

  const handleProductSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!productForm.name.trim()) {
      setProductError('商品名を入力してください。')
      setProductMessage('')
      return
    }

    const productValues = {
      name: productForm.name.trim(),
      category: productForm.category,
      ...getProductPriceValues(productForm),
      listingDate: productForm.listingDate,
      status: productForm.status,
      memo: productForm.memo.trim(),
    }

    if (editingProductId) {
      setProducts((current) =>
        current.map((product) =>
          product.id === editingProductId ? { ...product, ...productValues } : product,
        ),
      )
      setProductMessage('商品を更新しました。')
    } else {
      setProducts((current) => {
        const newProduct: Product = {
          id: `${Date.now()}`,
          code: formatProductCode(getNextProductNumber(current)),
          createdAt: new Date().toISOString(),
          ...productValues,
        }

        return [newProduct, ...current]
      })
      setProductMessage('商品を登録しました。')
    }

    resetProductForm()
    setProductError('')
  }

  const handleEditProduct = (product: Product) => {
    setProductForm({
      name: product.name,
      category: product.category,
      startPrice: product.startPrice ? String(product.startPrice) : '',
      targetPrice: product.targetPrice ? String(product.targetPrice) : '',
      internalLowestPrice: product.internalLowestPrice ? String(product.internalLowestPrice) : '',
      listingDate: product.listingDate,
      status: product.status,
      memo: product.memo,
    })
    setEditingProductId(product.id)
    setProductError('')
    setProductMessage('商品情報を編集モードにしました。')
    window.requestAnimationFrame(() => {
      productFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  const handleCancelEdit = () => {
    resetProductForm()
    setProductMessage('')
  }

  const handleOpenSaleForm = (product: Product) => {
    setActiveSaleProductId(product.id)
    setSaleForm(createSaleForm(product))
    setSaleError('')
    setSaleMessage('')
    setExpandedSections((current) => ({
      ...current,
      [product.id]: {
        ...current[product.id],
        detail: true,
      },
    }))
  }

  const handleCancelSaleForm = () => {
    setActiveSaleProductId(null)
    setSaleForm(createSaleForm())
    setSaleError('')
  }

  const handleSaleSubmit = (product: Product) => {
    const saleResult = calculateSalesResult({
      salesChannel: saleForm.marketplace,
      productType: getCalculationProductType(product.category),
      salePrice: toNumber(saleForm.soldPrice),
      shippingFee: toNumber(saleForm.shippingFee),
      feeRate: clampFeeRatePercent(toNumber(saleForm.feeRate)) / 100,
    })

    if (saleResult.salePrice <= 0) {
      setSaleError('販売価格を入力してください。')
      setSaleMessage('')
      return
    }

    setProducts((current) =>
      current.map((item) =>
        item.id === product.id
          ? {
              ...item,
              status: item.status === '請求済み' ? item.status : '請求待ち',
              soldDate: saleForm.soldDate,
              marketplace: saleForm.marketplace,
              soldPrice: saleResult.salePrice,
              shippingFee: toNumber(saleForm.shippingFee),
              feeRate: saleResult.feeRate,
              platformFee: saleResult.salesFee,
              netSales: saleResult.priceAfterFee,
              billingAmount: saleResult.finalCharge,
              sellerProfit: saleResult.sellerProfit,
              profitRate: saleResult.profitRate,
            }
          : item,
      ),
    )
    setActiveSaleProductId(null)
    setSaleForm(createSaleForm())
    setSaleError('')
    setSaleMessage('売却登録が完了しました。商品は精算待ちに移動しました。')
  }

  const handleMarkAsBilled = (productId: string) => {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId
          ? {
              ...product,
              status: '請求済み',
              billedDate: getTodayString(),
            }
          : product,
      ),
    )
    setBillingMessage('精算済みにしました。')
    setIsBilledListOpen(true)
  }

  const handleReturnToPendingBilling = (productId: string) => {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId
          ? {
              ...product,
              status: '請求待ち',
              billedDate: undefined,
            }
          : product,
      ),
    )
    setBillingMessage('精算待ちに戻しました。')
  }

  const handleDeleteProduct = (productId: string) => {
    if (!window.confirm('この商品を削除しますか？')) {
      return
    }

    setProducts((current) => current.filter((product) => product.id !== productId))
    if (editingProductId === productId) {
      resetProductForm()
    }
    if (activeSaleProductId === productId) {
      handleCancelSaleForm()
    }
    setExpandedSections((current) => {
      const nextSections = { ...current }
      delete nextSections[productId]
      return nextSections
    })
    setProductMessage('商品を削除しました。')
    setProductError('')
  }

  const handleExportCsv = () => {
    const csvContent = `\uFEFF${createProductsCsv(sortedProducts)}`
    downloadTextFile(csvContent, `partners-sales-${getTodayString()}.csv`, 'text/csv;charset=utf-8')
    setProductMessage('CSVをエクスポートしました。')
    setProductError('')
  }

  const handleExportJsonBackup = () => {
    downloadTextFile(
      JSON.stringify(
        {
          products: products.map(stripIgnoredProductFields),
          materials,
        },
        null,
        2,
      ),
      `partners-sales-backup-${getTodayString()}.json`,
      'application/json;charset=utf-8',
    )
    setProductMessage('JSONバックアップを作成しました。')
    setProductError('')
  }

  const handleOpenImportBackup = () => {
    importFileInputRef.current?.click()
  }

  const handleImportBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (
      !window.confirm(
        '現在の商品データを上書きして、バックアップデータを復元します。よろしいですか？',
      )
    ) {
      return
    }

    try {
      const text = await file.text()
      const parsedData: unknown = JSON.parse(text)
      const productData =
        Array.isArray(parsedData)
          ? parsedData
          : parsedData && typeof parsedData === 'object' && Array.isArray((parsedData as { products?: unknown }).products)
            ? (parsedData as { products: unknown[] }).products
            : null
      const materialData =
        parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)
          ? (parsedData as { materials?: unknown }).materials
          : undefined

      if (!productData) {
        throw new Error('バックアップファイルの形式が正しくありません。')
      }

      const importedProducts = productData.map((item, index) => {
        if (!item || typeof item !== 'object') {
          throw new Error('商品データの形式が正しくありません。')
        }

        const source = item as Partial<Product>
        const hasRequiredFields =
          typeof source.id === 'string' &&
          source.id.trim() !== '' &&
          typeof source.code === 'string' &&
          source.code.trim() !== '' &&
          typeof source.name === 'string' &&
          source.name.trim() !== ''

        if (!hasRequiredFields) {
          throw new Error('商品データとして必要な項目が不足しています。')
        }

        const normalizedProduct = normalizeProduct(item, index)
        if (!normalizedProduct) {
          throw new Error('商品データを読み込めませんでした。')
        }

        return normalizedProduct
      })
      const importedMaterials = Array.isArray(materialData)
        ? materialData
            .map((item, index) => normalizeMaterial(item, index))
            .filter((material): material is Material => Boolean(material))
        : materials

      localStorage.setItem(productStorageKey, JSON.stringify(importedProducts))
      localStorage.setItem(materialStorageKey, JSON.stringify(importedMaterials))
      setProducts(importedProducts)
      setMaterials(importedMaterials)
      resetProductForm()
      handleCancelSaleForm()
      setExpandedSections({})
      setProductMessage('バックアップデータを復元しました。')
      setProductError('')
      setMaterialMessage('')
      setMaterialError('')
      setSaleMessage('')
      setBillingMessage('')
    } catch (error) {
      setProductMessage('')
      setProductError(
        error instanceof Error ? error.message : 'バックアップデータを読み込めませんでした。',
      )
    }
  }

  const handleResetSavedProducts = () => {
    if (!window.confirm('すべての商品データを削除します。よろしいですか？')) {
      return
    }

    shouldSkipNextProductSave.current = true
    localStorage.removeItem(productStorageKey)
    localStorage.removeItem(legacyProductStorageKey)
    localStorage.removeItem(legacyProductSequenceStorageKey)
    setProducts([])
    resetProductForm()
    handleCancelSaleForm()
    setExpandedSections({})
    setProductMessage('保存データをリセットしました。')
    setProductError('')
    setSaleMessage('')
    setBillingMessage('')
  }

  const renderBillingProductCard = (product: Product, variant: 'pending' | 'billed') => (
    <article className="billing-product-card" key={product.id}>
      <div className="billing-product-header">
        <div>
          <h4>{product.name}</h4>
          <p>
            {product.code || '商品番号なし'} / {getCategoryLabel(product.category)}
          </p>
        </div>
        <span className={variant === 'billed' ? 'billing-status billed' : 'billing-status'}>
          {variant === 'billed' ? '精算済み' : '精算待ち'}
        </span>
      </div>

      <div className="billing-product-meta">
        <span>販売日：{product.soldDate || '未入力'}</span>
        {variant === 'billed' && <span>精算済み日：{product.billedDate || '未入力'}</span>}
        <span>
          販売先：
          {product.marketplace ? getChannelLabel(product.marketplace) : '未入力'}
        </span>
      </div>

      <div className="billing-product-amounts">
        <div>
          <span>販売価格</span>
          <strong>{formatYen(product.soldPrice ?? 0)}</strong>
        </div>
        <div className="billing-amount-highlight">
          <span>請求額</span>
          <strong>{formatYen(product.billingAmount ?? 0)}</strong>
        </div>
        <div>
          <span>販売者利益</span>
          <strong>{formatYen(product.sellerProfit ?? 0)}</strong>
        </div>
      </div>

      {variant === 'pending' ? (
        <button
          className="billing-primary-button"
          type="button"
          onClick={() => handleMarkAsBilled(product.id)}
        >
          精算済みにする
        </button>
      ) : (
        <button
          className="billing-secondary-button"
          type="button"
          onClick={() => handleReturnToPendingBilling(product.id)}
        >
          精算待ちに戻す
        </button>
      )}
    </article>
  )

  const renderSalesBreakdownCard = (
    title: string,
    stats: ReturnType<typeof createSalesStats>,
  ) => (
    <article className="sales-breakdown-card" key={title}>
      <h4>{title}</h4>
      <div className="sales-breakdown-grid">
        <div>
          <span>販売件数</span>
          <strong>{stats.count}件</strong>
        </div>
        <div>
          <span>総販売額</span>
          <strong>{formatYen(stats.totalSales)}</strong>
        </div>
        <div>
          <span>利益合計</span>
          <strong>{formatYen(stats.totalSellerProfit)}</strong>
        </div>
        <div>
          <span>平均単価</span>
          <strong>{formatYen(stats.averageSales)}</strong>
        </div>
      </div>
    </article>
  )

  const renderSalesResultCard = (product: Product) => (
    <article className="sales-result-card" key={product.id}>
      <div className="sales-result-header">
        <div>
          <span>{product.soldDate || '販売日未入力'}</span>
          <h4>{product.name}</h4>
          <p>
            {product.code || '商品番号なし'} / {getCategoryLabel(product.category)}
          </p>
        </div>
        <span className={product.status === '請求済み' ? 'sales-status billed' : 'sales-status'}>
          {getProductStatusLabel(product.status)}
        </span>
      </div>

      <div className="sales-result-meta">
        <span>
          販売先：
          {product.marketplace ? getChannelLabel(product.marketplace) : '未入力'}
        </span>
      </div>

      <div className="sales-result-amounts">
        <div>
          <span>販売価格</span>
          <strong>{formatYen(product.soldPrice ?? 0)}</strong>
        </div>
        <div>
          <span>請求額</span>
          <strong>{formatYen(product.billingAmount ?? 0)}</strong>
        </div>
        <div>
          <span>販売者利益</span>
          <strong>{formatYen(product.sellerProfit ?? 0)}</strong>
        </div>
        <div>
          <span>利益率</span>
          <strong>{formatPercent(product.profitRate ?? 0)}</strong>
        </div>
      </div>
    </article>
  )

  const renderDataManagementPanel = () => (
    <div className="data-management-panel">
      <div className="data-management-copy">
        <strong>データ管理</strong>
        <p>CSVは表計算ソフト確認用、JSONはアプリ復元用のバックアップです。</p>
        <small>機種やブラウザによって、保存先や開き方が異なる場合があります。</small>
      </div>

      {productError && <p className="form-message error">{productError}</p>}
      {productMessage && <p className="form-message success">{productMessage}</p>}

      <div className="data-management-actions">
        <button className="data-action-button" type="button" onClick={handleExportCsv}>
          CSVエクスポート
        </button>
        <button
          className="data-action-button"
          type="button"
          onClick={handleExportJsonBackup}
        >
          JSONバックアップ
        </button>
        <button
          className="data-action-button"
          type="button"
          onClick={handleOpenImportBackup}
        >
          JSONインポート
        </button>
        <button
          className="data-action-button danger"
          type="button"
          onClick={handleResetSavedProducts}
        >
          保存データをリセット
        </button>
      </div>

      <input
        ref={importFileInputRef}
        className="hidden-file-input"
        accept="application/json,.json"
        type="file"
        onChange={handleImportBackup}
      />
    </div>
  )

  const renderContent = () => {
    if (activeScreen === 'dashboard') {
      return (
        <div className="dashboard-layout">
          <section className="dashboard-section-card cumulative-summary-card" aria-labelledby="cumulative-summary-title">
            <div className="dashboard-section-heading">
              <h3 id="cumulative-summary-title">累計サマリー</h3>
              <span>{overallSalesStats.count}件売却</span>
            </div>
            <div className="cumulative-total-list">
              <article>
                <span>累計売上</span>
                <strong>{formatYen(overallSalesStats.totalSales)}</strong>
              </article>
              <article>
                <span>累計請求額</span>
                <strong>{formatYen(overallSalesStats.totalBilling)}</strong>
              </article>
              <article>
                <span>累計利益</span>
                <strong>{formatYen(overallSalesStats.totalSellerProfit)}</strong>
              </article>
            </div>
          </section>

          <section className="dashboard-section-card today-summary-card" aria-labelledby="today-status-title">
            <div className="dashboard-section-heading">
              <h3 id="today-status-title">今日の状況</h3>
              <span>{todayString}</span>
            </div>
            <div className="dashboard-metric-grid">
              <article>
                <span>本日の販売件数</span>
                <strong>{todaySalesStats.count}件</strong>
              </article>
              <article>
                <span>本日の販売額</span>
                <strong>{formatYen(todaySalesStats.totalSales)}</strong>
              </article>
              <article>
                <span>本日の請求額</span>
                <strong>{formatYen(todaySalesStats.totalBilling)}</strong>
              </article>
              <article>
                <span>本日の販売者利益</span>
                <strong>{formatYen(todaySalesStats.totalSellerProfit)}</strong>
              </article>
            </div>
          </section>

          <section
            className={
              allPendingBillingProducts.length > 0
                ? 'dashboard-section-card settlement-alert-card dashboard-alert-card'
                : 'dashboard-section-card settlement-alert-card dashboard-muted-card'
            }
            aria-labelledby="billing-alert-title"
          >
            <div className="dashboard-section-heading">
              <h3 id="billing-alert-title">請求・精算アラート</h3>
            </div>
            {allPendingBillingProducts.length > 0 ? (
              <>
                <p className="dashboard-alert-text">
                  精算待ちが {allPendingBillingProducts.length}件あります。
                </p>
                <div className="dashboard-settlement-grid">
                  <div className="dashboard-alert-amount">
                    <span>精算待ち合計額</span>
                    <strong>{formatYen(pendingBillingTotal)}</strong>
                  </div>
                  <div className="dashboard-alert-amount">
                    <span>精算基準額</span>
                    <strong>{formatYen(settlementThreshold)}</strong>
                  </div>
                  <div className="dashboard-alert-amount">
                    <span>基準額まであと</span>
                    <strong>{formatYen(remainingSettlementAmount)}</strong>
                  </div>
                </div>
                <p
                  className={
                    hasReachedSettlementThreshold
                      ? 'settlement-status reached'
                      : 'settlement-status'
                  }
                >
                  {hasReachedSettlementThreshold
                    ? '精算目安に到達しました'
                    : 'まだ精算目安未満です'}
                </p>
                <button
                  className="dashboard-action-button"
                  type="button"
                  onClick={() => setActiveScreen('billing')}
                >
                  請求・精算管理を開く
                </button>
              </>
            ) : (
              <p className="dashboard-muted-text">精算待ちはありません</p>
            )}
          </section>

          <section className="dashboard-section-card relist-alert-card" aria-labelledby="price-drop-alert-title">
            <div className="dashboard-section-heading">
              <h3 id="price-drop-alert-title">値下げ運用アラート</h3>
            </div>
            {relistAlertProducts.length > 0 ? (
              <>
                <p className="dashboard-alert-text">
                  再出品検討の商品があります。対象：{relistAlertProducts.length}件
                </p>
                <div className="dashboard-mini-list">
                  {relistAlertProducts.slice(0, 3).map((product) => (
                    <article key={product.id}>
                      <div>
                        <strong>{product.name}</strong>
                        <span>{product.code || '商品番号なし'}</span>
                      </div>
                      <em>{formatYen(product.internalLowestPrice)}</em>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p className="dashboard-muted-text">再出品検討の商品はありません</p>
            )}
          </section>

          <section className="dashboard-section-card recent-sales-card" aria-labelledby="recent-sales-title">
            <div className="dashboard-section-heading">
              <h3 id="recent-sales-title">最近の販売</h3>
              <span>直近5件</span>
            </div>
            {recentSalesProducts.length === 0 ? (
              <p className="dashboard-muted-text">まだ販売実績はありません</p>
            ) : (
              <div className="recent-sales-list">
                {recentSalesProducts.map((product) => (
                  <article key={product.id}>
                    <div className="recent-sales-header">
                      <div>
                        <span>{product.soldDate || '販売日未入力'}</span>
                        <strong>{product.name}</strong>
                      </div>
                      <em>{product.marketplace ? getChannelLabel(product.marketplace) : '未入力'}</em>
                    </div>
                    <div className="recent-sales-amounts">
                      <div>
                        <span>販売価格</span>
                        <strong>{formatYen(product.soldPrice ?? 0)}</strong>
                      </div>
                      <div>
                        <span>請求額</span>
                        <strong>{formatYen(product.billingAmount ?? 0)}</strong>
                      </div>
                      <div>
                        <span>販売者利益</span>
                        <strong>{formatYen(product.sellerProfit ?? 0)}</strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="quick-section dashboard-section-card" aria-labelledby="quick-actions-title">
            <h3 id="quick-actions-title">クイック操作</h3>
            <div className="quick-action-grid">
              {quickActions.map((action) => (
                <button
                  className="quick-action-card"
                  key={action.label}
                  type="button"
                  onClick={() => setActiveScreen(action.target)}
                >
                  <span>{action.label}</span>
                  <small>{action.description}</small>
                </button>
              ))}
            </div>
          </section>

          {renderDataManagementPanel()}
        </div>
      )
    }

    if (activeScreen === 'simulation') {
      return (
        <div className="simulation-layout">
          <section className="form-card" aria-label="販売利益シミュレーション入力">
            <label className="field-group">
              <span>販売先</span>
              <select
                value={salesChannel}
                onChange={(event) => handleSalesChannelChange(event.target.value as SalesChannelId)}
              >
                {salesChannels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>商品種別</span>
              <select
                value={productType}
                onChange={(event) => setProductType(event.target.value as ProductTypeId)}
              >
                {productTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>販売価格</span>
              <div className="input-with-unit">
                <input
                  inputMode="numeric"
                  min="0"
                  pattern="[0-9]*"
                  placeholder="例：10000"
                  type="number"
                  value={salePriceInput}
                  onChange={(event) => setSalePriceInput(event.target.value)}
                />
                <span>円</span>
              </div>
            </label>

            <label className="field-group">
              <span>送料</span>
              <div className="input-with-unit">
                <input
                  inputMode="numeric"
                  min="0"
                  pattern="[0-9]*"
                  type="number"
                  value={shippingFeeInput}
                  onChange={(event) => setShippingFeeInput(event.target.value)}
                />
                <span>円</span>
              </div>
            </label>

            <label className="field-group">
              <span>販売手数料率（％）</span>
              <div className="input-with-unit">
                <input
                  inputMode="decimal"
                  max="100"
                  min="0"
                  step="0.1"
                  type="number"
                  value={feeRateInput}
                  onChange={(event) => setFeeRateInput(event.target.value)}
                />
                <span>%</span>
              </div>
            </label>

            <div className="fee-rate-display">
              <span>現在の計算手数料率</span>
              <strong>{formatFeeRate(salesResult.feeRate)}</strong>
            </div>
          </section>

          <section className="result-section" aria-label="計算結果">
            {salesResult.salePrice <= 0 && (
              <p className="input-hint">販売価格を入力すると計算結果が表示されます。</p>
            )}

            <div className="result-highlight-grid">
              <article className="result-highlight-card charge">
                <p>最終請求額</p>
                <strong>{formatYen(salesResult.finalCharge)}</strong>
              </article>
              <article className="result-highlight-card profit">
                <p>販売者利益</p>
                <strong>{formatYen(salesResult.sellerProfit)}</strong>
              </article>
            </div>

            <div
              className={
                salesResult.isMinimumChargeApplied
                  ? 'minimum-status applied'
                  : 'minimum-status'
              }
            >
              {salesResult.isMinimumChargeApplied ? '最低請求額適用' : '最低請求額適用なし'}
            </div>

            <div className="result-detail-list">
              {detailRows.map((row) => (
                <div className="result-detail-row" key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      )
    }

    if (activeScreen === 'products') {
      return (
        <div className="products-layout">
          <form className="form-card product-form" ref={productFormRef} onSubmit={handleProductSubmit}>
            <h3>{editingProductId ? '商品編集' : '商品登録'}</h3>

            {editingProduct && (
              <div className="editing-notice">
                <strong>商品情報を編集中</strong>
                <span>{editingProduct.code} を編集中</span>
                <p>内容を修正して、商品を更新するボタンを押してください。</p>
              </div>
            )}

            {productError && <p className="form-message error">{productError}</p>}
            {productMessage && <p className="form-message success">{productMessage}</p>}

            <label className="field-group">
              <span>商品名</span>
              <input
                placeholder="例：Nirvana バンドT"
                type="text"
                value={productForm.name}
                onChange={(event) => updateProductForm('name', event.target.value)}
              />
            </label>

            <label className="field-group">
              <span>商品種別</span>
              <select
                value={productForm.category}
                onChange={(event) =>
                  updateProductForm('category', event.target.value as ProductCategory)
                }
              >
                {productCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>出品開始価格</span>
              <small>最初に出品する価格</small>
              <div className="input-with-unit">
                <input
                  inputMode="numeric"
                  min="0"
                  pattern="[0-9]*"
                  placeholder="例：10000"
                  type="number"
                  value={productForm.startPrice}
                  onChange={(event) => updateProductForm('startPrice', event.target.value)}
                />
                <span>円</span>
              </div>
            </label>

            <label className="field-group">
              <span>売りたい価格</span>
              <small>値下げ後にこの価格へ戻します</small>
              <div className="input-with-unit">
                <input
                  inputMode="numeric"
                  min="0"
                  pattern="[0-9]*"
                  placeholder="例：10000"
                  type="number"
                  value={productForm.targetPrice}
                  onChange={(event) => updateProductForm('targetPrice', event.target.value)}
                />
                <span>円</span>
              </div>
            </label>

            <label className="field-group">
              <span>内部最低価格</span>
              <small>過去に一度でも到達した最安値</small>
              <div className="input-with-unit">
                <input
                  inputMode="numeric"
                  min="0"
                  pattern="[0-9]*"
                  placeholder="例：9500"
                  type="number"
                  value={productForm.internalLowestPrice}
                  onChange={(event) =>
                    updateProductForm('internalLowestPrice', event.target.value)
                  }
                />
                <span>円</span>
              </div>
            </label>

            <label className="field-group">
              <span>出品日</span>
              <input
                type="date"
                value={productForm.listingDate}
                onChange={(event) => updateProductForm('listingDate', event.target.value)}
              />
            </label>

            <label className="field-group">
              <span>ステータス</span>
              <select
                value={productForm.status}
                onChange={(event) => updateProductForm('status', event.target.value as ProductStatus)}
              >
                {productStatuses.map((status) => (
                  <option key={status} value={status}>
                    {getProductStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>メモ</span>
              <textarea
                placeholder="販売時の注意点・補足など"
                value={productForm.memo}
                onChange={(event) => updateProductForm('memo', event.target.value)}
              />
            </label>

            <button className="primary-submit-button" type="submit">
              {editingProductId ? '商品を更新する' : '商品を登録する'}
            </button>

            {editingProductId && (
              <button className="secondary-button" type="button" onClick={handleCancelEdit}>
                編集をキャンセル
              </button>
            )}
          </form>

          <section className="product-list-section" aria-labelledby="product-list-title">
            <h3 id="product-list-title">登録済み商品一覧</h3>
            {saleMessage && (
              <div className="sale-complete-message">
                <p className="form-message success">{saleMessage}</p>
                <button
                  className="dashboard-action-button"
                  type="button"
                  onClick={() => setActiveScreen('billing')}
                >
                  請求・精算管理を開く
                </button>
              </div>
            )}

            <div className="product-list-controls">
              <div className="product-counts">
                <span>
                  表示中：{filteredProducts.length}件 / 全{products.length}件
                </span>
              </div>

              <label className="field-group">
                <span>商品検索</span>
                <input
                  placeholder="商品名・商品番号で検索"
                  type="search"
                  value={productSearchQuery}
                  onChange={(event) => setProductSearchQuery(event.target.value)}
                />
              </label>

              <label className="field-group">
                <span>ステータス</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                >
                  <option value="すべて">すべて</option>
                  {productStatusFilterOptions.map((status) => (
                    <option key={status} value={status}>
                      {getProductStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-group">
                <span>商品種別</span>
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
                >
                  <option value="すべて">すべて</option>
                  {productCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-group">
                <span>販売先</span>
                <select
                  value={marketplaceFilter}
                  onChange={(event) =>
                    setMarketplaceFilter(event.target.value as MarketplaceFilter)
                  }
                >
                  {productMarketplaceFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-group">
                <span>並び替え</span>
                <select
                  value={productSortOption}
                  onChange={(event) =>
                    setProductSortOption(event.target.value as ProductSortOption)
                  }
                >
                  {productSortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <button className="filter-reset-button" type="button" onClick={handleResetProductFilters}>
                絞り込みをリセット
              </button>
            </div>

            {products.length === 0 ? (
              <p className="empty-list-message">まだ登録された商品はありません</p>
            ) : filteredProducts.length === 0 ? (
              <p className="empty-list-message">条件に一致する商品はありません</p>
            ) : (
              <div className="product-card-list">
                {filteredProducts.map((product) => {
                  const priceDropInfo = calculatePriceDropInfo(product)
                  const isDetailExpanded = isSectionExpanded(product.id, 'detail')
                  const isSold = product.soldPrice !== undefined
                  const isPendingSettlement = product.status === '請求待ち'
                  const isSettled = product.status === '請求済み'

                  return (
                    <article className="product-card" key={product.id}>
                      <div className="product-card-main">
                        <div className="product-summary">
                          <div className="product-meta-row">
                            <div className="product-meta-info">
                              <span className="product-date">
                                {isSold
                                  ? product.soldDate || '販売日未入力'
                                  : product.listingDate || '未出品'}
                              </span>
                              <span
                                className={
                                  isSettled
                                    ? 'product-badge settled'
                                    : isPendingSettlement
                                      ? 'product-badge pending'
                                      : isSold
                                        ? 'product-badge sold'
                                        : 'product-badge'
                                }
                              >
                                {isSettled
                                  ? '精算済み'
                                  : isPendingSettlement
                                    ? '精算待ち'
                                    : isSold && product.marketplace
                                      ? getChannelLabel(product.marketplace)
                                      : getProductStatusLabel(product.status)}
                              </span>
                            </div>
                            <button
                              className="detail-toggle-button"
                              type="button"
                              onClick={() => toggleProductSection(product.id, 'detail')}
                            >
                              {isDetailExpanded ? '閉じる' : '詳細'}
                            </button>
                          </div>

                          <h4 className="product-title">{product.name}</h4>
                          <p className="product-code">{product.code || '商品番号なし'}</p>
                          <p className="product-category-line">{getCategoryLabel(product.category)}</p>
                          <div className="product-metrics">
                            {isSold ? (
                              <>
                                <div className="metric-item">
                                  <span>売価</span>
                                  <strong>{formatYen(product.soldPrice ?? 0)}</strong>
                                </div>
                                <div className="metric-item">
                                  <span>利益</span>
                                  <strong>{formatYen(product.sellerProfit ?? 0)}</strong>
                                </div>
                                <div className="metric-item">
                                  <span>利益率</span>
                                  <strong>{formatPercent(product.profitRate ?? 0)}</strong>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="metric-item">
                                  <span>内部最低</span>
                                  <strong>{formatYen(product.internalLowestPrice)}</strong>
                                </div>
                                <div className="metric-item">
                                  <span>売りたい</span>
                                  <strong>{formatYen(product.targetPrice)}</strong>
                                </div>
                                <div className="metric-item">
                                  <span>次回価格</span>
                                  <strong>
                                    {priceDropInfo.hasInternalLowestPrice
                                      ? formatYen(priceDropInfo.nextDiscountPrice)
                                      : '未計算'}
                                  </strong>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {!isDetailExpanded && (
                        <div className="product-card-cta">
                          {!isSold && (
                            <>
                              <button
                                className="sale-product-button"
                                type="button"
                                onClick={() => handleOpenSaleForm(product)}
                              >
                                売却登録する
                              </button>
                              <p>売れたら販売価格・送料を登録します</p>
                            </>
                          )}
                          {isPendingSettlement && (
                            <>
                              <button
                                className="sale-product-button"
                                type="button"
                                onClick={() => setActiveScreen('billing')}
                              >
                                請求・精算管理を開く
                              </button>
                              <p>この商品は精算待ちです</p>
                            </>
                          )}
                          {isSettled && <p className="settled-note">精算済みの商品です</p>}
                        </div>
                      )}

                      {isDetailExpanded && (
                        <div className="product-detail-panel">
                          <section className="detail-panel-section" aria-label="商品詳細">
                            <h5>商品詳細</h5>
                            <div className="detail-grid">
                              <div className="detail-box">
                                <span>商品番号</span>
                                <strong>{product.code || '商品番号なし'}</strong>
                              </div>
                              <div className="detail-box">
                                <span>商品種別</span>
                                <strong>{getCategoryLabel(product.category)}</strong>
                              </div>
                              <div className="detail-box">
                                <span>出品開始価格</span>
                                <strong>{formatYen(product.startPrice)}</strong>
                              </div>
                              <div className="detail-box">
                                <span>売りたい価格</span>
                                <strong>{formatYen(product.targetPrice)}</strong>
                              </div>
                              <div className="detail-box">
                                <span>内部最低価格</span>
                                <strong>{formatYen(product.internalLowestPrice)}</strong>
                              </div>
                              <div className="detail-box">
                                <span>出品日</span>
                                <strong>{product.listingDate || '未出品'}</strong>
                              </div>
                              <div className="detail-box full">
                                <span>メモ</span>
                                <strong>{product.memo || 'メモなし'}</strong>
                              </div>
                            </div>
                          </section>

                          <section className="detail-panel-section" aria-label="値下げ運用">
                            <h5>値下げ運用</h5>
                            {!priceDropInfo.hasInternalLowestPrice ? (
                              <p className="price-drop-guidance">{priceDropInfo.guidance}</p>
                            ) : (
                              <>
                                <div className="detail-grid">
                                  <div className="detail-box">
                                    <span>次回減額</span>
                                    <strong>{formatYen(priceDropInfo.nextDiscountAmount)}</strong>
                                  </div>
                                  <div className="detail-box">
                                    <span>次回値下げ後価格</span>
                                    <strong>{formatYen(priceDropInfo.nextDiscountPrice)}</strong>
                                  </div>
                                  <div className="detail-box">
                                    <span>運用判定</span>
                                    <strong>{priceDropInfo.operationStatus}</strong>
                                  </div>
                                  <div className="detail-box">
                                    <span>割引頻度目安</span>
                                    <strong>2日に1回推奨</strong>
                                  </div>
                                </div>
                                <p className="price-drop-rounding">
                                  次回の減額額は50円単位で切り上げています
                                </p>
                                <p
                                  className={
                                    priceDropInfo.isRelistRecommended
                                      ? 'price-drop-return caution'
                                      : 'price-drop-return'
                                  }
                                >
                                  注意：{priceDropInfo.returnPriceMessage}
                                </p>
                              </>
                            )}
                          </section>

                          {isSold && (
                            <section className="detail-panel-section" aria-label="販売情報">
                              <h5>販売情報</h5>
                              <div className="detail-grid">
                                <div className="detail-box">
                                  <span>販売日</span>
                                  <strong>{product.soldDate || '未入力'}</strong>
                                </div>
                                <div className="detail-box">
                                  <span>販売先</span>
                                  <strong>
                                    {product.marketplace
                                      ? getChannelLabel(product.marketplace)
                                      : '未入力'}
                                  </strong>
                                </div>
                                <div className="detail-box">
                                  <span>販売価格</span>
                                  <strong>{formatYen(product.soldPrice ?? 0)}</strong>
                                </div>
                                <div className="detail-box">
                                  <span>送料</span>
                                  <strong>{formatYen(product.shippingFee ?? 0)}</strong>
                                </div>
                                <div className="detail-box">
                                  <span>販売手数料率</span>
                                  <strong>{formatFeeRate(product.feeRate ?? 0)}</strong>
                                </div>
                                <div className="detail-box">
                                  <span>販売手数料</span>
                                  <strong>{formatYen(product.platformFee ?? 0)}</strong>
                                </div>
                                <div className="detail-box">
                                  <span>手数料後売価</span>
                                  <strong>{formatYen(product.netSales ?? 0)}</strong>
                                </div>
                                <div className="detail-box">
                                  <span>請求額</span>
                                  <strong>{formatYen(product.billingAmount ?? 0)}</strong>
                                </div>
                                <div className="detail-box">
                                  <span>販売者利益</span>
                                  <strong>{formatYen(product.sellerProfit ?? 0)}</strong>
                                </div>
                                <div className="detail-box">
                                  <span>利益率</span>
                                  <strong>{formatPercent(product.profitRate ?? 0)}</strong>
                                </div>
                              </div>
                            </section>
                          )}

                          <section className="detail-panel-section" aria-label="操作">
                            <h5>操作</h5>
                            <div
                              className={
                                isSettled
                                  ? 'product-next-step settled'
                                  : isPendingSettlement
                                    ? 'product-next-step pending'
                                    : 'product-next-step'
                              }
                            >
                              <strong>
                                {isSettled
                                  ? '精算済みです'
                                  : isPendingSettlement
                                    ? '精算待ちです'
                                    : '販売中です'}
                              </strong>
                              <span>
                                {isSettled
                                  ? '必要に応じて売却情報を確認・編集できます。'
                                  : isPendingSettlement
                                    ? '次は請求・精算管理で精算済みにします。'
                                    : '売れたら販売価格・送料を登録します。'}
                              </span>
                            </div>
                            <div className="action-buttons">
                              {!isSold && (
                                <button
                                  className="sale-product-button"
                                  type="button"
                                  onClick={() => handleOpenSaleForm(product)}
                                >
                                  売却登録する
                                </button>
                              )}
                              {isPendingSettlement && (
                                <button
                                  className="sale-product-button"
                                  type="button"
                                  onClick={() => setActiveScreen('billing')}
                                >
                                  請求・精算管理を開く
                                </button>
                              )}
                              {isSold && !isSettled && (
                                <button
                                  className="edit-product-button"
                                  type="button"
                                  onClick={() => handleOpenSaleForm(product)}
                                >
                                  売却情報を編集
                                </button>
                              )}
                              {isSettled && (
                                <button
                                  className="edit-product-button"
                                  type="button"
                                  onClick={() => handleOpenSaleForm(product)}
                                >
                                  売却情報を確認・編集
                                </button>
                              )}
                              <button
                                className="edit-product-button"
                                type="button"
                                onClick={() => handleEditProduct(product)}
                              >
                                商品情報を編集
                              </button>
                              <button
                                className="delete-product-button"
                                type="button"
                                onClick={() => handleDeleteProduct(product.id)}
                              >
                                削除
                              </button>
                            </div>
                          </section>

                          {activeSaleProductId === product.id && activeSaleResult && (
                            <section className="sale-form-section" aria-label="売却登録フォーム">
                              <h5>{isSold ? '売却情報を編集' : '売却登録'}</h5>
                              <p className="sale-form-description">
                                売れた商品の販売価格・送料を登録すると、請求額と利益が自動計算されます。
                              </p>

                              {saleError && <p className="form-message error">{saleError}</p>}
                              {saleMessage && <p className="form-message success">{saleMessage}</p>}

                              <label className="field-group">
                                <span>販売日</span>
                                <input
                                  type="date"
                                  value={saleForm.soldDate}
                                  onChange={(event) => updateSaleForm('soldDate', event.target.value)}
                                />
                              </label>

                              <label className="field-group">
                                <span>販売先</span>
                                <select
                                  value={saleForm.marketplace}
                                  onChange={(event) =>
                                    handleSaleMarketplaceChange(event.target.value as SalesChannelId)
                                  }
                                >
                                  {salesChannels.map((channel) => (
                                    <option key={channel.id} value={channel.id}>
                                      {channel.label}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="field-group">
                                <span>販売価格</span>
                                <div className="input-with-unit">
                                  <input
                                    inputMode="numeric"
                                    min="0"
                                    pattern="[0-9]*"
                                    placeholder="例：10000"
                                    type="number"
                                    value={saleForm.soldPrice}
                                    onChange={(event) =>
                                      updateSaleForm('soldPrice', event.target.value)
                                    }
                                  />
                                  <span>円</span>
                                </div>
                              </label>

                              <label className="field-group">
                                <span>送料</span>
                                <div className="input-with-unit">
                                  <input
                                    inputMode="numeric"
                                    min="0"
                                    pattern="[0-9]*"
                                    type="number"
                                    value={saleForm.shippingFee}
                                    onChange={(event) =>
                                      updateSaleForm('shippingFee', event.target.value)
                                    }
                                  />
                                  <span>円</span>
                                </div>
                              </label>

                              <label className="field-group">
                                <span>販売手数料率（％）</span>
                                <div className="input-with-unit">
                                  <input
                                    inputMode="decimal"
                                    max="100"
                                    min="0"
                                    step="0.1"
                                    type="number"
                                    value={saleForm.feeRate}
                                    onChange={(event) => updateSaleForm('feeRate', event.target.value)}
                                  />
                                  <span>%</span>
                                </div>
                              </label>

                              <div className="sale-result-highlight">
                                <article>
                                  <span>最終請求額</span>
                                  <strong>{formatYen(activeSaleResult.finalCharge)}</strong>
                                </article>
                                <article>
                                  <span>販売者利益</span>
                                  <strong>{formatYen(activeSaleResult.sellerProfit)}</strong>
                                </article>
                              </div>

                              <dl className="sale-calculation-list">
                                <div>
                                  <dt>販売手数料</dt>
                                  <dd>{formatYen(activeSaleResult.salesFee)}</dd>
                                </div>
                                <div>
                                  <dt>手数料後売価</dt>
                                  <dd>{formatYen(activeSaleResult.priceAfterFee)}</dd>
                                </div>
                                <div>
                                  <dt>利益率</dt>
                                  <dd>{formatPercent(activeSaleResult.profitRate)}</dd>
                                </div>
                                <div>
                                  <dt>最低請求額</dt>
                                  <dd>
                                    {activeSaleResult.isMinimumChargeApplied
                                      ? '最低請求額適用'
                                      : '最低請求額適用なし'}
                                  </dd>
                                </div>
                              </dl>

                              <div className="sale-form-actions">
                                <p className="sale-form-note">
                                  保存後、この商品は精算待ちとして管理されます。
                                </p>
                                <button
                                  className="primary-submit-button"
                                  type="button"
                                  onClick={() => handleSaleSubmit(product)}
                                >
                                  {isSold ? '売却情報を更新する' : '売却完了として登録'}
                                </button>
                                <button
                                  className="secondary-button"
                                  type="button"
                                  onClick={handleCancelSaleForm}
                                >
                                  キャンセル
                                </button>
                              </div>
                            </section>
                          )}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}

            {renderDataManagementPanel()}
          </section>
        </div>
      )
    }

    if (activeScreen === 'billing') {
      return (
        <div className="billing-layout">
          {billingMessage && <p className="form-message success">{billingMessage}</p>}

          <section className="settlement-status-card" aria-labelledby="settlement-status-title">
            <div className="billing-section-heading">
              <h3 id="settlement-status-title">精算状況</h3>
            </div>

            <label className="field-group">
              <span>精算基準額</span>
              <small>精算待ちの請求額合計がこの金額に達したら、精算目安として表示します。</small>
              <div className="input-with-unit">
                <input
                  inputMode="numeric"
                  min="1"
                  pattern="[0-9]*"
                  type="number"
                  value={settlementThresholdInput}
                  onBlur={handleSettlementThresholdBlur}
                  onChange={(event) => setSettlementThresholdInput(event.target.value)}
                />
                <span>円</span>
              </div>
            </label>

            <div className="settlement-status-grid">
              <article>
                <span>精算待ち合計額</span>
                <strong>{formatYen(billingSummary.pendingTotal)}</strong>
              </article>
              <article>
                <span>精算基準額</span>
                <strong>{formatYen(settlementThreshold)}</strong>
              </article>
              <article>
                <span>基準額まであと</span>
                <strong>{formatYen(remainingSettlementAmount)}</strong>
              </article>
            </div>

            <p
              className={
                hasReachedSettlementThreshold
                  ? 'settlement-status reached'
                  : 'settlement-status'
              }
            >
              {hasReachedSettlementThreshold
                ? '精算目安に到達しました'
                : 'まだ精算目安未満です'}
            </p>
          </section>

          <section className="billing-summary-card" aria-labelledby="billing-summary-title">
            <h3 id="billing-summary-title">請求・精算サマリー</h3>
            <div className="billing-summary-grid">
              <article>
                <span>精算待ち件数</span>
                <strong>{billingSummary.pendingCount}件</strong>
              </article>
              <article>
                <span>精算待ち合計額</span>
                <strong>{formatYen(billingSummary.pendingTotal)}</strong>
              </article>
              <article>
                <span>精算済み件数</span>
                <strong>{billingSummary.billedCount}件</strong>
              </article>
              <article>
                <span>精算済み合計額</span>
                <strong>{formatYen(billingSummary.billedTotal)}</strong>
              </article>
              <article className="billing-summary-wide">
                <span>売却済み商品の販売者利益合計</span>
                <strong>{formatYen(billingSummary.sellerProfitTotal)}</strong>
              </article>
            </div>
          </section>

          <section className="billing-list-section" aria-labelledby="pending-billing-title">
            <div className="billing-section-heading">
              <h3 id="pending-billing-title">精算待ち一覧</h3>
              <span>{pendingBillingProducts.length}件</span>
            </div>

            {pendingBillingProducts.length === 0 ? (
              <p className="empty-list-message">精算待ちの商品はありません</p>
            ) : (
              <div className="billing-card-list">
                {pendingBillingProducts.map((product) =>
                  renderBillingProductCard(product, 'pending'),
                )}
              </div>
            )}
          </section>

          <section className="billing-list-section" aria-labelledby="billed-products-title">
            <div className="billing-section-heading">
              <h3 id="billed-products-title">精算済み一覧</h3>
              <span>{billedProducts.length}件</span>
            </div>

            <button
              className="billing-toggle-button"
              type="button"
              onClick={() => setIsBilledListOpen((current) => !current)}
            >
              {isBilledListOpen ? '精算済み一覧を閉じる' : '精算済み一覧を開く'}
            </button>

            {isBilledListOpen &&
              (billedProducts.length === 0 ? (
                <p className="empty-list-message">精算済みの商品はありません</p>
              ) : (
                <div className="billing-card-list">
                  {billedProducts.map((product) => renderBillingProductCard(product, 'billed'))}
                </div>
              ))}
          </section>
        </div>
      )
    }

    if (activeScreen === 'sales') {
      return (
        <div className="sales-layout">
          <section className="sales-summary-card" aria-labelledby="sales-summary-title">
            <h3 id="sales-summary-title">販売実績サマリー</h3>
            <div className="sales-summary-grid">
              <article>
                <span>販売件数</span>
                <strong>{salesSummary.count}件</strong>
              </article>
              <article>
                <span>総販売額</span>
                <strong>{formatYen(salesSummary.totalSales)}</strong>
              </article>
              <article>
                <span>総請求額</span>
                <strong>{formatYen(salesSummary.totalBilling)}</strong>
              </article>
              <article>
                <span>利益合計</span>
                <strong>{formatYen(salesSummary.totalSellerProfit)}</strong>
              </article>
              <article>
                <span>平均販売単価</span>
                <strong>{formatYen(salesSummary.averageSales)}</strong>
              </article>
              <article>
                <span>平均請求額</span>
                <strong>{formatYen(salesSummary.averageBilling)}</strong>
              </article>
              <article>
                <span>平均販売者利益</span>
                <strong>{formatYen(salesSummary.averageSellerProfit)}</strong>
              </article>
              <article>
                <span>平均利益率</span>
                <strong>{formatPercent(salesSummary.averageProfitRate)}</strong>
              </article>
            </div>
          </section>

          <section className="sales-filter-card" aria-labelledby="sales-filter-title">
            <h3 id="sales-filter-title">絞り込み</h3>
            <label className="field-group">
              <span>対象月</span>
              <select
                value={salesMonthFilter}
                onChange={(event) => setSalesMonthFilter(event.target.value as MonthFilter)}
              >
                <option value="すべて">すべて</option>
                {salesMonthOptions.map((monthKey) => (
                  <option key={monthKey} value={monthKey}>
                    {formatMonthLabel(monthKey)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>販売先</span>
              <select
                value={salesChannelFilter}
                onChange={(event) =>
                  setSalesChannelFilter(event.target.value as SalesChannelId | 'すべて')
                }
              >
                <option value="すべて">すべて</option>
                {salesChannels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>商品種別</span>
              <select
                value={salesCategoryFilter}
                onChange={(event) => setSalesCategoryFilter(event.target.value as CategoryFilter)}
              >
                <option value="すべて">すべて</option>
                {productCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>請求ステータス</span>
              <select
                value={salesStatusFilter}
                onChange={(event) =>
                  setSalesStatusFilter(event.target.value as BillingStatusFilter)
                }
              >
                <option value="すべて">すべて</option>
                <option value="請求待ち">精算待ち</option>
                <option value="請求済み">精算済み</option>
              </select>
            </label>

          </section>

          {soldProducts.length === 0 ? (
            <p className="empty-list-message">まだ販売実績がありません</p>
          ) : (
            <>
              <section className="sales-section" aria-labelledby="category-sales-title">
                <h3 id="category-sales-title">商品種別別集計</h3>
                <div className="sales-breakdown-list">
                  {renderSalesBreakdownCard('半袖バンドT', shortSleeveSalesStats)}
                  {renderSalesBreakdownCard('長袖バンドT', longSleeveSalesStats)}
                </div>
              </section>

              <section className="sales-section" aria-labelledby="channel-sales-title">
                <h3 id="channel-sales-title">販売先別集計</h3>
                <div className="sales-breakdown-list">
                  {renderSalesBreakdownCard('メルカリ', mercariSalesStats)}
                  {renderSalesBreakdownCard('ヤフーフリマ', yahooSalesStats)}
                </div>
              </section>

              <section className="sales-section" aria-labelledby="sales-list-title">
                <div className="sales-section-heading">
                  <h3 id="sales-list-title">販売実績一覧</h3>
                  <span>{filteredSalesProducts.length}件</span>
                </div>

                {filteredSalesProducts.length === 0 ? (
                  <p className="empty-list-message">条件に一致する販売実績はありません</p>
                ) : (
                  <div className="sales-result-list">
                    {filteredSalesProducts.map((product) => renderSalesResultCard(product))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )
    }

    if (activeScreen === 'resources') {
      return (
        <div className="rules-layout">
          <section className="rules-intro-card" aria-labelledby="rules-title">
            <h3 id="rules-title">販売ルール・資料</h3>
            <p>販売運用・値下げ・請求ルールを確認できます</p>
          </section>

          <div className="rules-section-list">
            {ruleSections.map((section) => {
              const isOpen = openRuleSectionIds.includes(section.id)

              return (
                <article className="rules-section-card" key={section.id}>
                  <button
                    className="rules-toggle-button"
                    type="button"
                    onClick={() => toggleRuleSection(section.id)}
                  >
                    <span>{section.title}</span>
                    <strong>{isOpen ? `${section.title}を閉じる` : `${section.title}を開く`}</strong>
                  </button>

                  {isOpen && (
                    <div className="rules-section-body">
                      {section.lead && <p className="rules-lead">{section.lead}</p>}

                      {section.items && (
                        <ul className="rules-list">
                          {section.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      )}

                      {section.example && (
                        <div className="rules-example-box">
                          <strong>例</strong>
                          <ul>
                            {section.example.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {section.note && <p className="rules-note">{section.note}</p>}
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          <section className="materials-card" aria-labelledby="materials-title">
            <div className="materials-heading">
              <h3 id="materials-title">資料管理</h3>
              <p>販売データ資料・運用資料・PDF資料を登録して確認できます。</p>
            </div>

            <form className="materials-form" onSubmit={handleMaterialSubmit}>
              <h4>資料登録</h4>

              {materialError && <p className="form-message error">{materialError}</p>}
              {materialMessage && <p className="form-message success">{materialMessage}</p>}

              <label className="field-group">
                <span>資料名</span>
                <input
                  placeholder="例：販売データ資料"
                  type="text"
                  value={materialForm.title}
                  onChange={(event) => updateMaterialForm('title', event.target.value)}
                />
              </label>

              <label className="field-group">
                <span>カテゴリ</span>
                <select
                  value={materialForm.category}
                  onChange={(event) =>
                    updateMaterialForm('category', event.target.value as MaterialCategory)
                  }
                >
                  {materialCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-group">
                <span>登録方法</span>
                <select
                  value={materialForm.type}
                  onChange={(event) => handleMaterialTypeChange(event.target.value as MaterialType)}
                >
                  <option value="link">URLで登録</option>
                  <option value="file">PDFファイルで登録</option>
                </select>
              </label>

              {materialForm.type === 'link' ? (
                <label className="field-group">
                  <span>URL</span>
                  <input
                    inputMode="url"
                    placeholder="https://example.com/manual.pdf"
                    type="url"
                    value={materialForm.url}
                    onChange={(event) => updateMaterialForm('url', event.target.value)}
                  />
                </label>
              ) : (
                <label className="field-group">
                  <span>PDFファイル</span>
                  <input
                    ref={materialFileInputRef}
                    accept=".pdf,application/pdf"
                    type="file"
                    onChange={handleMaterialFileChange}
                  />
                  {materialForm.fileName && <small>選択中：{materialForm.fileName}</small>}
                </label>
              )}

              <p className="materials-warning">
                PDFファイルは容量が大きいと保存できない場合があります。大きな資料はURL登録を推奨します。
              </p>

              <label className="field-group">
                <span>説明文</span>
                <textarea
                  placeholder="資料の内容や使う場面を入力"
                  value={materialForm.description}
                  onChange={(event) => updateMaterialForm('description', event.target.value)}
                />
              </label>

              <button className="primary-submit-button" type="submit">
                資料を登録する
              </button>
            </form>

            <div className="materials-filter-card">
              <label className="field-group">
                <span>資料検索</span>
                <input
                  placeholder="資料名・説明文で検索"
                  type="search"
                  value={materialSearchQuery}
                  onChange={(event) => setMaterialSearchQuery(event.target.value)}
                />
              </label>

              <label className="field-group">
                <span>カテゴリ</span>
                <select
                  value={materialCategoryFilter}
                  onChange={(event) =>
                    setMaterialCategoryFilter(event.target.value as MaterialCategoryFilter)
                  }
                >
                  <option value="すべて">すべて</option>
                  {materialCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="materials-count">
                表示中：{filteredMaterials.length}件 / 全{materials.length}件
              </div>
            </div>

            {materials.length === 0 ? (
              <p className="empty-list-message">登録済み資料はありません</p>
            ) : filteredMaterials.length === 0 ? (
              <p className="empty-list-message">条件に一致する資料はありません</p>
            ) : (
              <div className="materials-list">
                {filteredMaterials.map((material) => (
                  <article className="material-item-card" key={material.id}>
                    <div className="material-item-header">
                      <div>
                        <span className="material-category-badge">
                          {getMaterialCategoryLabel(material.category)}
                        </span>
                        <h4>{material.title}</h4>
                      </div>
                      <span className="material-type-badge">
                        {getMaterialTypeLabel(material.type)}
                      </span>
                    </div>

                    <dl className="material-detail-list">
                      <div>
                        <dt>{material.type === 'file' ? 'ファイル名' : 'URL'}</dt>
                        <dd>
                          {material.type === 'file'
                            ? material.fileName || 'ファイル名なし'
                            : material.url || 'URL未登録'}
                        </dd>
                      </div>
                      <div>
                        <dt>登録日</dt>
                        <dd>{material.createdAt.split('T')[0]}</dd>
                      </div>
                      <div>
                        <dt>説明文</dt>
                        <dd>{material.description || '説明文なし'}</dd>
                      </div>
                    </dl>

                    {material.type === 'file' && (
                      <p className="materials-help">
                        iPhoneでPDFが開けない場合は、長押しや共有から確認してください。
                      </p>
                    )}

                    <div className="material-actions">
                      {material.type === 'link' && material.url && (
                        <a
                          className="material-open-link"
                          href={material.url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          開く
                        </a>
                      )}
                      {material.type === 'file' && material.fileData && (
                        <a
                          className="material-open-link"
                          href={material.fileData}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          PDFを開く
                        </a>
                      )}
                      <button
                        className="material-delete-button"
                        type="button"
                        onClick={() => handleDeleteMaterial(material.id)}
                      >
                        削除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )
    }

    return (
      <div className="placeholder-panel">
        <p>ここに機能を作成予定です</p>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>販売委託管理アプリ</h1>
          <p>古着販売パートナー向け管理ツール</p>
        </div>
      </header>

      <main className="app-main">
        <section className="content-panel">
          <div className="section-heading">
            <span>現在の画面</span>
            <h2>{screenLabels[activeScreen]}</h2>
          </div>

          {renderContent()}
        </section>
      </main>

      <nav className="bottom-nav" aria-label="下部メニュー">
        {bottomNavItems.map((item) => (
          <button
            aria-current={activeScreen === item.id ? 'page' : undefined}
            className={activeScreen === item.id ? 'bottom-nav-button active' : 'bottom-nav-button'}
            key={item.id}
            type="button"
            onClick={() => setActiveScreen(item.id)}
          >
            <span className="bottom-nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="bottom-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App
