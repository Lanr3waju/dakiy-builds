import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Landing.css';

const Landing = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    
    // Rotate active feature every 3 seconds
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 3);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="landing-page">
      {/* Animated background elements */}
      <div className="bg-animation">
        <div className="bg-circle circle-1"></div>
        <div className="bg-circle circle-2"></div>
        <div className="bg-circle circle-3"></div>
      </div>

      {/* Navigation Header */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-logo">
            <h1>DakiyBuilds</h1>
            <span className="logo-tagline">AI-Powered</span>
          </div>
          <Link to="/login" className="nav-login-btn">
            Sign In
          </Link>
        </div>
      </nav>

      <div className="landing-container">
        {/* Hero Section */}
        <section className={`hero-section ${isVisible ? 'fade-in' : ''}`}>
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-icon">✨</span>
              <span>Powered by Machine Learning</span>
            </div>
            <h1 className="hero-title">
              Build Smarter with
              <span className="gradient-text"> AI-Driven Insights</span>
            </h1>
            <p className="hero-subtitle">
              Harness the power of predictive analytics and intelligent automation 
              to transform construction project management. Our neural network-powered 
              platform delivers real-time forecasting, adaptive scheduling, and 
              data-driven decision making.
            </p>
            <div className="cta-buttons">
              <Link to="/login" className="btn-primary-large">
                Start Building Today
                <span className="arrow">→</span>
              </Link>
            </div>
            <div className="trust-indicators">
              <div className="trust-item">
                <span className="trust-icon">🏆</span>
                <span>Industry Leading</span>
              </div>
              <div className="trust-item">
                <span className="trust-icon">🔒</span>
                <span>Enterprise Security</span>
              </div>
              <div className="trust-item">
                <span className="trust-icon">⚡</span>
                <span>Real-time Updates</span>
              </div>
            </div>
          </div>
          
          <div className="hero-visual">
            <div className="visual-container">
              <div className={`floating-card card-1 ${activeFeature === 0 ? 'active' : ''}`}>
                <div className="card-icon">🧠</div>
                <div className="card-content">
                  <div className="card-title">Neural Forecasting</div>
                  <div className="card-text">ML-powered predictions</div>
                </div>
              </div>
              <div className={`floating-card card-2 ${activeFeature === 1 ? 'active' : ''}`}>
                <div className="card-icon">🎯</div>
                <div className="card-content">
                  <div className="card-title">Smart Optimization</div>
                  <div className="card-text">Adaptive scheduling</div>
                </div>
              </div>
              <div className={`floating-card card-3 ${activeFeature === 2 ? 'active' : ''}`}>
                <div className="card-icon">📈</div>
                <div className="card-content">
                  <div className="card-title">Predictive Analytics</div>
                  <div className="card-text">Data-driven insights</div>
                </div>
              </div>
              <div className="pulse-ring"></div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section">
          <div className="section-header">
            <span className="section-badge">AI-Powered Features</span>
            <h2 className="section-title">Intelligent Construction Management</h2>
            <p className="section-subtitle">
              Leverage cutting-edge machine learning algorithms to optimize every aspect of your projects
            </p>
          </div>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon">🧠</div>
              </div>
              <h3>Neural Network Forecasting</h3>
              <p>Deep learning models analyze historical data patterns to predict project completion with 95% accuracy, identifying potential delays before they occur.</p>
              <div className="feature-tag">Machine Learning</div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon">📊</div>
              </div>
              <h3>Intelligent Analytics</h3>
              <p>Real-time data processing and visualization powered by advanced algorithms. Track velocity, burndown, and performance metrics with AI-enhanced insights.</p>
              <div className="feature-tag">Predictive Analytics</div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon">🎯</div>
              </div>
              <h3>Smart Dependency Mapping</h3>
              <p>Automated critical path analysis using graph neural networks. Visualize complex task relationships and optimize resource allocation dynamically.</p>
              <div className="feature-tag">Graph AI</div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon">🤝</div>
              </div>
              <h3>Adaptive Collaboration</h3>
              <p>Context-aware team coordination with intelligent notifications. AI-driven role assignments and automated workflow optimization for maximum efficiency.</p>
              <div className="feature-tag">Smart Automation</div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon">📅</div>
              </div>
              <h3>Dynamic Timeline Optimization</h3>
              <p>Self-adjusting schedules powered by reinforcement learning. Automatically rebalance workloads and suggest optimal task sequencing in real-time.</p>
              <div className="feature-tag">Adaptive AI</div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon">⚠️</div>
              </div>
              <h3>Proactive Risk Intelligence</h3>
              <p>Continuous risk assessment using ensemble learning models. Predict bottlenecks, resource conflicts, and timeline risks with actionable mitigation strategies.</p>
              <div className="feature-tag">Risk AI</div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="stats-section">
          <div className="stat-item animate-on-scroll">
            <div className="stat-number" data-target="95">95%</div>
            <div className="stat-label">AI Prediction Accuracy</div>
            <div className="stat-sublabel">Neural network precision</div>
          </div>
          <div className="stat-item animate-on-scroll">
            <div className="stat-number" data-target="40">40%</div>
            <div className="stat-label">Efficiency Increase</div>
            <div className="stat-sublabel">Through automation</div>
          </div>
          <div className="stat-item animate-on-scroll">
            <div className="stat-number">Real-time</div>
            <div className="stat-label">Intelligent Updates</div>
            <div className="stat-sublabel">Powered by ML algorithms</div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <div className="cta-content">
            <h2>Ready to revolutionize your projects?</h2>
            <p>Join forward-thinking teams leveraging AI to build smarter, faster, and more efficiently</p>
            <Link to="/login" className="btn-primary-large btn-glow">
              Experience the Future
              <span className="arrow">→</span>
            </Link>
            <p className="cta-note">
              <span className="check-icon">✓</span> No credit card required
              <span className="separator">•</span>
              <span className="check-icon">✓</span> Enterprise-grade security
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <div className="footer-content">
            <div className="footer-brand">
              <h3>DakiyBuilds</h3>
              <p>AI-Powered Construction Project Management</p>
            </div>
            <div className="footer-links">
              <Link to="/login" className="footer-link">Get Started</Link>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 DakiyBuilds. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
