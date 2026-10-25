(() => {
  const form = document.getElementById('entry-form');
  const password = document.getElementById('password');
  const submitButton = document.getElementById('submit-button');
  const connectionField = document.getElementById('connection-field');
  const serviceUrlInput = document.getElementById('service-url');
  const changeConnection = document.getElementById('change-connection');
  const error = document.getElementById('entry-error');
  const togglePassword = document.getElementById('toggle-password');
  const connectionStatus = document.getElementById('connection-status');
  const connectionStatusText = document.getElementById('connection-status-text');
  const unavailableMessage = '本机连接暂不可用，请确认电脑与公网连接服务正在运行，或更新连接地址。';
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

  function setConnectionState(state) {
    connectionStatus.dataset.state = state;
    connectionStatusText.textContent = state === 'checking'
      ? '正在检查连接…'
      : state === 'connected'
        ? '已连接'
        : '暂不可用';
  }

  function restoreSubmitButton() {
    submitButton.disabled = false;
    submitButton.querySelector('span').textContent = '安全进入';
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

  async function checkConnection(serviceUrl) {
    const base = parseServiceUrl(serviceUrl);
    if (!base) {
      setConnectionState('unavailable');
      setError(unavailableMessage);
      return false;
    }
    setConnectionState('checking');
    try {
      const response = await fetch(new URL('/auth/status', base.origin), {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        signal: AbortSignal.timeout(8000)
      });
      if (response.status !== 200) throw new Error('service unavailable');
      const status = await response.json();
      if (status?.passwordEnabled !== true) throw new Error('password protection unavailable');
      setConnectionState('connected');
      setError('');
      return true;
    } catch {
      setConnectionState('unavailable');
      setError(unavailableMessage);
      return false;
    }
  }

  async function loadConnection() {
    let serviceUrl = '';
    try {
      const configUrl = new URL('./connection.json', location.href);
      const response = await fetch(configUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error('configuration unavailable');
      const config = await response.json();
      const value = typeof config.serviceUrl === 'string' ? config.serviceUrl.trim() : '';
      if (value && parseServiceUrl(value)) {
        configuredUrl = value;
        useConfiguredUrl = true;
        serviceUrl = value;
        connectionField.hidden = true;
        serviceUrlInput.required = false;
        changeConnection.hidden = false;
      } else {
        showConnectionField(readSavedUrl());
        serviceUrl = serviceUrlInput.value;
      }
    } catch {
      showConnectionField(readSavedUrl());
      serviceUrl = serviceUrlInput.value;
    }
    await checkConnection(serviceUrl);
  }

  changeConnection.addEventListener('click', () => {
    showConnectionField(configuredUrl);
    changeConnection.hidden = true;
    setConnectionState('unavailable');
    serviceUrlInput.focus();
    setError('');
  });

  togglePassword.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    togglePassword.setAttribute('aria-pressed', String(visible));
    togglePassword.setAttribute('aria-label', visible ? '隐藏密码' : '显示密码');
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    setError('');
    const serviceUrl = useConfiguredUrl ? configuredUrl : serviceUrlInput.value;
    const base = parseServiceUrl(serviceUrl);
    if (!base) {
      showConnectionField(serviceUrlInput.value);
      setConnectionState('unavailable');
      setError('请输入有效的 HTTPS 连接地址；本地测试仅接受带端口的 localhost 或 127.0.0.1 地址。');
      serviceUrlInput.focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.querySelector('span').textContent = '正在检查连接…';
    if (!await checkConnection(base.origin)) {
      restoreSubmitButton();
      return;
    }

    form.action = new URL('/auth/login', base.origin).href;
    if (!useConfiguredUrl) {
      try { localStorage.setItem('ai-studio-service-url', base.origin); } catch { /* Saving the non-secret address is optional. */ }
    }
    submitButton.querySelector('span').textContent = '正在验证…';
    form.submit();
  });

  window.addEventListener('pageshow', restoreSubmitButton);
  void loadConnection();
})();
