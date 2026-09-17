// 모든 화면이 등록된 뒤 첫 화면을 그린다.
render();

// 오프라인 동작 등록
if ('serviceWorker' in navigator) {
  // 이 페이지를 이미 서비스워커가 맡고 있었는지 기억해 둔다
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;

  // 새 버전이 넘겨받으면 한 번만 새로고침해서 바로 최신 화면을 보여준다
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  window.addEventListener('load', () => {
    // updateViaCache: 'none' 이라야 sw.js 자체를 캐시에서 꺼내 쓰지 않고 매번 확인한다
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((reg) => reg.update())
      .catch(() => {});
  });
}
