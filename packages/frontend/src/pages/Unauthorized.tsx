import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Unauthorized.css';

const Unauthorized: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="unauthorized-container">
      <div className="unauthorized-card">
        <h1>403</h1>
        <h2>Access Denied</h2>
        <p>You don&apos;t have permission to access this page.</p>
        <button onClick={() => navigate('/')} className="back-button">
          Go to Dashboard
        </button>
      </div>
    </div>
  );
};

export default Unauthorized;
