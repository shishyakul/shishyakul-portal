import { useState, useEffect, useRef } from 'react';
import SEO from '../components/SEO';
import './Login.css';

/* ── Floating animated SVG blobs (purely decorative) ── */
function DecorBlobs() {
  return (
    <div className="login-blobs" aria-hidden="true">
      <svg className="blob blob-1" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path fill="#fdb42a" fillOpacity="0.18"
          d="M47.4,-57.2C60.3,-46.3,69.3,-30.3,70.8,-14C72.3,2.3,66.4,18.9,57.1,32.6C47.8,46.4,35.2,57.3,20.2,63.1C5.2,68.9,-12.1,69.6,-27.2,63.6C-42.3,57.6,-55.1,44.9,-63.2,29.2C-71.3,13.5,-74.5,-5.2,-68.9,-20.4C-63.4,-35.6,-49,-47.2,-34.3,-57.5C-19.6,-67.8,-4.6,-76.7,9.6,-74.8C23.9,-72.9,34.5,-68.1,47.4,-57.2Z"
          transform="translate(100 100)" />
      </svg>
      <svg className="blob blob-2" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path fill="#7f5600" fillOpacity="0.10"
          d="M39.9,-51.5C51.8,-40.6,61.5,-28.2,64.3,-14.3C67.1,-0.4,63,14.9,55.2,27.5C47.4,40.1,36,50,22.6,57.3C9.2,64.6,-6.2,69.3,-20.5,66.2C-34.8,63.1,-48,52.2,-56.7,38.4C-65.4,24.6,-69.5,7.8,-67.2,-7.9C-64.9,-23.6,-56.2,-38.2,-44.2,-49.1C-32.2,-60,-16.1,-67.2,-0.8,-66.3C14.5,-65.4,28,-62.4,39.9,-51.5Z"
          transform="translate(100 100)" />
      </svg>
      <svg className="blob blob-3" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path fill="#fdb42a" fillOpacity="0.12"
          d="M44.3,-56.1C57.2,-44.8,67.4,-31.1,70.1,-16C72.8,-0.9,68,15.6,60.1,30.4C52.2,45.3,41.3,58.4,27.3,64.8C13.3,71.3,-3.7,71,-18.8,65.2C-33.9,59.4,-47.1,48.1,-56.5,33.9C-65.9,19.7,-71.5,2.6,-69.3,-13.3C-67.1,-29.2,-57,-43.9,-44.1,-55.2C-31.1,-66.5,-15.5,-74.3,0.3,-74.7C16.2,-75,31.3,-67.4,44.3,-56.1Z"
          transform="translate(100 100)" />
      </svg>
    </div>
  );
}

/* ── Floating particles ── */
function Particles() {
  const particles = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div className="login-particles" aria-hidden="true">
      {particles.map(i => (
        <span
          key={i}
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${6 + Math.random() * 6}s`,
            width: `${4 + Math.random() * 6}px`,
            height: `${4 + Math.random() * 6}px`,
            opacity: 0.15 + Math.random() * 0.25,
          }}
        />
      ))}
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const cardRef = useRef(null);

  /* ── 3-D tilt on mouse move ── */
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const handleMove = (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rotX = ((y - cy) / cy) * -6;
      const rotY = ((x - cx) / cx) * 6;
      card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px)`;
    };
    const handleLeave = () => {
      card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)';
    };
    card.addEventListener('mousemove', handleMove);
    card.addEventListener('mouseleave', handleLeave);
    return () => {
      card.removeEventListener('mousemove', handleMove);
      card.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      triggerShake();
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Invalid credentials. Please try again.');
      }

      /* Redirect to portal with short-lived custom token */
      const portalUrl = data.redirectUrl || 'https://portal.shishyakul.in/auth';
      window.location.href = portalUrl;
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      triggerShake();
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Login | Shishyakul"
        description="Login to the Shishyakul portal. Credentials are provided by the Shishyakul technical department."
        canonical="https://shishyakul.in/login"
      />

      <div className="login-root">
        <DecorBlobs />
        <Particles />



        {/* Kinetic mouse-tracking background (reused from App.jsx) */}
        <div id="kinetic-bg" />

        <div className={`login-card glass-panel ${shake ? 'shake' : ''}`} ref={cardRef}>

          {/* Logo */}
          <div className="login-logo-wrap">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBZLESYZXcF_M2rul555PVh27IyOFW8Cmz020MELXH1sr3jYCS4L-DkjwO9Nzgj9qJfWocQ7Mw1y3cNSWpMg0LzkNOMQbiwmAgbIhiURYpcB_XOUuEGr15sx2gv-pjf58NEBF805Ww3dFg8EwQ2LTYvgr_GGH9BIvMoPW5XUJxZeg4gSyTD21_dhdJMZCrfbPKmE_mQM2iY34kr9VK_QWLWIBCi5Wi1wtyFjLUKx3fU0EiuAou4LA3R34t1JHhU9lW2fA"
              alt="Shishyakul Logo"
              className="login-logo-img"
            />
            <div className="login-logo-text">
              <span className="login-brand">Shishyakul</span>
              <span className="login-tagline">Student & Staff Portal</span>
            </div>
          </div>

          {/* Heading */}
          <h1 className="login-heading">Welcome back 👋</h1>
          <p className="login-sub">Sign in with your credentials to continue</p>

          {/* Error banner */}
          {error && (
            <div className="login-error" role="alert">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
              {error}
            </div>
          )}

          {/* Form */}
          <form className="login-form" onSubmit={handleSubmit} noValidate>

            {/* Email field */}
            <div className={`login-field-wrap ${emailFocused || email ? 'active' : ''}`}>
              <label className="login-label" htmlFor="login-email">Email Address</label>
              <span className="login-field-icon material-symbols-outlined">mail</span>
              <input
                id="login-email"
                type="email"
                className="login-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                autoComplete="email"
                disabled={loading}
                placeholder=""
              />
              <div className="login-underline" />
            </div>

            {/* Password field */}
            <div className={`login-field-wrap ${passFocused || password ? 'active' : ''}`}>
              <label className="login-label" htmlFor="login-password">Password</label>
              <span className="login-field-icon material-symbols-outlined">lock</span>
              <input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                className="login-input login-input--pass"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
                autoComplete="current-password"
                disabled={loading}
                placeholder=""
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                <span className="material-symbols-outlined">
                  {showPass ? 'visibility_off' : 'visibility'}
                </span>
              </button>
              <div className="login-underline" />
            </div>

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              className={`login-btn ${loading ? 'loading' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <span className="login-spinner" aria-hidden="true" />
              ) : (
                <>
                  <span>Sign In</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="login-footer-note">
            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--color-primary)' }}>info</span>
            Credentials are provided by the <strong>Shishyakul Technical Department</strong>.
          </div>
          <p className="login-help">
            Need help?&nbsp;
            <a href="mailto:shishyakul@gmail.com" className="login-help-link">
              shishyakul@gmail.com
            </a>
          </p>

          {/* Back link */}
          <a href="/" className="login-back">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
            Back to website
          </a>

        </div>
      </div>
    </>
  );
}
