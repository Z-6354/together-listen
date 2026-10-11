/**
 * Android / 原生壳：强制手机版布局（与 mobile.css 一致）
 */
(function () {
  const ua = navigator.userAgent || "";
  const native =
    window.TOGETHER_LISTEN_NATIVE === true ||
    /TogetherListenApp/i.test(ua) ||
    window.Capacitor?.isNativePlatform?.();

  if (!native) return;

  window.TOGETHER_LISTEN_NATIVE = true;

  function applyNativeChrome() {
    document.documentElement.classList.add("native-app");
    document.body.classList.add("is-mobile");
    if (!document.body.dataset.mobilePage) {
      document.body.dataset.mobilePage = "play";
    }
  }

  if (document.body) applyNativeChrome();
  else document.addEventListener("DOMContentLoaded", applyNativeChrome);
})();
