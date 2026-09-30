/**
 * AWS Serverless Visitor Counter — Production Frontend Controller
 * Handles: live API fetch, count animation, refresh button, latency display, copy-to-clipboard toast.
 */

'use strict';

// ==========================================================================
// 1. CONFIGURATION
// ==========================================================================
const CONFIG = {
  API_URL: 'https://e511f1fzl6.execute-api.eu-north-1.amazonaws.com/prod/count',
  FETCH_TIMEOUT_MS: 8000,
  ANIMATION_DURATION_MS: 1600,
};

// ==========================================================================
// 2. DOM CACHE
// ==========================================================================
const DOM = {
  counterContainer:  document.getElementById('visitor-count'),
  latencyIndicator:  document.getElementById('latency-indicator'),
  refreshBtn:        document.getElementById('refresh-counter-btn'),
  copyCurlBtn:       document.getElementById('copy-curl-btn'),
  curlCmdText:       document.getElementById('curl-cmd-text'),
  toast:             document.getElementById('toast'),
  toastMessage:      document.getElementById('toast-message'),
};

const numberFormatter = new Intl.NumberFormat();

// ==========================================================================
// 3. ANIMATION HELPERS
// ==========================================================================

/** Cubic ease-out for smooth deceleration. */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animates visitor count from 0 → target using requestAnimationFrame.
 * @param {HTMLElement} el     - Container element
 * @param {number}      target - Final visitor count
 * @param {number}      dur    - Duration in ms
 */
function animateCount(el, target, dur = CONFIG.ANIMATION_DURATION_MS) {
  if (!el) return;
  const start = performance.now();

  function step(now) {
    const progress = Math.min((now - start) / dur, 1);
    const eased    = easeOutCubic(progress);
    el.textContent = numberFormatter.format(Math.floor(target * eased));
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = numberFormatter.format(target);
      // Pop scale animation to celebrate final number
      el.closest('.counter-number-display')?.classList.add('pop');
    }
  }
  requestAnimationFrame(step);
}

// ==========================================================================
// 4. UI STATE RENDERERS
// ==========================================================================

function renderLoading() {
  if (!DOM.counterContainer) return;
  DOM.counterContainer.innerHTML = `
    <span class="spinner" aria-label="Loading visitor count">
      <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
    </span>
  `;
  if (DOM.latencyIndicator) {
    DOM.latencyIndicator.innerHTML = `<i class="fas fa-bolt" aria-hidden="true"></i> Response latency: <strong>Measuring…</strong>`;
  }
}

function renderError(msg = 'Unavailable') {
  if (!DOM.counterContainer) return;
  DOM.counterContainer.innerHTML = `
    <span style="color:#EF4444;font-size:1.6rem;display:inline-flex;align-items:center;gap:.5rem;" title="${msg}">
      <i class="fas fa-triangle-exclamation" aria-hidden="true"></i> N/A
    </span>
  `;
  if (DOM.latencyIndicator) {
    DOM.latencyIndicator.innerHTML = `<i class="fas fa-circle-exclamation" style="color:#EF4444"></i> API unreachable`;
  }
}

function renderCount(count, latencyMs) {
  if (!DOM.counterContainer) return;

  // Clear spinner, insert plain text node (animated)
  DOM.counterContainer.textContent = '0';
  animateCount(DOM.counterContainer, count);

  if (DOM.latencyIndicator && latencyMs !== null) {
    const color = latencyMs < 300 ? '#10B981' : latencyMs < 700 ? '#FF9900' : '#EF4444';
    DOM.latencyIndicator.innerHTML =
      `<i class="fas fa-bolt" aria-hidden="true"></i> Response latency: <strong style="color:${color}">${latencyMs}ms</strong>`;
  }
}

// ==========================================================================
// 5. API FETCH
// ==========================================================================

/**
 * Fetches live visitor count with timeout. Returns { count, latencyMs }.
 */
async function fetchCount() {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);
  const t0  = performance.now();

  try {
    const res = await fetch(CONFIG.API_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(tid);

    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    const data       = await res.json();
    const count      = Number(data?.visitorCount);
    const latencyMs  = Math.round(performance.now() - t0);

    if (isNaN(count)) throw new TypeError('Invalid visitorCount in response');
    return { count, latencyMs };

  } catch (err) {
    clearTimeout(tid);
    if (err.name === 'AbortError') throw new Error(`Timed out after ${CONFIG.FETCH_TIMEOUT_MS}ms`);
    throw err;
  }
}

// ==========================================================================
// 6. TOAST NOTIFICATION
// ==========================================================================

let toastTimer = null;

function showToast(message) {
  if (!DOM.toast || !DOM.toastMessage) return;
  DOM.toastMessage.textContent = message;
  DOM.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => DOM.toast.classList.remove('show'), 3000);
}

// ==========================================================================
// 7. INITIALIZATION
// ==========================================================================

async function init() {
  if (!DOM.counterContainer) {
    console.warn('[VisitorCounter] #visitor-count not found.');
    return;
  }

  // Disable refresh button while fetching
  if (DOM.refreshBtn) DOM.refreshBtn.disabled = true;

  renderLoading();

  try {
    const { count, latencyMs } = await fetchCount();
    renderCount(count, latencyMs);
  } catch (err) {
    console.error('[VisitorCounter]', err.message);
    renderError(err.message);
  } finally {
    if (DOM.refreshBtn) DOM.refreshBtn.disabled = false;
  }
}

// ==========================================================================
// 8. EVENT LISTENERS
// ==========================================================================

// Refresh button
if (DOM.refreshBtn) {
  DOM.refreshBtn.addEventListener('click', () => {
    const icon = DOM.refreshBtn.querySelector('i');
    if (icon) icon.classList.add('fa-spin');
    init().finally(() => {
      if (icon) icon.classList.remove('fa-spin');
    });
  });
}

// Copy cURL command to clipboard
if (DOM.copyCurlBtn && DOM.curlCmdText) {
  DOM.copyCurlBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(DOM.curlCmdText.textContent.trim());
      showToast('cURL command copied to clipboard!');
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = DOM.curlCmdText.textContent.trim();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('cURL command copied!');
    }
  });
}

// ==========================================================================
// 9. BOOT
// ==========================================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}