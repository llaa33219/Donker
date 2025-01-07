// content.js
(() => {
  // "console.log"은 디버깅 시 사용, 배포 시엔 주석 처리 고려
  console.log("[content.js] Improved approach loaded.");

  // 마지막으로 확인한 경로
  let lastPath = location.pathname;

  // 확장 프로그램에서 만든 스타일 엘리먼트 식별용 속성
  const EXT_STYLE_ATTR = "data-entry-style";

  // 초기 진입 시 즉시 CSS 적용
  applyCssIfNeeded();

  // --------------------------------------------------
  // 1) 경로 변화를 감지하는 메커니즘
  // --------------------------------------------------
  // (1) pushState, replaceState를 가로채어 경로 변화를 감지
  ["pushState", "replaceState"].forEach(methodName => {
    const originalMethod = history[methodName];
    history[methodName] = function (...args) {
      const result = originalMethod.apply(this, args);
      onUrlChange();
      return result;
    };
  });

  // (2) 뒤로 가기/앞으로 가기(popstate) 이벤트 시 경로 변화를 감지
  window.addEventListener("popstate", onUrlChange);

  // (3) 필요하다면 hashchange 이벤트 등록(해시 변경도 감지하려면)
  // window.addEventListener("hashchange", onUrlChange);

  // (4) SPA가 아니라면, 혹은 추가 안전장치가 필요하다면 setInterval 보조
  // const POLLING_INTERVAL = 1000;
  // setInterval(onUrlChange, POLLING_INTERVAL);

  // --------------------------------------------------
  // 2) 경로 변경에 따른 CSS 적용 로직
  // --------------------------------------------------
  function onUrlChange() {
    const currentPath = location.pathname;
    if (currentPath !== lastPath) {
      lastPath = currentPath;
      console.log("[content.js] Detected path change:", currentPath);
      applyCssIfNeeded();
    }
  }

  // --------------------------------------------------
  // 3) CSS 적용 함수
  // --------------------------------------------------
  function applyCssIfNeeded() {
    // (1) '/ws'로 시작하는지 체크
    const isWsPage = location.pathname.startsWith("/ws");

    // (2) 이미 삽입된 스타일(확장 프로그램에서 만든 것) 확인
    const oldStyle = document.head.querySelector(`style[${EXT_STYLE_ATTR}]`);
    const newCssFile = isWsPage ? "style-ws.css" : "style.css";

    // (3) 만약 기존에 삽입된 스타일이 있고, import 경로가 동일하면 재삽입 불필요
    if (oldStyle && oldStyle.textContent.includes(newCssFile)) {
      console.log("[content.js] Already applied CSS:", newCssFile);
      return;
    }

    // (4) 확장 프로그램이 삽입한 기존 스타일은 제거
    removeOldStyles();

    // (5) 새로운 style 태그를 생성 및 삽입
    const styleEl = document.createElement("style");
    styleEl.setAttribute(EXT_STYLE_ATTR, "true");
    styleEl.textContent = `
      @import url("${chrome.runtime.getURL(newCssFile)}");
    `;
    document.head.appendChild(styleEl);

    console.log("[content.js] Applied CSS:", newCssFile);
  }

  // --------------------------------------------------
  // 4) 확장 프로그램 삽입 스타일만 제거하는 함수
  // --------------------------------------------------
  function removeOldStyles() {
    const oldStyles = document.head.querySelectorAll(`style[${EXT_STYLE_ATTR}]`);
    oldStyles.forEach(s => s.remove());
  }
})();
