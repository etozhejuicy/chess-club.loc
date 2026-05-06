function Marquee(selector, speed) {
  const container = document.querySelector(selector);
  const originalContent = container.innerHTML;

  // Дублируем содержимое один раз
  container.insertAdjacentHTML('beforeend', originalContent);

  let position = 0;
  let animationFrameId = null;

  function animate() {
    position -= speed;
    const originalWidth = container.scrollWidth / 2;

    if (Math.abs(position) >= originalWidth) {
      position = 0;
    }

    container.style.transform = `translateX(${position}px)`;
    animationFrameId = requestAnimationFrame(animate);
  }

  container.addEventListener('mouseenter', () => cancelAnimationFrame(animationFrameId));
  container.addEventListener('mouseleave', animate);

  window.addEventListener('resize', () => {
    cancelAnimationFrame(animationFrameId);
    setTimeout(animate, 100);
  });

  // Запускаем анимацию
  animate();
}

window.addEventListener('load', () => Marquee('.marquee .marquee-inner', 0.6));
