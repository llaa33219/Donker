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
  // 1) 페이지 로드 및 새로고침 처리
  // --------------------------------------------------
  // 페이지 로드 완료 시 CSS 재적용 (새로고침 대응)
  document.addEventListener("DOMContentLoaded", () => {
    console.log("[content.js] Page loaded/refreshed. Reapplying CSS.");
    // CSS를 즉시 제거 후 재적용 (눈에 보이지 않는 속도로)
    const currentStyleType = location.pathname.startsWith("/ws") ? "style-ws.css" : "style.css";
    removeOldStyles();
    
    // requestAnimationFrame을 사용해 다음 렌더링 사이클에 CSS 적용 (깜빡임 방지)
    requestAnimationFrame(() => {
      applyCssIfNeeded(true); // force 파라미터로 강제 적용
    });
  });

  // --------------------------------------------------
  // 2) 경로 변화를 감지하는 메커니즘
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
  // 3) 경로 변경에 따른 CSS 적용 로직
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
  // 4) CSS 적용 함수
  // --------------------------------------------------
  function applyCssIfNeeded(force = false) {
    // (1) '/ws'로 시작하는지 체크
    const isWsPage = location.pathname.startsWith("/ws");
    // (2) 새 CSS 파일 결정
    const newCssFile = isWsPage ? "style-ws.css" : "style.css";
    // (3) 기존 스타일 확인
    const oldStyle = document.head.querySelector(`style[${EXT_STYLE_ATTR}]`);

    // (4) 이미 해당 CSS가 적용되어 있고 강제 적용이 아니라면 아무 작업도 하지 않음
    if (!force && oldStyle && oldStyle.textContent.includes(newCssFile)) {
      console.log("[content.js] Already applied CSS:", newCssFile);
      return;
    }

    // (5) /ws 페이지일 경우엔 기존 스타일 제거 후 재적용
    //     기본 페이지일 때는 기존 default CSS(style.css)가 있다면 제거/재적용하지 않음.
    if (oldStyle && (isWsPage || !oldStyle.textContent.includes("style.css"))) {
      removeOldStyles();
    }

    // (6) 스타일 요소가 없는 경우에만 새로 생성 후 삽입
    if (!document.head.querySelector(`style[${EXT_STYLE_ATTR}]`)) {
      const styleEl = document.createElement("style");
      styleEl.setAttribute(EXT_STYLE_ATTR, "true");
      styleEl.textContent = `
        @import url("${chrome.runtime.getURL(newCssFile)}");
      `;
      document.head.appendChild(styleEl);
      console.log("[content.js] Applied CSS:", newCssFile);
    }
  }

  // --------------------------------------------------
  // 5) 확장 프로그램 삽입 스타일만 제거하는 함수
  // --------------------------------------------------
  function removeOldStyles() {
    const oldStyles = document.head.querySelectorAll(`style[${EXT_STYLE_ATTR}]`);
    oldStyles.forEach(s => s.remove());
  }

  // --------------------------------------------------
  // 6) 페이지가 이미 로드된 상태일 때도 작동하도록 설정
  // --------------------------------------------------
  if (document.readyState === "complete" || document.readyState === "interactive") {
    console.log("[content.js] Page already loaded, applying CSS immediately");
    applyCssIfNeeded(true);
  }
})();