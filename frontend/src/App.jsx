import { Routes, Route, NavLink } from 'react-router-dom';
import ScanPage from './pages/ScanPage';
import AdminPage from './pages/AdminPage';

function Navbar() {
  return (
    <nav className="nav">
      <a href="/" className="nav-brand">
        <div className="nav-brand-icon">🛡️</div>
        <span className="nav-brand-text">FaceGuard</span>
      </a>
      <div className="nav-links">
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          📸 Quét mặt
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          ⚙️ Admin
        </NavLink>
      </div>
    </nav>
  );
}

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<ScanPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </>
  );
}

export default App;
