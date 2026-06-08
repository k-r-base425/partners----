import { useState } from 'react'
import './App.css'

type MenuItem = {
  id: string
  label: string
}

const menus: MenuItem[] = [
  { id: 'dashboard', label: 'ダッシュボード' },
  { id: 'simulation', label: '利益シミュレーション' },
  { id: 'product-form', label: '商品登録' },
  { id: 'product-list', label: '商品一覧' },
  { id: 'billing', label: '請求管理' },
  { id: 'sales', label: '販売実績' },
  { id: 'rules', label: '販売ルール' },
  { id: 'documents', label: '資料管理' },
]

const dashboardCards = [
  { label: '登録商品数', value: '0' },
  { label: '販売中', value: '0' },
  { label: '売却済み', value: '0' },
  { label: '請求待ち', value: '0' },
  { label: '請求済み', value: '0' },
  { label: '今月の販売額', value: '0円', variant: 'amount' },
  { label: '今月の請求額', value: '0円', variant: 'amount' },
  { label: '今月の利益', value: '0円', variant: 'amount' },
]

const placeholderText: Record<string, string> = {
  simulation: 'ここに販売利益シミュレーション機能を作成予定です',
  'product-form': 'ここに商品登録機能を作成予定です',
  'product-list': 'ここに商品一覧を表示予定です',
  billing: 'ここに請求管理機能を作成予定です',
  sales: 'ここに販売実績を表示予定です',
  rules: 'ここに販売ルールを表示予定です',
  documents: 'ここにPDF資料管理機能を作成予定です',
}

function App() {
  const [activeMenu, setActiveMenu] = useState<MenuItem['id']>('dashboard')
  const activeLabel = menus.find((menu) => menu.id === activeMenu)?.label

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>販売委託管理アプリ</h1>
          <p>古着販売パートナー向け管理ツール</p>
        </div>
      </header>

      <nav className="app-nav" aria-label="メインメニュー">
        {menus.map((menu) => (
          <button
            key={menu.id}
            type="button"
            className={activeMenu === menu.id ? 'nav-button active' : 'nav-button'}
            onClick={() => setActiveMenu(menu.id)}
          >
            {menu.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        <section className="content-panel">
          <div className="section-heading">
            <span>現在の画面</span>
            <h2>{activeLabel}</h2>
          </div>

          {activeMenu === 'dashboard' ? (
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
          ) : (
            <div className="placeholder-panel">
              <p>{placeholderText[activeMenu]}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
