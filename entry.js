(() => {
  const form = document.getElementById('entry-form');
  const password = document.getElementById('password');
  const submitButton = document.getElementById('submit-button');
  const connectionField = document.getElementById('connection-field');
  const serviceUrlInput = document.getElementById('service-url');
  const changeConnection = document.getElementById('change-connection');
  const error = document.getElementById('entry-error');
  const togglePassword = document.getElementById('toggle-password');
  let configuredUrl = '';
  let useConfiguredUrl = false;

  function parseServiceUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    let parsed;
    try { parsed = new URL(raw); } catch { return null; }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    if (parsed.pathname !== '' && parsed.pathname !== '/') return null;
    if (parsed.protocol === 'https:') return parsed;
    const localHost = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
    const localPage = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
    if (parsed.protocol === 'http:' && localPage && localHost && parsed.port) return parsed;
    return null;
  }

  function setError(message) {
    error.textContent = message;
    error.hidden = !message;
  }

  function showConnectionField(value = '') {
    connectionField.hidden = false;
    serviceUrlInput.value = value;
    serviceUrlInput.required = true;
    useConfiguredUrl = false;
  }

  function readSavedUrl() {
    try {
      const saved = localStorage.getItem('ai-studio-service-url') || '';
      return parseServiceUrl(saved) ? saved : '';
    } catch { return ''; }
  }

  async function loadConnection() {
    const configUrl = new URL('./connection.json', location.href);
    try {
      const response = await fetch(configUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error('configuration unavailable');
      const config = await response.json();
      const value = typeof config.serviceUrl === 'string' ? config.serviceUrl.trim() : '';
      if (value) {
        if (parseServiceUrl(value)) {
          configuredUrl = value;
          useConfiguredUrl = true;
          connectionField.hidden = true;
          serviceUrlInput.required = false;
          changeConnection.hidden = false;
          return;
        }
        setError('预设连接地址无效，请填写本机连接服务提供的 HTTPS 地址。');
        showConnectionField(readSavedUrl());
        return;
      }
      showConnectionField(readSavedUrl());
    } catch {
      setError('无法读取连接配置。请填写本机连接服务提供的 HTTPS 地址后继续。');
      showConnectionField(readSavedUrl());
    }
  }

  changeConnection.addEventListener('click', () => {
    showConnectionField(configuredUrl);
    changeConnection.hidden = true;
    serviceUrlInput.focus();
    setError('');
  });

  togglePassword.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    togglePassword.setAttribute('aria-pressed', String(visible));
    togglePassword.setAttribute('aria-label', visible ? '隐藏密码' : '显示密码');
  });

  form.addEventListener('submit', event => {
    setError('');
    const serviceUrl = useConfiguredUrl ? configuredUrl : serviceUrlInput.value;
    const base = parseServiceUrl(serviceUrl);
    if (!base) {
      event.preventDefault();
      showConnectionField(serviceUrlInput.value);
      setError('请输入有效的 HTTPS 连接地址；本地测试仅接受带端口的 localhost 或 127.0.0.1 地址。');
      serviceUrlInput.focus();
      return;
    }
    const action = new URL('/auth/login', base.origin);
    form.action = action.href;
    if (!useConfiguredUrl) {
      try { localStorage.setItem('ai-studio-service-url', base.origin); } catch { /* Saving the non-secret address is optional. */ }
    }
    submitButton.disabled = true;
    submitButton.querySelector('span').textContent = '正在验证…';
  });

  window.addEventListener('pageshow', () => {
    submitButton.disabled = false;
    submitButton.querySelector('span').textContent = '安全进入';
  });

  void loadConnection();
})();
