function Marquee(selector, speed) {
  const container = document.querySelector(selector);
  const originalContent = container.innerHTML;

  // Дублируем содержимое один раз
  container.insertAdjacentHTML('beforeend', originalContent);

  let position = 0;
  let animationFrameId = null;
  let isAnimating = true;      // флаг состояния анимации

  function animate() {
    if (!isAnimating) return;  // если анимация остановлена – выходим

    position -= speed;
    const originalWidth = container.scrollWidth / 2;

    if (Math.abs(position) >= originalWidth) {
      position = 0;
    }

    container.style.transform = `translateX(${position}px)`;
    animationFrameId = requestAnimationFrame(animate);
  }

  function start() {
    if (isAnimating) return;   // уже запущена
    isAnimating = true;
    animate();
  }

  function stop() {
    if (!isAnimating) return;  // уже остановлена
    isAnimating = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  // Обработчики наведения
  container.addEventListener('mouseenter', stop);
  container.addEventListener('mouseleave', start);

  // Обработчик изменения размера окна
  window.addEventListener('resize', () => {
    stop();
    // Небольшая задержка, чтобы браузер успел пересчитать размеры
    setTimeout(() => {
      start();
    }, 100);
  });

  // Запускаем анимацию
  start();
}

window.addEventListener('load', () => Marquee('.marquee .marquee-inner', 0.6));