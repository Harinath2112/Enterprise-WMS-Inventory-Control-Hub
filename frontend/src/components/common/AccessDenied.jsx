import { ShieldAlert } from 'lucide-react'
import './AccessDenied.css'

export default function AccessDenied() {
  return (
    <main className="access-denied-container" role="alert">
      <div className="access-denied-card">
        <div className="access-denied-body">
          <div className="access-denied-icon-wrap" aria-hidden="true">
            <ShieldAlert size={44} strokeWidth={1.8} />
          </div>
          <h1 className="access-denied-title">Access Denied</h1>
          <p className="access-denied-text">
            You do not have permission to view this page.
            <br />
            Please contact your administrator for access.
          </p>
        </div>
      </div>
    </main>
  )
}
