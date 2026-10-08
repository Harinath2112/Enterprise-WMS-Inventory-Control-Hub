export default function PageContainer({ children, mainRef }) {
  return (
    <main className="app-shell__main" ref={mainRef} tabIndex={-1}>
      <div className="app-shell__page-container">
        {children}
      </div>
    </main>
  )
}
