import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  calculateSalesResult,
  productTypes,
  salesChannels,
  type ProductTypeId,
  type SalesChannelId,
} from './salesCalculation'
import './App.css'

type ScreenId = 'dashboard' | 'simulation' | 'products' | 'billing' | 'sales' | 'resources'

type BottomNavItem = {
  id: Exclude<ScreenId, 'resources'>
  label: string
  icon: string
}

type DashboardCard = {
  label: string
  value: string
  variant?: 'amount'
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
  size: string
  startPrice: number
  currentPrice: number
  targetPrice: number
  internalLowestPrice: number
  listingDate: string
  status: ProductStatus
  memo: string
  createdAt: string
}

type ProductFormState = Omit<
  Product,
  | 'id'
  | 'code'
  | 'createdAt'
  | 'startPrice'
  | 'currentPrice'
  | 'targetPrice'
  | 'internalLowestPrice'
> & {
  startPrice: string
  currentPrice: string
  targetPrice: string
  internalLowestPrice: string
}

type StatusFilter = ProductStatus | 'すべて'
type CategoryFilter = ProductCategory | 'すべて'
type LegacyProductFields = {
  suggestedPrice?: unknown
  minimumPrice?: unknown
}

const bottomNavItems: BottomNavItem[] = [
  { id: 'dashboard', label: 'ホーム', icon: '🏠' },
  { id: 'simulation', label: '計算', icon: '🧮' },
  { id: 'products', label: '商品', icon: '👕' },
  { id: 'billing', label: '請求', icon: '💰' },
  { id: 'sales', label: '実績', icon: '📊' },
]

const screenLabels: Record<ScreenId, string> = {
  dashboard: 'ホーム',
  simulation: '利益シミュレーション',
  products: '商品',
  billing: '請求管理',
  sales: '販売実績',
  resources: 'ルール・資料',
}

const quickActions: ActionCard[] = [
  {
    label: '利益を計算する',
    description: '販売利益シミュレーションへ',
    target: 'simulation',
  },
  {
    label: '商品を登録する',
    description: '商品登録・商品一覧へ',
    target: 'products',
  },
  {
    label: '請求を確認する',
    description: '請求管理へ',
    target: 'billing',
  },
  {
    label: 'ルール・資料を見る',
    description: '販売ルールとPDF資料の案内へ',
    target: 'resources',
  },
]

const productCategories: { value: ProductCategory; label: string }[] = [
  { value: 'shortSleeve', label: '半袖バンドT' },
  { value: 'longSleeve', label: '長袖バンドT' },
]

const productSizes = ['S', 'M', 'L', 'XL', 'XXL', 'その他']
const productStatuses: ProductStatus[] = ['販売中', '売却済み', '請求待ち', '請求済み', '返却済み', '保留']
const productStorageKey = 'offroad_partner_products'
const productSequenceStorageKey = 'offroad_partner_product_next_number'

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
const clampFeeRatePercent = (value: number) => Math.min(100, Math.max(0, value))
const getCategoryLabel = (category: ProductCategory) =>
  productCategories.find((item) => item.value === category)?.label ?? category
const formatProductCode = (sequence: number) => `BT-${String(sequence).padStart(4, '0')}`
const getProductCodeNumber = (code: string) => {
  const match = code.match(/^BT-(\d+)$/)
  return match ? Number(match[1]) : 0
}

const createInitialProductForm = (): ProductFormState => ({
  name: '',
  category: 'shortSleeve',
  size: 'M',
  startPrice: '',
  currentPrice: '',
  targetPrice: '',
  internalLowestPrice: '',
  listingDate: '',
  status: '販売中',
  memo: '',
})

