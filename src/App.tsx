import { useState } from 'react'
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

const dashboardCards: DashboardCard[] = [
  { label: '登録商品数', value: '0' },
  { label: '販売中', value: '0' },
  { label: '売却済み', value: '0' },
  { label: '請求待ち', value: '0' },
  { label: '請求済み', value: '0' },
  { label: '今月の販売額', value: '0円', variant: 'amount' },
  { label: '今月の請求額', value: '0円', variant: 'amount' },
  { label: '今月の利益', value: '0円', variant: 'amount' },
]

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

const yenFormatter = new Intl.NumberFormat('ja-JP', {
  maximumFractionDigits: 0,
})

const formatYen = (value: number) => `${yenFormatter.format(Math.round(value))}円`
const formatPercent = (value: number) => `${value.toFixed(1)}%`
const formatFeeRate = (value: number) => `${(value * 100).toFixed(0)}%`
const toNumber = (value: string) => Number(value) || 0

function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('dashboard')
  const [salesChannel, setSalesChannel] = useState<SalesChannelId>('mercari')
  const [productType, setProductType] = useState<ProductTypeId>('short-sleeve-band-t')
  const [salePriceInput, setSalePriceInput] = useState('')
  const [shippingFeeInput, setShippingFeeInput] = useState('215')

  const selectedChannel = salesChannels.find((channel) => channel.id === salesChannel) ?? salesChannels[0]
  const salesResult = calculateSalesResult({
    salesChannel,
    productType,
    salePrice: toNumber(salePriceInput),
    shippingFee: toNumber(shippingFeeInput),
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
                onChange={(event) => setSalesChannel(event.target.value as SalesChannelId)}
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

            <div className="fee-rate-display">
              <span>販売手数料率</span>
              <strong>{formatFeeRate(selectedChannel.feeRate)}</strong>
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
        <div className="feature-card-grid">
          <article className="feature-card">
            <p>商品登録機能を作成予定です</p>
          </article>
          <article className="feature-card">
            <p>商品一覧を表示予定です</p>
          </article>
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
