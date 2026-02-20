import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/Header.css';

const Header = () => {
  const { user } = useAuth();

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <Link to="/dashboard" className="logo">
            <h1>DakiyBuilds</h1>
          </Link>
        </div>
        
        <div className="header-right">
          {user && (
            <>
              <span className="user-info">
                <span className="user-name">{user.firstName} {user.lastName}</span>
                <span className="user-role">{user.role.replace('_', ' ')}</span>
              </span>
              <Link to="/profile" className="profile-link">
                Profile
              </Link>
              <Link to="/logout" className="logout-link">
                Logout
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
