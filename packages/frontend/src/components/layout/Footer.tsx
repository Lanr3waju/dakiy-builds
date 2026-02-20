import '../../styles/Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        <p className="footer-text">
          © {currentYear} DakiyBuilds. AI-Powered Construction Project Management.
        </p>
        <div className="footer-links">
          <a href="#" className="footer-link">Help</a>
          <span className="footer-separator">•</span>
          <a href="#" className="footer-link">Privacy</a>
          <span className="footer-separator">•</span>
          <a href="#" className="footer-link">Terms</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