const getProductPriceValues = (form: ProductFormState) => {
  const startPrice = toNonNegativeNumber(form.startPrice)
  const shouldUseStartPrice = form.startPrice.trim() !== ''

  return {
    startPrice,
    currentPrice:
      form.currentPrice.trim() === '' && shouldUseStartPrice
        ? startPrice
        : toNonNegativeNumber(form.currentPrice),
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
  const currentPrice =
    source.currentPrice === undefined
      ? startPrice
      : toStoredNonNegativeNumber(source.currentPrice, startPrice)
  const targetPrice =
    source.targetPrice === undefined
      ? startPrice
      : toStoredNonNegativeNumber(source.targetPrice, startPrice)
  const internalLowestPrice =
    source.internalLowestPrice === undefined
      ? startPrice
      : toStoredNonNegativeNumber(source.internalLowestPrice, startPrice)

  return {
    id: typeof source.id === 'string' && source.id ? source.id : `${Date.now()}-${index}`,
    code,
    name: source.name,
    category,
    size: typeof source.size === 'string' && source.size ? source.size : 'M',
    startPrice,
    currentPrice,
    targetPrice,
    internalLowestPrice,
    listingDate: typeof source.listingDate === 'string' ? source.listingDate : '',
    status,
    memo: typeof source.memo === 'string' ? source.memo : '',
    createdAt,
  }
}

const loadProducts = () => {
  try {
    const storedProducts = localStorage.getItem(productStorageKey)
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

const getNextProductNumber = (products: Product[]) => {
  const storedNextNumber = Number(localStorage.getItem(productSequenceStorageKey))
  const maxCodeNumber = products.reduce(
    (maxNumber, product) => Math.max(maxNumber, getProductCodeNumber(product.code)),
    0,
  )

  return Math.max(Number.isFinite(storedNextNumber) ? storedNextNumber : 1, maxCodeNumber + 1)
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
  const [nextProductNumber, setNextProductNumber] = useState(() => getNextProductNumber(loadProducts()))
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('すべて')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('すべて')

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
        (first, second) =>
          new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
      ),
    [products],
  )

  const filteredProducts = sortedProducts.filter((product) => {
    const matchesStatus = statusFilter === 'すべて' || product.status === statusFilter
    const matchesCategory = categoryFilter === 'すべて' || product.category === categoryFilter
    return matchesStatus && matchesCategory
  })

  const dashboardCards: DashboardCard[] = [
    { label: '登録商品数', value: String(products.length) },
    {
      label: '販売中',
      value: String(products.filter((product) => product.status === '販売中').length),
    },
    {
      label: '売却済み',
      value: String(products.filter((product) => product.status === '売却済み').length),
    },
    {
      label: '請求待ち',
      value: String(products.filter((product) => product.status === '請求待ち').length),
    },
    {
      label: '請求済み',
      value: String(products.filter((product) => product.status === '請求済み').length),
    },
    { label: '今月の販売額', value: '0円', variant: 'amount' },
    { label: '今月の請求額', value: '0円', variant: 'amount' },
    { label: '今月の利益', value: '0円', variant: 'amount' },
  ]

  useEffect(() => {
    localStorage.setItem(productStorageKey, JSON.stringify(products))
  }, [products])

  useEffect(() => {
    localStorage.setItem(productSequenceStorageKey, String(nextProductNumber))
  }, [nextProductNumber])

  const updateProductForm = <Key extends keyof ProductFormState>(
    key: Key,
    value: ProductFormState[Key],
  ) => {
    setProductForm((current) => ({ ...current, [key]: value }))
    setProductError('')
    setProductMessage('')
  }

  const handleSalesChannelChange = (value: SalesChannelId) => {
    const nextChannel = salesChannels.find((channel) => channel.id === value) ?? salesChannels[0]
    setSalesChannel(value)
    setFeeRateInput(String(nextChannel.feeRate * 100))
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
      size: productForm.size,
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
      const newProduct: Product = {
        id: `${Date.now()}`,
        code: formatProductCode(nextProductNumber),
        createdAt: new Date().toISOString(),
        ...productValues,
      }

      setProducts((current) => [newProduct, ...current])
      setNextProductNumber((current) => current + 1)
      setProductMessage('商品を登録しました。')
    }

    resetProductForm()
    setProductError('')
  }

  const handleEditProduct = (product: Product) => {
    setProductForm({
      name: product.name,
      category: product.category,
      size: product.size,
      startPrice: product.startPrice ? String(product.startPrice) : '',
      currentPrice: product.currentPrice ? String(product.currentPrice) : '',
      targetPrice: product.targetPrice ? String(product.targetPrice) : '',
      internalLowestPrice: product.internalLowestPrice ? String(product.internalLowestPrice) : '',
      listingDate: product.listingDate,
      status: product.status,
      memo: product.memo,
    })
    setEditingProductId(product.id)
    setProductError('')
    setProductMessage(`${product.code} を編集中です。`)
  }

  const handleCancelEdit = () => {
    resetProductForm()
    setProductMessage('')
  }

  const handleDeleteProduct = (productId: string) => {
    if (!window.confirm('この商品を削除しますか？')) {
      return
    }

    setProducts((current) => current.filter((product) => product.id !== productId))
    if (editingProductId === productId) {
      resetProductForm()
    }
    setProductMessage('商品を削除しました。')
    setProductError('')
  }

  const renderContent = () => {
    if (activeScreen === 'dashboard') {
      return (
        <>
          <div className="dashboard-grid">
            {dashboardCards.map((card) => (
              <article
                className={
                  card.variant === 'amount'
                    ? 'dashboard-card dashboard-card-wide'
                    : 'dashboard-card'
                }
                key={card.label}
              >
                <p>{card.label}</p>
                <strong>{card.value}</strong>
              </article>
            ))}
          </div>

          <section className="quick-section" aria-labelledby="quick-actions-title">
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
        </>
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
          <form className="form-card product-form" onSubmit={handleProductSubmit}>
            <h3>{editingProductId ? '商品編集' : '商品登録'}</h3>

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
              <span>サイズ</span>
              <select
                value={productForm.size}
                onChange={(event) => updateProductForm('size', event.target.value)}
              >
                {productSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>出品開始価格</span>
              <small>最初に出品を開始する価格</small>
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
              <span>現在表示価格</span>
              <small>いま販売サイト上に表示されている価格</small>
              <div className="input-with-unit">
                <input
                  inputMode="numeric"
                  min="0"
                  pattern="[0-9]*"
                  placeholder="例：9800"
                  type="number"
                  value={productForm.currentPrice}
                  onChange={(event) => updateProductForm('currentPrice', event.target.value)}
                />
                <span>円</span>
              </div>
            </label>

            <label className="field-group">
              <span>売りたい価格</span>
              <small>値下げ後に戻す、実際に売りたい価格</small>
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
              <small>過去に一度でも到達した最も安い価格</small>
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
                    {status}
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

            <div className="product-list-controls">
              <div className="product-counts">
                <span>登録商品：{products.length}件</span>
                <span>表示中：{filteredProducts.length}件</span>
              </div>

              <label className="field-group">
                <span>ステータスで絞り込み</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                >
                  <option value="すべて">すべて</option>
                  {productStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-group">
                <span>商品種別で絞り込み</span>
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
            </div>

            {products.length === 0 ? (
              <p className="empty-list-message">まだ登録された商品はありません</p>
            ) : filteredProducts.length === 0 ? (
              <p className="empty-list-message">該当する商品はありません</p>
            ) : (
              <div className="product-card-list">
                {filteredProducts.map((product) => (
                  <article className="product-card" key={product.id}>
                    <div className="product-card-header">
                      <div>
                        <h4>{product.name}</h4>
                        <p>{product.code || '商品番号なし'}</p>
                      </div>
                      <span className="status-badge">{product.status}</span>
                    </div>

                    <dl className="product-detail-list">
                      <div>
                        <dt>商品種別</dt>
                        <dd>{getCategoryLabel(product.category)}</dd>
                      </div>
                      <div>
                        <dt>サイズ</dt>
                        <dd>{product.size}</dd>
                      </div>
                      <div>
                        <dt>出品開始価格</dt>
                        <dd>{formatYen(product.startPrice)}</dd>
                      </div>
                      <div>
                        <dt>現在表示価格</dt>
                        <dd>{formatYen(product.currentPrice)}</dd>
                      </div>
                      <div>
                        <dt>売りたい価格</dt>
                        <dd>{formatYen(product.targetPrice)}</dd>
                      </div>
                      <div>
                        <dt>内部最低価格</dt>
                        <dd>{formatYen(product.internalLowestPrice)}</dd>
                      </div>
                      <div>
                        <dt>出品日</dt>
                        <dd>{product.listingDate || '未出品'}</dd>
                      </div>
                    </dl>

                    {product.memo && <p className="product-memo">{product.memo}</p>}

                    <div className="product-card-actions">
                      <button
                        className="edit-product-button"
                        type="button"
                        onClick={() => handleEditProduct(product)}
                      >
                        編集
                      </button>
                      <button
                        className="delete-product-button"
                        type="button"
                        onClick={() => handleDeleteProduct(product.id)}
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

    if (activeScreen === 'resources') {
      return (
        <div className="feature-card-grid">
          <article className="feature-card">
            <p>販売ルールを表示予定です</p>
          </article>
          <article className="feature-card">
            <p>PDF資料管理機能を作成予定です</p>
          </article>
        </div>
      )
    }

    const placeholderText: Record<Exclude<ScreenId, 'dashboard' | 'simulation' | 'products' | 'resources'>, string> = {
      billing: 'ここに請求管理機能を作成予定です',
      sales: 'ここに販売実績を表示予定です',
    }

    return (
      <div className="placeholder-panel">
        <p>{placeholderText[activeScreen]}</p>
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
