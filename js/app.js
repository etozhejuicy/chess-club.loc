function Marquee(selector, speed) {
  const container = typeof selector === 'string'
    ? document.querySelector(selector)
    : selector;

  if (!container) return;

  // Дублируем контент
  const originalContent = container.innerHTML;
  container.insertAdjacentHTML('beforeend', originalContent);

  let position = 0;
  let animationFrameId = null;
  let isAnimating = false;
  let widthReady = false;

  function animate() {
    if (!isAnimating) return;

    position -= speed;
    const originalWidth = container.scrollWidth / 2;

    if (Math.abs(position) >= originalWidth) {
      position = 0;
    }

    container.style.transform = `translateX(${position}px)`;
    animationFrameId = requestAnimationFrame(animate);
  }

  function start() {
    if (isAnimating) return;
    // Не запускаем, если ширина ещё не определена
    if (!widthReady && container.scrollWidth === 0) {
      waitForWidth();
      return;
    }
    isAnimating = true;
    animate();
  }

  function stop() {
    if (!isAnimating) return;
    isAnimating = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  // Ждём, пока у контейнера появится ненулевая ширина
  function waitForWidth() {
    if (container.scrollWidth > 0) {
      widthReady = true;
      start();
    } else {
      setTimeout(waitForWidth, 100);
    }
  }

  container.addEventListener('mouseenter', stop);
  container.addEventListener('mouseleave', start);

  window.addEventListener('resize', () => {
    stop();
    // При ресайзе ширина может временно стать 0 – ждём восстановления
    widthReady = false;
    setTimeout(() => waitForWidth(), 100);
  });

  // Запускаем процесс: ждём готовности ширины, затем стартуем
  waitForWidth();
}

window.addEventListener('load', () => {
  const marqueeElements = document.querySelectorAll('.marquee .marquee-inner');
  marqueeElements.forEach((elem) => Marquee(elem, 0.6));
});