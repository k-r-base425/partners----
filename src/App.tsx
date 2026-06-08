import { useState } from 'react'
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

function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('dashboard')

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

    const placeholderText: Record<Exclude<ScreenId, 'dashboard' | 'products' | 'resources'>, string> = {
      simulation: 'ここに販売利益シミュレーション機能を作成予定です',
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
