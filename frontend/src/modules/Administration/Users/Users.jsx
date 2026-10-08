import AdministrationResource from '../Roles/Roles'
import './Users.css'

/**
 * Administration user management route.
 *
 * The Users module uses the shared live-API resource workspace, just like the
 * other administration masters. Keeping this route wrapper small prevents an
 * empty lazy-loaded module from crashing the entire protected view.
 */
export default function Users() {
  return <AdministrationResource resourceKey="users" />
}
