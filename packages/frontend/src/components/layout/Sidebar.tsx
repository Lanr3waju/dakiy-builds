import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/Sidebar.css';

const Sidebar = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const canManageProjects = user?.role === 'Admin' || user?.role === 'Project_Manager';
  const isAdmin = user?.role === 'Admin';

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <>
      <button className="hamburger-menu" onClick={toggleMenu} aria-label="Toggle navigation menu">
        <span className={`hamburger-icon ${isOpen ? 'open' : ''}`}>
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>
      
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <nav className="sidebar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={closeMenu}>
          <span className="nav-icon">📊</span>
          <span className="nav-label">Dashboard</span>
        </NavLink>

        <NavLink to="/projects" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={closeMenu}>
          <span className="nav-icon">🏗️</span>
          <span className="nav-label">Projects</span>
        </NavLink>

        <NavLink to="/tasks" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={closeMenu}>
          <span className="nav-icon">✓</span>
          <span className="nav-label">Tasks</span>
        </NavLink>

        <NavLink to="/documents" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={closeMenu}>
          <span className="nav-icon">📄</span>
          <span className="nav-label">Documents</span>
        </NavLink>

        <NavLink to="/timeline" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={closeMenu}>
          <span className="nav-icon">📅</span>
          <span className="nav-label">Timeline</span>
        </NavLink>

        {canManageProjects && (
          <div className="nav-divider" />
        )}

        {isAdmin && (
          <>
            <NavLink to="/users" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={closeMenu}>
              <span className="nav-icon">👥</span>
              <span className="nav-label">Users</span>
            </NavLink>

            <NavLink to="/audit-logs" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={closeMenu}>
              <span className="nav-icon">📋</span>
              <span className="nav-label">Audit Logs</span>
            </NavLink>
          </>
        )}
      </nav>
    </aside>
    
    {isOpen && <div className="sidebar-overlay" onClick={closeMenu}></div>}
  </>
  );
};

export default Sidebar;
