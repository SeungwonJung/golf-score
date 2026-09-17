// 모든 화면이 등록된 뒤 첫 화면을 그린다.
render();

// 오프라인 동작 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
