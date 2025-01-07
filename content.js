// content.js
(function() {
    console.log("[content.js] Polling approach loaded.");
  
    // 최근에 확인한 경로
    let lastPath = location.pathname;
  
    // 1) 페이지 처음 진입 시 CSS 적용
    applyCss();
  
    // 2) 정기적으로 경로가 바뀌었는지 감지
    setInterval(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        console.log("[content.js] Detected path change:", lastPath);
        applyCss();
      }
    }, 500); // 0.5초 간격 (원하시면 500, 2000 등으로 바꾸세요)
  
    // CSS 적용 함수
    function applyCss() {
      // (1) 기존 link[rel="stylesheet"] 제거
      const existingLinks = document.querySelectorAll('link[rel="stylesheet"]');
      existingLinks.forEach(link => link.remove());
  
      // (2) 기존 style[data-entry-style] 제거
      const oldStyleTags = document.querySelectorAll('style[data-entry-style]');
      oldStyleTags.forEach(s => s.remove());
  
      // (3) /ws로 시작하는지 체크
      const isWsPage = location.pathname.startsWith("/ws");
  
      // (4) style 태그 만들고 import
      const styleEl = document.createElement("style");
      styleEl.setAttribute("data-entry-style", "true");
      styleEl.textContent = `
        @import url("${chrome.runtime.getURL(isWsPage ? 'style-ws.css' : 'style.css')}");
      `;
      document.head.appendChild(styleEl);
  
      console.log("[content.js] Applied CSS:", isWsPage ? "style-ws.css" : "style.css");
    }
  })();
  