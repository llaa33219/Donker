// content.js
(() => {
  // "console.log"은 디버깅 시 사용, 배포 시엔 주석 처리 고려
  console.log("[content.js] Improved approach loaded.");

  // 마지막으로 확인한 경로와 호스트
  let lastPath = location.pathname;
  let lastHost = location.hostname;
  
  // 초기화 함수
  function initialize() {
    // 초기화 로직이 필요한 경우 여기에 추가
    console.log("[content.js] Content script initialized");
  }
  
  // 초기화 실행
  initialize();

  // 확장 프로그램에서 만든 스타일 엘리먼트 식별용 속성
  const EXT_STYLE_ATTR = "data-entry-style";

  // 변경을 추적하는 MutationObserver 인스턴스
  let headObserver = null;
  let bodyObserver = null;
  
  // 무한 루프 방지를 위한 플래그
  let isApplyingCSS = false;

  // 즉시 실행 플래그 - CSS 적용 시도 횟수 제한
  let cssApplyAttempts = 0;
  const MAX_EARLY_ATTEMPTS = 20; // 최대 초기 시도 횟수

  // DOM이 생성되기 이전에도 작동하는 CSS 적용 함수
  function earlyApplyCSS() {
    if (cssApplyAttempts >= MAX_EARLY_ATTEMPTS) return;
    cssApplyAttempts++;
    
    // 오직 /ws 경로일 때만 WS 페이지로 판단 (space.playentry.org는 일반 페이지)
    const isWsPage = location.pathname.startsWith("/ws");
    const cssFile = isWsPage ? "style-ws.css" : "style.css";
    
    // head 확인 및 CSS 주입
    if (!document.head) {
      // head가 아직 없으면, 주기적으로 재시도 (극초기에는 짧은 간격으로)
      const headCheckInterval = setInterval(() => {
        if (document.head) {
          clearInterval(headCheckInterval);
          injectCSS(cssFile);
        }
      }, 1); // 1ms 간격으로 head 체크 (가능한 빠르게)
      return;
    }
    
    injectCSS(cssFile);
  }
  
  // CSS 파일을 직접 링크하는 함수
  function injectCSS(cssFile) {
    // 이미 있는 스타일 제거
    removeOldStyles();
    
    // 방법 1: style 태그에 직접 CSS 내용 삽입 (chrome.runtime.getURL로 CSS 파일 내용 가져오기 시도)
    try {
      // 스타일 주입 방법 1: style 태그 사용
      const styleEl = document.createElement("style");
      styleEl.setAttribute(EXT_STYLE_ATTR, "true");
      styleEl.textContent = `
        @import url("${chrome.runtime.getURL(cssFile)}");
      `;
      document.head.appendChild(styleEl);
    } catch (e) {
      console.error("[content.js] Error injecting style:", e);
    }
    
    // 방법 2: link 태그로 직접 CSS 파일 연결 (더 확실한 방법)
    const linkEl = document.createElement("link");
    linkEl.setAttribute(EXT_STYLE_ATTR, "true");
    linkEl.rel = "stylesheet";
    linkEl.type = "text/css";
    linkEl.href = chrome.runtime.getURL(cssFile);
    document.head.appendChild(linkEl);
    
    console.log("[content.js] CSS applied with file:", cssFile);
  }

  // 즉시 CSS 주입 시도
  earlyApplyCSS();

  // --------------------------------------------------
  // 1) 빠르게 반복 시도 - document_start 단계에서의 초기 로딩 시
  // --------------------------------------------------
  // 페이지 로드 초기에 짧은 간격으로 여러 번 시도 (첫 50ms 동안)
  const earlyInterval = setInterval(() => {
    if (cssApplyAttempts >= 5 || document.readyState !== "loading") {
      clearInterval(earlyInterval);
      return;
    }
    earlyApplyCSS();
  }, 10); // 10ms 간격으로 5번까지 시도
  
  // --------------------------------------------------
  // 2) 페이지 로드 및 DOM 생성 단계 감시
  // --------------------------------------------------
  // document-start에서 DOM 생성 과정 감시 시작
  if (document.readyState === "loading") {
    // DOM이 parsing 단계일 때 HTML 로드 중인 경우
    const documentStateCheck = setInterval(() => {
      if (document.head) {
        // head가 생성됐다면 CSS 적용 재시도
        if (!document.head.querySelector(`[${EXT_STYLE_ATTR}]`)) {
          console.log("[content.js] Document parsing in progress, injecting CSS");
          earlyApplyCSS();
        }
        
        // body가 생성되었다면 interval 종료
        if (document.body) {
          clearInterval(documentStateCheck);
        }
      }
    }, 5); // 매우 짧은 간격으로 체크
  }
  
  // DOM 콘텐츠 로드 시작 시점에 감지
  document.addEventListener("readystatechange", () => {
    console.log("[content.js] readyState changed:", document.readyState);
    if (!document.head.querySelector(`[${EXT_STYLE_ATTR}]`)) {
      earlyApplyCSS();
    }
  }, { capture: true });
  
  // DOM 로딩 완료 시 CSS 재확인
  document.addEventListener("DOMContentLoaded", () => {
    console.log("[content.js] DOM loaded, ensuring CSS is applied");
    // CSS를 즉시 제거 후 재적용 (더 확실한 방법)
    if (!document.head.querySelector(`[${EXT_STYLE_ATTR}]`)) {
      applyCssIfNeeded(true);
    }
  });
  
  // 페이지 완전 로드 완료 시 최종 확인
  window.addEventListener("load", () => {
    console.log("[content.js] Page fully loaded, final CSS check");
    if (!document.head.querySelector(`[${EXT_STYLE_ATTR}]`)) {
      applyCssIfNeeded(true);
    }
    
    // 완전 로드 후 MutationObserver 설정
    observeDOM();
    
    // 주기적으로 URL 변경 체크
    setInterval(checkUrlChange, 200);
  });

  // --------------------------------------------------
  // 3) head와 body 변화 감지 및 CSS 재적용
  // --------------------------------------------------
  // MutationObserver 설정
  const observeDOM = () => {
    // 이미 옵저버가 설정되어 있다면 재설정하지 않음
    if (headObserver) {
      headObserver.disconnect();
    }
    
    if (bodyObserver) {
      bodyObserver.disconnect();
    }
    
    const observerOptions = {
      childList: true,
      subtree: false
    };

    // head 관찰
    headObserver = new MutationObserver((mutations) => {
      // CSS 적용 중이면 무시
      if (isApplyingCSS) return;
      
      // 스타일 변경이 있고 확장 프로그램이 만든 스타일이 아닌 경우에만 처리
      const shouldReapply = mutations.some(mutation => {
        for (let i = 0; i < mutation.removedNodes.length; i++) {
          const node = mutation.removedNodes[i];
          if (node.nodeType === Node.ELEMENT_NODE && 
              (node.tagName === 'STYLE' || node.tagName === 'LINK') && 
              node.hasAttribute(EXT_STYLE_ATTR)) {
            return true;
          }
        }
        return false;
      });
      
      if (shouldReapply && !document.head.querySelector(`[${EXT_STYLE_ATTR}]`)) {
        console.log("[content.js] Our style was removed, reapplying");
        applyCssIfNeeded(true);
      }
    });
    
    // body 관찰 (페이지 구조 변화 감지 용)
    bodyObserver = new MutationObserver(() => {
      // CSS 적용 중이면 무시
      if (isApplyingCSS) return;
      
      // 스타일이 제거되었는지 확인하고 필요시에만 적용
      if (!document.head.querySelector(`[${EXT_STYLE_ATTR}]`)) {
        console.log("[content.js] Style missing after body change, reapplying");
        applyCssIfNeeded(true);
      }
    });

    // head와 body 관찰 시작
    if (document.head) headObserver.observe(document.head, observerOptions);
    if (document.body) bodyObserver.observe(document.body, observerOptions);
  };

  // --------------------------------------------------
  // 4) 경로 변화를 감지하는 메커니즘
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
  window.addEventListener("hashchange", onUrlChange);
  
  // (4) 추가: 특수한 iframe 기반 페이지 전환 감지
  window.addEventListener("message", (e) => {
    // 엔트리 또는 스페이스 도메인에서 오는 메시지만 처리
    if (e.origin.includes("playentry.org")) {
      // 메시지 데이터가 객체이고 페이지 이동 관련 신호가 있는지 확인
      if (typeof e.data === 'object' && e.data && (e.data.type === 'navigate' || e.data.action === 'navigate')) {
        console.log("[content.js] Navigation message detected:", e.data);
        onUrlChange();
      }
    }
  });

  // --------------------------------------------------
  // 5) URL 변경 감지 및 체크 함수
  // --------------------------------------------------
  function checkUrlChange() {
    const currentPath = location.pathname;
    const currentHost = location.hostname;
    
    if (currentPath !== lastPath || currentHost !== lastHost) {
      // 현재 URL 정보 업데이트
      lastPath = currentPath;
      lastHost = currentHost;
      
      console.log("[content.js] URL change detected, path:", currentPath, "host:", currentHost);
      applyCssIfNeeded(true);
    }
  }

  // --------------------------------------------------
  // 6) 경로 변경에 따른 CSS 적용 로직
  // --------------------------------------------------
  function onUrlChange() {
    // URL 변경 체크 함수 호출
    checkUrlChange();
    
    // URL 변경 감지 후 약간의 지연을 두고 한 번 더 체크 (SPA 전환 지연 처리)
    setTimeout(checkUrlChange, 100);
    setTimeout(checkUrlChange, 500);
  }

  // --------------------------------------------------
  // 7) CSS 적용 함수
  // --------------------------------------------------
  function applyCssIfNeeded(force = false) {
    // 이미 CSS 적용 중이면 중복 호출 방지
    if (isApplyingCSS) {
      console.log("[content.js] CSS application already in progress, skipping");
      return;
    }
    
    try {
      // CSS 적용 중 플래그 설정
      isApplyingCSS = true;
      
      // 옵저버 일시 중지
      if (headObserver) headObserver.disconnect();
      if (bodyObserver) bodyObserver.disconnect();
      
      // (1) '/ws'로 시작하는지 체크 (space.playentry.org는 일반 페이지)
      const isWsPage = location.pathname.startsWith("/ws");
      // (2) 새 CSS 파일 결정
      const newCssFile = isWsPage ? "style-ws.css" : "style.css";
      // (3) 기존 스타일 확인
      const oldStyle = document.head.querySelector(`[${EXT_STYLE_ATTR}]`);

      // (4) 이미 해당 CSS가 적용되어 있고 강제 적용이 아니라면 아무 작업도 하지 않음
      if (!force && oldStyle && 
          ((oldStyle.tagName === 'STYLE' && oldStyle.textContent.includes(newCssFile)) ||
           (oldStyle.tagName === 'LINK' && oldStyle.href.includes(newCssFile)))) {
        console.log("[content.js] Already applied CSS:", newCssFile);
        return;
      }

      // (5) 기존 스타일 제거
      removeOldStyles();

      // (6) 새 스타일 요소 생성 및 삽입 (두 가지 방법 모두 사용)
      // style 태그 방식
      const styleEl = document.createElement("style");
      styleEl.setAttribute(EXT_STYLE_ATTR, "true");
      styleEl.textContent = `
        @import url("${chrome.runtime.getURL(newCssFile)}");
      `;
      document.head.appendChild(styleEl);
      
      // link 태그 방식 (더 빠른 적용을 위해)
      const linkEl = document.createElement("link");
      linkEl.setAttribute(EXT_STYLE_ATTR, "true");
      linkEl.rel = "stylesheet";
      linkEl.type = "text/css";
      linkEl.href = chrome.runtime.getURL(newCssFile);
      document.head.appendChild(linkEl);
      
      console.log("[content.js] Applied CSS:", newCssFile, "isWsPage:", isWsPage);
      
    } finally {
      // CSS 적용 완료 후 플래그 해제
      isApplyingCSS = false;
      
      // 옵저버 재시작
      setTimeout(() => {
        observeDOM();
      }, 100); // 약간의 지연을 두고 옵저버 재시작
    }
  }

  // --------------------------------------------------
  // 8) 확장 프로그램 삽입 스타일만 제거하는 함수
  // --------------------------------------------------
  function removeOldStyles() {
    const oldStyles = document.head.querySelectorAll(`[${EXT_STYLE_ATTR}]`);
    oldStyles.forEach(s => s.remove());
  }

  // --------------------------------------------------
  // 9) 페이지가 이미 로드된 상태일 때도 작동하도록 설정
  // --------------------------------------------------
  if (document.readyState === "complete" || document.readyState === "interactive") {
    console.log("[content.js] Page already loaded, applying CSS immediately");
    applyCssIfNeeded(true);
    observeDOM(); // 페이지가 이미 로드된 상태면 MutationObserver 즉시 설정
    
    // 주기적 URL 체크 설정
    setInterval(checkUrlChange, 200);
  }
})();